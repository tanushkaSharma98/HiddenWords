import { Injectable, Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { JoinLobbyPayload } from './types';
import { InjectRepository } from '@nestjs/typeorm';
import { Match } from '../../entities/match.entity';
import { Player } from '../../entities/player.entity';
import { Round } from '../../entities/round.entity';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Guess } from '../../entities/guess.entity';

@Injectable()
export class GameService {
  private lobbyQueue: { socket: Socket; playerId: string }[] = []; //Server assigns a playerId and waits for "join" action. Queue of players waiting for a match
  private logger: Logger = new Logger('GameService'); // Logger instance to log server-side messages
  private lobby: string[] = []; //alternative queue storing just player id
  private games = new Map<string, any>();//store in-memory game data keyed by gameId
  private words: string[];

  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>, //

    @InjectRepository(Player)
    private playerRepository: Repository<Player>,

    @InjectRepository(Round)
    private roundRepository: Repository<Round>,

    @InjectRepository(Guess)
    private guessRepository: Repository<Guess>
  ) {
    try {
      // Try to load from src directory first (development)
      let wordsPath = path.join(__dirname, '../../data/word.json');
      
      // If not found, try dist directory (production)
      if (!fs.existsSync(wordsPath)) {
        wordsPath = path.join(__dirname, '../../../src/data/word.json'); //dist directory(production)
      }
      
      if (!fs.existsSync(wordsPath)) {
        throw new Error(`Could not find word.json at ${wordsPath}`);
      }

      const wordsData = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
      this.words = wordsData.words;
    } catch (error) {
      console.error('Error loading words:', error);
      throw error;
    }
  }
//handles putting player in lobby queue and start if the player are ready
  async addToLobby(socket: Socket, playerId: string, server: Server): Promise<string | null> {
    this.logger.log(`Player ${playerId} joined the lobby`); //player emits join lobby , server adds them to queue
    this.lobbyQueue.push({ socket, playerId });//Adds the player and their socket to the lobbyQueue array.

    if (this.lobbyQueue.length >= 2) {
      const [p1, p2] = this.lobbyQueue.splice(0, 2);//Takes the first 2 players from the queue.

      // Ensure both players exist in DB
      await this.createPlayerIfNotExists(p1.playerId);
      await this.createPlayerIfNotExists(p2.playerId);

      // Create match in DB
      const match = this.matchRepository.create({
        player1: { id: p1.playerId },
        player2: { id: p2.playerId },
        status: 'ongoing',
      });
      await this.matchRepository.save(match);

      // Create round in DB
      const word = this.getRandomWord();
      const round = this.roundRepository.create({
        match,
        word,
        revealedTiles: new Array(word.length).fill(false),
        roundNumber: 1,
      });
      await this.roundRepository.save(round);

      // Both sockets join the game room
      p1.socket.join(match.id);
      p2.socket.join(match.id);

      // Emit gameStart to both players in the room
      server.to(match.id).emit('gameStart', {
        gameId: match.id,
        wordLength: word.length,
        roundId: round.id,
      });

      this.logger.log(`Started match between ${p1.playerId} and ${p2.playerId} (gameId: ${match.id})`);
      return match.id;
    }
    return null;
  }

  async createPlayerIfNotExists(playerId: string) {
    this.logger.log(`[DB] Checking/creating player in DB: ${playerId}`);
    try {
      const existing = await this.playerRepository.findOne({ where: { id: playerId } });
      if (!existing) {
        this.logger.log(`[DB] Creating new player in DB: ${playerId}`);
        const player = this.playerRepository.create({ id: playerId, username: `Guest-${playerId.slice(0, 8)}` });
        await this.playerRepository.save(player);
        this.logger.log(`[DB] Player created: ${playerId}`);
      } else {
        this.logger.log(`[DB] Player already exists: ${playerId}`);
      }
    } catch (err) {
      this.logger.error(`[DB] Error creating/finding player: ${playerId}`, err);
      throw err;
    }
  }

  handleDisconnect(client: Socket) {
    this.lobbyQueue = this.lobbyQueue.filter(p => p.socket.id !== client.id);
    this.logger.warn(`Removed player from lobby due to disconnect: ${client.id}`);
  }

  async addPlayerToLobby(playerId: string): Promise<string | null> {
    this.lobby.push(playerId);
    
    if (this.lobby.length >= 2) {
      const gameId = uuidv4();
      const players = this.lobby.splice(0, 2);
      
      // Create a new match in the database
      const match = this.matchRepository.create({
        player1: { id: players[0] },
        player2: { id: players[1] },
        status: 'ongoing'
      });
      await this.matchRepository.save(match);
      
      return gameId;
    }
    
    return null;
  }

  async initializeGame(gameId: string, roundNumber = 1) {
    const word = this.getRandomWord();
    const game = {
      id: gameId,
      word,
      revealedTiles: new Array(word.length).fill(false),
      roundNumber,
      status: 'active',
      scores: {
        player1: 0,
        player2: 0
      },
      currentRound: uuidv4(),
      players: [] as string[],
      guesses: new Map()
    };

    this.games.set(gameId, game);
    return game;
  }

  async processGuess(gameId: string, playerId: string, guess: string) {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'active') {
      return { error: 'Invalid game state' };
    }//Players make guesses
    

    // Check if player already guessed this round
    if (game.guesses.has(playerId)) {
      return { error: 'Already submitted guess for this round' };
    }

    game.guesses.set(playerId, guess);

    // Save guess to database
    const round = await this.roundRepository.findOne({
      where: { match: { id: gameId } }
    });
    
    if (round) {
      const guessEntity = this.guessRepository.create({
        round: { id: round.id },
        player: { id: playerId },
        guess,
        isCorrect: guess.toUpperCase() === game.word
      });
      await this.guessRepository.save(guessEntity);
    }

    // Check if guess is correct
    if (guess.toUpperCase() === game.word) {
      return {
        winner: playerId,
        revealedWord: game.word
      };
    }

    return { status: 'guess recorded' };
  }

  async revealRandomTile(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return null;

    const unrevealedIndices = game.revealedTiles
      .map((revealed, index) => revealed ? -1 : index)
      .filter(index => index !== -1);

    if (unrevealedIndices.length === 0) {
      return { isComplete: true };
    }

    const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
    game.revealedTiles[randomIndex] = true;

    return {
      index: randomIndex,
      letter: game.word[randomIndex],
      isComplete: unrevealedIndices.length === 1
    };
  }

  async endRound(gameId: string, result: any) {
    const game = this.games.get(gameId);
    if (!game) return;

    if (result.winner) {
      const playerIndex = game.players.indexOf(result.winner);
      if (playerIndex === 0) {
        game.scores.player1++;
      } else {
        game.scores.player2++;
      }

      // Update match score in database
      const match = await this.matchRepository.findOne({
        where: { id: gameId }
      });
      
      if (match) {
        match.score1 = game.scores.player1;
        match.score2 = game.scores.player2;
        await this.matchRepository.save(match);
      }
    }

    game.roundNumber++;
    game.currentRound = uuidv4();
    game.guesses.clear();
  }

  private getRandomWord(): string {
    return this.words[Math.floor(Math.random() * this.words.length)];
  }

  async getMatch(matchId: string) {
    return this.matchRepository.findOne({
      where: { id: matchId },
      relations: ['player1', 'player2']
    });
  }

  async createMatch(matchId: string, player1Id: string, player2Id: string) {
    this.logger.log(`[DB] Fetching players for match: ${player1Id}, ${player2Id}`);
    try {
      const player1 = await this.playerRepository.findOne({ where: { id: player1Id } });
      const player2 = await this.playerRepository.findOne({ where: { id: player2Id } });
      if (!player1 || !player2) {
        this.logger.error(`[DB] Could not find both players in DB: ${player1Id}, ${player2Id}`);
        throw new Error('Player not found');
      }
      this.logger.log(`[DB] Creating match entity in DB for players: ${player1Id}, ${player2Id} with id: ${matchId}`);
      const match = this.matchRepository.create({
        id: matchId,
        player1,
        player2,
        status: 'ongoing',
      });
      await this.matchRepository.save(match);
      this.logger.log(`[DB] Saved match in DB: ${match.id}`);
      return match;
    } catch (err) {
      this.logger.error(`[DB] Error creating match: ${player1Id}, ${player2Id}`, err);
      throw err;
    }
  }
}