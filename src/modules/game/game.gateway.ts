import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger = new Logger('GameGateway');
  private activeGames = new Map<string, any>();
  private playerSockets = new Map<string, Socket>();
  private socketToPlayer = new Map<string, string>();
  private lobbyQueue: { socket: Socket; playerId: string }[] = [];
  private waitingRooms = new Map<string, { player1: string; player2: string }>();

  constructor(private readonly gameService: GameService) {}

  async handleConnection(client: Socket) {
    const playerId = uuidv4();
    this.socketToPlayer.set(client.id, playerId);
    this.playerSockets.set(playerId, client);

    // Create a new player in the database if not exists
    await this.gameService.createPlayerIfNotExists(playerId);

    client.emit('playerId', { playerId });
    this.logger.log(`Assigned playerId ${playerId} to socket ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const playerId = this.socketToPlayer.get(client.id);
    
    if (!playerId) {
      this.logger.error(`No playerId found for socket ${client.id}`);
      return;
    }
    
    // Remove from lobby queue if present
    this.lobbyQueue = this.lobbyQueue.filter(p => p.socket.id !== client.id);
    
    // Handle player disconnection from waiting room
    for (const [matchId, players] of this.waitingRooms.entries()) {
      if (players.player1 === playerId || players.player2 === playerId) {
        this.waitingRooms.delete(matchId);
        this.server.to(matchId).emit('playerDisconnected', { playerId });
      }
    }
    
    // Handle player disconnection from active game
    const gameId = this.findGameByPlayerId(playerId);
    if (gameId) {
      await this.handlePlayerDisconnect(gameId, client.id);
    }
  }

  @SubscribeMessage('joinLobby')
  async handleJoinLobby(client: Socket) {
    const playerId = this.socketToPlayer.get(client.id);
    if (!playerId) {
      this.logger.error(`No playerId found for socket ${client.id}`);
      client.emit('error', { message: 'Player ID not found. Please refresh and try again.' });
      return;
    }

    // Ensure player exists in DB before adding to queue
    await this.gameService.createPlayerIfNotExists(playerId);

    // Add player to lobby queue
    this.lobbyQueue.push({ socket: client, playerId });
    this.logger.log(`Player ${playerId} joined the lobby. Queue size: ${this.lobbyQueue.length}`);

    // If we have 2 players, create a waiting room
    if (this.lobbyQueue.length >= 2) {
      const [player1, player2] = this.lobbyQueue.splice(0, 2);
      const matchId = uuidv4();

      try {
        // Ensure both players exist in DB
        await this.gameService.createPlayerIfNotExists(player1.playerId);
        await this.gameService.createPlayerIfNotExists(player2.playerId);
        this.logger.log(`Ensured both players exist in DB: ${player1.playerId}, ${player2.playerId}`);
        // Create match in DB
        const match = await this.gameService.createMatch(matchId, player1.playerId, player2.playerId);
        this.logger.log(`Created match in DB: ${match.id}`);
      } catch (err) {
        this.logger.error('Error creating players or match in DB:', err);
        client.emit('error', { message: 'Failed to create match in DB' });
        return;
      }

      // Both players join the match room
      player1.socket.join(matchId);
      player2.socket.join(matchId);

      // Store waiting room information
      this.waitingRooms.set(matchId, {
        player1: player1.playerId,
        player2: player2.playerId
      });

      // Notify both players about the match and their roles
      this.server.to(matchId).emit('waitingRoomCreated', {
        matchId,
        player1: {
          id: player1.playerId,
          socketId: player1.socket.id
        },
        player2: {
          id: player2.playerId,
          socketId: player2.socket.id
        }
      });
    }
  }

  @SubscribeMessage('joinMatch')
  async handleJoinMatch(client: Socket, { matchId, playerId }) {
    this.logger.log(`Player ${playerId} joining match ${matchId}`);
    client.join(matchId);

    // Add this log:
    this.logger.log(`Current waitingRooms: ${JSON.stringify(Array.from(this.waitingRooms.entries()))}`);

    // Get the waiting room data
    const waitingRoom = this.waitingRooms.get(matchId);
    let player1Id, player2Id;
    if (waitingRoom) {
      player1Id = waitingRoom.player1;
      player2Id = waitingRoom.player2;
    } else {
      // Fallback: try to get from DB if not in memory
      const match = await this.gameService.getMatch(matchId);
      if (match) {
        player1Id = match.player1.id;
        player2Id = match.player2.id;
      }
    }

    if (player1Id && player2Id) {
      // Emit waitingRoomCreated event to all players in the room
      this.server.to(matchId).emit('waitingRoomCreated', {
        matchId,
        player1: { id: player1Id, socketId: this.playerSockets.get(player1Id)?.id || null },
        player2: { id: player2Id, socketId: this.playerSockets.get(player2Id)?.id || null }
      });

      // Notify other players in the room
      client.emit('playerJoined', { 
        playerId,
        isPlayer1: player1Id === playerId,
        isPlayer2: player2Id === playerId
      });

      const otherPlayerId = player1Id === playerId ? player2Id : player1Id;
      const otherSocket = this.playerSockets.get(otherPlayerId);
      if (otherSocket) {
        otherSocket.emit('playerJoined', { 
          playerId,
          isPlayer1: player1Id === playerId,
          isPlayer2: player2Id === playerId
        });
      }
    }
  }
  
  @SubscribeMessage('startGame')
  async handleStartGame(client: Socket, { matchId }: { matchId: string }) {
    this.logger.log(`Start game request received for match ${matchId} from socket ${client.id}`);
    
    const playerId = this.socketToPlayer.get(client.id);
    if (!playerId) {
      this.logger.error(`No playerId found for socket ${client.id}`);
      client.emit('error', { message: 'Player ID not found' });
      return;
    }
    this.logger.log(`Player ${playerId} starting game`);

    // Remove waitingRooms check and always start the game
    try {
      // Get player1 and player2 from DB or another method
      const match = await this.gameService.getMatch(matchId);
      let player1Id: string | null = null, player2Id: string | null = null;
      if (match) {
        player1Id = match.player1.id;
        player2Id = match.player2.id;
      }
      if (!player1Id || !player2Id) {
        this.logger.error(`Missing player IDs for match ${matchId}`);
        this.server.to(matchId).emit('error', { message: 'Missing player IDs' });
      return;
    }
      this.logger.log(`Starting game for match ${matchId} with players:`, { player1Id, player2Id });

      // Initialize the game
      this.logger.log(`Initializing game for match ${matchId}`);
      const game = await this.gameService.initializeGame(matchId);
      game.players = [player1Id, player2Id];
      this.activeGames.set(matchId, game);
      // Emit gameStart event with the game data
      this.logger.log(`Emitting gameStart to match ${matchId} with game data:`, {
        gameId: matchId,
        wordLength: game.word.length,
        roundId: game.currentRound,
        players: [
          { id: player1Id },
          { id: player2Id }
        ],
        scores: game.scores,
        roundNumber: game.roundNumber,
        revealedTiles: game.revealedTiles
      });
      this.server.to(matchId).emit('gameStart', {
        gameId: matchId,
        word: game.word,
        wordLength: game.word.length,
        roundId: game.currentRound,
        players: [
          { id: player1Id },
          { id: player2Id }
        ],
        scores: game.scores,
        roundNumber: game.roundNumber,
        revealedTiles: game.revealedTiles
      });
      // Start the first round
      setTimeout(() => {
        this.startRound(matchId);
      }, 1000);
    } catch (error) {
      this.logger.error(`Failed to start game for match ${matchId}:`, error);
      this.server.to(matchId).emit('error', { message: 'Failed to start game' });
    }
  }

  @SubscribeMessage('submitGuess')
  async handleGuess(client: Socket, payload: { gameId: string; guess: string; timestamp: number }) {
    const { gameId, guess, timestamp } = payload;
    const game = this.activeGames.get(gameId);
    if (!game || game.status !== 'active') {
      return { error: 'Invalid game state' };
    }
    if (game.tickStatus !== 'in-progress') {
      return { error: 'Guesses are locked for this round' };
    }
    if (!game.tickGuesses) game.tickGuesses = new Map();
    if (!game.roundTimer) return { error: 'No round timer' };
    if (!timestamp || timestamp - game.tickStartTime > 10000) {
      return { error: 'Late submission' };
    }
    // Map socket ID to player ID
    const playerId = this.socketToPlayer.get(client.id);
    if (!playerId) return { error: 'Player not found' };
    // Allow multiple guesses per round, always store the latest
    game.tickGuesses.set(playerId, { guess, tick: game.currentTick });
    // Map guesses to { player1: [...], player2: [...] }
    const player1Id = game.players[0];
    const player2Id = game.players[1];
    const guessesObj: { player1: string[]; player2: string[] } = { player1: [], player2: [] };
    for (const [pid, g] of game.tickGuesses.entries()) {
      if (pid === player1Id) guessesObj.player1.push(g.guess);
      else if (pid === player2Id) guessesObj.player2.push(g.guess);
    }
    this.server.to(gameId).emit('guessUpdate', {
      guesses: guessesObj,
      players: [
        { id: player1Id },
        { id: player2Id }
      ]
    });

    // Check for correct guess
    const correctPlayers = Array.from(game.tickGuesses.entries())
      .filter(([_, g]) => g.guess.trim().toUpperCase() === game.word)
      .map(([pid, _]) => pid);
    if (correctPlayers.length > 0) {
      // End the round immediately
      game.tickStatus = 'ended';
      if (game.roundTimer) clearTimeout(game.roundTimer);
      let winner = null;
      if (correctPlayers.length === 1) {
        winner = correctPlayers[0];
      } // else draw (winner stays null)
      this.endRound(gameId, { winner, revealedWord: game.word });
      return { status: 'winner', winner, revealedWord: game.word };
    }

    // Reveal a random tile after every guess (if not complete)
    const revealedTile = await this.gameService.revealRandomTile(gameId);
    if (revealedTile) {
      this.server.to(gameId).emit('revealTile', {
        gameId,
        index: revealedTile.index,
        letter: revealedTile.letter,
        word: game.word,
        players: [
          { id: player1Id },
          { id: player2Id }
        ],
        revealedTiles: game.revealedTiles,
        scores: game.scores,
        roundNumber: game.roundNumber
      });
      if (revealedTile.isComplete) {
        game.tickStatus = 'ended';
        if (game.roundTimer) clearTimeout(game.roundTimer);
        this.endRound(gameId, { winner: null, revealedWord: game.word });
      }
    }
    return { status: 'guess recorded' };
  }

  // New: Start a round with a 10s timer
  private startRound(gameId: string) {
    const game = this.activeGames.get(gameId);
    if (!game) return;
    game.roundTimer && clearTimeout(game.roundTimer);
    game.tickStatus = 'in-progress';
    game.tickGuesses = new Map();
    game.tickStartTime = Date.now();
    // 10s round timer
    game.roundTimer = setTimeout(() => {
      this.endRound(gameId, { winner: null, revealedWord: game.word });
    }, 10000);
    this.server.to(gameId).emit('tickStart', {
      gameId,
      timeRemaining: 10000,
      word: game.word,
      revealedTiles: game.revealedTiles,
      players: [
        { id: game.players[0] },
        { id: game.players[1] }
      ],
      scores: game.scores,
      roundNumber: game.roundNumber
    });
  }

  private async endRound(gameId: string, result: any) {
    const game = this.activeGames.get(gameId);
    if (!game) return;
    if (game.roundTimer) clearTimeout(game.roundTimer);
    await this.gameService.endRound(gameId, result);
    // Map guesses to { player1: [...], player2: [...] }
    const player1Id = game.players[0];
    const player2Id = game.players[1];
    const guessesObj: { player1: string[]; player2: string[] } = { player1: [], player2: [] };
    if (game.tickGuesses) {
      for (const [pid, g] of game.tickGuesses.entries()) {
        if (pid === player1Id) guessesObj.player1.push(g.guess);
        else if (pid === player2Id) guessesObj.player2.push(g.guess);
      }
    }
    this.server.to(gameId).emit('roundEnd', {
      gameId,
      winner: result.winner,
      revealedWord: result.revealedWord,
      word: game.word,
      scores: game.scores,
      guesses: guessesObj,
      players: [
        { id: player1Id },
        { id: player2Id }
      ],
      roundNumber: game.roundNumber,
      revealedTiles: game.revealedTiles
    });
    // Start next round or end game after a 3s delay
    if (this.shouldEndGame(game)) {
      setTimeout(() => this.endGame(gameId), 3000);
    } else {
      setTimeout(async () => {
        // Start next round
        const newGame = await this.gameService.initializeGame(gameId);
        newGame.players = game.players;
        this.activeGames.set(gameId, newGame);
        this.server.to(gameId).emit('gameStart', {
          gameId,
          word: newGame.word,
          wordLength: newGame.word.length,
          roundId: newGame.currentRound,
          players: [
            { id: newGame.players[0] },
            { id: newGame.players[1] }
          ],
          scores: newGame.scores,
          roundNumber: newGame.roundNumber,
          revealedTiles: newGame.revealedTiles
        });
        setTimeout(() => {
          this.startRound(gameId);
        }, 3000);
      }, 3000);
    }
  }

  private async endGame(gameId: string) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    this.server.to(gameId).emit('gameEnd', {
      gameId,
      winner: this.determineGameWinner(game),
      finalScores: game.scores,
      word: game.word,
      players: [
        { id: game.players[0] },
        { id: game.players[1] }
      ],
      roundNumber: game.roundNumber,
      revealedTiles: game.revealedTiles
    });

    this.activeGames.delete(gameId);
  }

  private findGameByPlayerId(playerId: string): string | null {
    for (const [gameId, game] of this.activeGames.entries()) {
      if (game.players.includes(playerId)) {
        return gameId;
      }
    }
    return null;
  }

  private async handlePlayerDisconnect(gameId: string, playerId: string) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    // Give win to other player after grace period
    setTimeout(() => {
      const otherPlayer = game.players.find(p => p !== playerId);
      if (otherPlayer) {
        this.endRound(gameId, { winner: otherPlayer });
      }
    }, 5000);
  }

  private shouldEndGame(game: any): boolean {
    return game.roundNumber >= 5 || 
           game.scores.player1 >= 3 || 
           game.scores.player2 >= 3;
  }

  private determineGameWinner(game: any): string | null {
    if (game.scores.player1 > game.scores.player2) return 'player1';
    if (game.scores.player2 > game.scores.player1) return 'player2';
    return null; // Draw
  }
}

