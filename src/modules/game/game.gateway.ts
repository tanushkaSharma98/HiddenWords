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

    // Add player to lobby queue
    this.lobbyQueue.push({ socket: client, playerId });
    this.logger.log(`Player ${playerId} joined the lobby. Queue size: ${this.lobbyQueue.length}`);

    // If we have 2 players, create a waiting room
    if (this.lobbyQueue.length >= 2) {
      const [player1, player2] = this.lobbyQueue.splice(0, 2);
      const matchId = uuidv4();

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
      this.logger.log(`Starting game for match ${matchId} with players:`, { player1Id, player2Id });

      // Initialize the game
      this.logger.log(`Initializing game for match ${matchId}`);
      const game = await this.gameService.initializeGame(matchId);
      this.activeGames.set(matchId, game);
      
      // Emit gameStart event with the game data
      this.logger.log(`Emitting gameStart to match ${matchId} with game data:`, {
        gameId: matchId,
        wordLength: game.word.length,
        roundId: game.currentRound,
        players: [
          { id: player1Id },
          { id: player2Id }
        ]
      });
      
      this.server.to(matchId).emit('gameStart', {
        gameId: matchId,
        wordLength: game.word.length,
        roundId: game.currentRound,
        players: [
          { id: player1Id },
          { id: player2Id }
        ]
      });

      // Start the first tick after a short delay
      this.logger.log(`Scheduling first tick for match ${matchId}`);
      setTimeout(() => {
        this.startTick(matchId);
      }, 3000);
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
      return { error: 'Guesses are locked for this tick' };
    }
    if (!game.tickGuesses) game.tickGuesses = new Map();
    const tickDuration = 5000;
    if (!timestamp || timestamp - game.tickStartTime > tickDuration) {
      return { error: 'Late submission' };
    }
    // Allow multiple guesses per tick, always store the latest
    game.tickGuesses.set(client.id, { guess, tick: game.currentTick });
    // Emit guessUpdate to both players
    this.server.to(gameId).emit('guessUpdate', Array.from(game.tickGuesses.entries()).map(([pid, g]) => ({ playerId: pid, guess: g.guess })));

    // Check for correct guess
    const correctPlayers = Array.from(game.tickGuesses.entries())
      .filter(([_, g]) => g.guess.trim().toUpperCase() === game.word)
      .map(([pid, _]) => pid);
    if (correctPlayers.length > 0) {
      // End the round immediately
      game.tickStatus = 'ended';
      if (game.tickTimer) clearTimeout(game.tickTimer);
      let winner = null;
      if (correctPlayers.length === 1) {
        winner = correctPlayers[0];
      } // else draw (winner stays null)
      this.endRound(gameId, { winner, revealedWord: game.word });
      return { status: 'winner', winner, revealedWord: game.word };
    }
    return { status: 'guess recorded' };
  }

  private startTick(gameId: string) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    // Initialize tick state
    if (typeof game.currentTick !== 'number') game.currentTick = 1;
    else game.currentTick++;
    game.tickStatus = 'in-progress';
    game.tickGuesses = new Map();
    game.tickStartTime = Date.now(); // Store tick start time

    // Save timer so we can clear it if needed
    if (game.tickTimer) clearTimeout(game.tickTimer);
    game.tickTimer = setTimeout(() => {
      this.endTick(gameId);
    }, 5000);

    this.server.to(gameId).emit('tickStart', {
      gameId,
      tick: game.currentTick,
      timeRemaining: 5000,
      revealedTiles: game.revealedTiles,
      serverTime: game.tickStartTime
    });
  }

  private async endTick(gameId: string) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    game.tickStatus = 'waiting'; // Lock guesses after tick

    // Reveal a random tile if no winner
    const revealedTile = await this.gameService.revealRandomTile(gameId);
    if (!revealedTile) {
      this.logger.error(`Failed to reveal tile for game ${gameId}`);
      return;
    }

    this.server.to(gameId).emit('revealTile', {
      gameId,
      index: revealedTile.index,
      letter: revealedTile.letter
    });

    if (revealedTile.isComplete) {
      this.endRound(gameId, { winner: null, revealedWord: game.word });
    } else {
      this.startTick(gameId);
    }
  }

  private async endRound(gameId: string, result: any) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    await this.gameService.endRound(gameId, result);
    
    this.server.to(gameId).emit('roundEnd', {
      gameId,
      winner: result.winner,
      revealedWord: result.revealedWord,
      scores: game.scores
    });

    // Start next round or end game after a short delay
    if (this.shouldEndGame(game)) {
      setTimeout(() => this.endGame(gameId), 3000);
    } else {
      setTimeout(async () => {
        // Start next round
        const newGame = await this.gameService.initializeGame(gameId);
        this.activeGames.set(gameId, newGame);
        this.server.to(gameId).emit('gameStart', {
          gameId,
          wordLength: newGame.word.length,
          roundId: newGame.currentRound
        });
        setTimeout(() => {
          this.startTick(gameId);
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
      finalScores: game.scores
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