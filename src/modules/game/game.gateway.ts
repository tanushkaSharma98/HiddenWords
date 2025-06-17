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
import { RoundService } from '../round/round.service';
import { GuessService } from '../guess/guess.service';

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
  private disconnectTimeouts = new Map<string, NodeJS.Timeout>(); // playerId -> timeout

  constructor(
    private readonly gameService: GameService,
    private readonly roundService: RoundService,
    private readonly guessService: GuessService
  ) {}
///generating new playerid if disconnecte or reload which is wrong 
  async handleConnection(client: Socket) {
    const handshakePlayerId = client.handshake.query.playerId as string | undefined;
    const playerId = (handshakePlayerId && handshakePlayerId !== 'undefined') ? handshakePlayerId : uuidv4();
    this.socketToPlayer.set(client.id, playerId);
    this.playerSockets.set(playerId, client);

    // --- RECONNECT LOGIC: Clear disconnect timeout if exists ---
    if (this.disconnectTimeouts.has(playerId)) {
      clearTimeout(this.disconnectTimeouts.get(playerId));
      this.disconnectTimeouts.delete(playerId);
      this.logger.log(`Cleared disconnect timeout for player ${playerId} (reconnected)`);
    }

    // Re-join any waiting room or active game
    for (const [matchId, players] of this.waitingRooms.entries()) {
      if (players.player1 === playerId || players.player2 === playerId) {
        client.join(matchId);
        this.logger.log(`Re-joined player ${playerId} to waiting room ${matchId}`);
      }
    }
    for (const [gameId, game] of this.activeGames.entries()) {
      if (game.players && game.players.includes(playerId)) {
        client.join(gameId);
        this.logger.log(`Re-joined player ${playerId} to active game ${gameId}`);
      }
    }

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
    
    // --- GRACEFUL DISCONNECT: Start a timeout before removing player from match ---
    if (this.disconnectTimeouts.has(playerId)) {
      clearTimeout(this.disconnectTimeouts.get(playerId));
    }
    this.disconnectTimeouts.set(playerId, setTimeout(async () => {
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
        await this.handlePlayerDisconnect(gameId, playerId);
      }
      this.disconnectTimeouts.delete(playerId);
      this.logger.log(`Player ${playerId} removed after disconnect timeout.`);
    }, 10000)); // 10 seconds grace period
    this.logger.log(`Started disconnect timeout for player ${playerId}`);
  }

  @SubscribeMessage('joinLobby')
  async handleJoinLobby(client: Socket) {
    console.log("join lobby");
    const playerId = this.socketToPlayer.get(client.id);
    console.log(playerId,"playerId here");
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
      this.logger.log(`[waitingRoomCreated] Emitting for matchId ${matchId} with player1: ${player1Id}, player2: ${player2Id}`);
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

    // On reconnect, fetch latest round from DB and update activeGames
    const rounds = await this.roundService.getRoundsByMatchId(matchId);
    const latestRound = rounds[rounds.length - 1];
    if (latestRound && player1Id && player2Id) {
      const game = {
        id: matchId,
        word: latestRound.word,
        revealedTiles: latestRound.revealedTiles,
        roundNumber: latestRound.roundNumber,
        status: 'active',
        scores: { player1: 0, player2: 0 }, // TODO: fetch actual scores if needed
        currentRound: latestRound.id,
        players: [player1Id, player2Id],
        guesses: new Map(),
      };
      this.activeGames.set(matchId, game);
      client.emit('gameStart', {
        gameId: matchId,
        word: latestRound.word,
        wordLength: latestRound.word.length,
        roundId: latestRound.id,
        players: [
          { id: player1Id },
          { id: player2Id }
        ],
        scores: game.scores,
        roundNumber: latestRound.roundNumber,
        revealedTiles: latestRound.revealedTiles
      });
    }
  }
  
  @SubscribeMessage('startGame')
  async handleStartGame(client: Socket, { matchId }: { matchId: string }) {
    this.logger.log(`Start game request received for match ${matchId} from socket ${client.id}`);
    
    // creation
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
      const round = await this.roundService.createAutoRound(matchId);
      const game = {
        id: matchId,
        word: round.word,
        revealedTiles: new Array(round.word.length).fill(false),
        roundNumber: round.roundNumber,
        status: 'active',
        scores: { player1: 0, player2: 0 },
        currentRound: round.id,
        players: [player1Id, player2Id],
        guesses: new Map(),
      };
      this.activeGames.set(matchId, game);
      this.logger.log('Emitting gameStart with players:', [
        { id: player1Id },
        { id: player2Id }
      ]);
      this.server.to(matchId).emit('gameStart', {
        gameId: matchId,
        word: round.word,
        wordLength: round.word.length,
        roundId: round.id,
        players: [
          { id: player1Id },
          { id: player2Id }
        ],
        scores: game.scores,
        roundNumber: round.roundNumber,
        revealedTiles: game.revealedTiles
      });
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
    if (!game.tickInterval) return { error: 'No round timer' };
    // Map socket ID to player ID
    const playerId = this.socketToPlayer.get(client.id);
    if (!playerId) return { error: 'Player not found' };

    // Save guess in DB
    await this.guessService.createGuess(game.currentRound, playerId, guess);

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

    // Reveal a random tile on every guess
    const unrevealedIndices = game.revealedTiles
      .map((revealed, idx) => revealed ? -1 : idx)
      .filter(idx => idx !== -1);
    if (unrevealedIndices.length > 0) {
      const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
      game.revealedTiles[randomIndex] = true;
      this.server.to(gameId).emit('revealTile', {
        gameId,
        index: randomIndex,
        letter: game.word[randomIndex],
        revealedTiles: game.revealedTiles,
        players: game.players,
        scores: game.scores,
        roundNumber: game.roundNumber
      });
    }

    // Check for correct guess
    const correctPlayers = Array.from(game.tickGuesses.entries())
      .filter(([_, g]) => g.guess.trim().toUpperCase() === game.word)
      .map(([pid, _]) => pid);
    if (correctPlayers.length > 0) {
      // End the round immediately
      game.tickStatus = 'ended';
      if (game.tickInterval) clearInterval(game.tickInterval);
      let winner = null;
      if (correctPlayers.length === 1) {
        winner = correctPlayers[0];
      } // else draw (winner stays null)
      this.endRound(gameId, { winner, revealedWord: game.word });
      return { status: 'winner', winner, revealedWord: game.word };
    }

    // If >60% revealed and no winner, end round
    const revealedCount = game.revealedTiles.filter(Boolean).length;
    const revealPercent = revealedCount / game.word.length;
    if (revealPercent > 0.6) {
      if (game.tickInterval) clearInterval(game.tickInterval);
      game.tickStatus = 'ended';
      this.endRound(gameId, { winner: null, revealedWord: game.word });
      return { status: 'no winner', revealedWord: game.word };
    }
    return { status: 'guess recorded' };
  }

  private startRound(gameId: string) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    // Reset guesses and revealedTiles for the round
    game.tickGuesses = new Map();
    game.revealedTiles = new Array(game.word.length).fill(false);
    game.tickStatus = 'in-progress';
    game.tickCount = 0;

    // Helper to count revealed tiles
    const revealedCount = () => game.revealedTiles.filter(Boolean).length;
    const revealPercent = () => revealedCount() / game.word.length;

    // Start the tick interval
    game.tickInterval = setInterval(async () => {
      // Reveal a random tile
      const unrevealedIndices = game.revealedTiles
        .map((revealed, idx) => revealed ? -1 : idx)
        .filter(idx => idx !== -1);
      if (unrevealedIndices.length > 0) {
        const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
        game.revealedTiles[randomIndex] = true;
        this.server.to(gameId).emit('revealTile', {
          gameId,
          index: randomIndex,
          letter: game.word[randomIndex],
          revealedTiles: game.revealedTiles,
          players: game.players,
          scores: game.scores,
          roundNumber: game.roundNumber
        });
      }

      // If >60% revealed and no winner, end round
      if (revealPercent() > 0.6) {
        clearInterval(game.tickInterval);
        game.tickStatus = 'ended';
        this.endRound(gameId, { winner: null, revealedWord: game.word });
      }
    }, 2000); // 2 seconds per tick (adjust as needed)

    // Emit tickStart to both players
    this.server.to(gameId).emit('tickStart', {
      gameId,
      timeRemaining: 2000,
      word: game.word,
      revealedTiles: game.revealedTiles,
      players: game.players,
      scores: game.scores,
      roundNumber: game.roundNumber
    });
  }

  private async endRound(gameId: string, result: any) {
    const game = this.activeGames.get(gameId);
    if (!game) return;
    if (game.tickInterval) clearInterval(game.tickInterval);
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
        // Start next round using DB
        const round = await this.roundService.createAutoRound(gameId);
        const newGame = {
          ...game,
          word: round.word,
          revealedTiles: new Array(round.word.length).fill(false),
          roundNumber: round.roundNumber,
          currentRound: round.id,
          guesses: new Map(),
        };
        this.activeGames.set(gameId, newGame);
        this.server.to(gameId).emit('gameStart', {
          gameId,
          word: round.word,
          wordLength: round.word.length,
          roundId: round.id,
          players: [
            { id: newGame.players[0] },
            { id: newGame.players[1] }
          ],
          scores: newGame.scores,
          roundNumber: round.roundNumber,
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
