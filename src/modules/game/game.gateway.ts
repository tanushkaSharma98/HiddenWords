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
    const playerId = this.socketToPlayer.get(client.id);
    if (!playerId) {
      client.emit('error', { message: 'Player ID not found' });
      return;
    }

    const waitingRoom = this.waitingRooms.get(matchId);
    if (!waitingRoom) {
      client.emit('error', { message: 'Waiting room not found' });
      return;
    }

    // Notify all players in the match that the game is starting
    this.server.to(matchId).emit('gameStarting', { 
      matchId,
      startedBy: playerId
    });
    
    // Remove from waiting rooms
    this.waitingRooms.delete(matchId);
    
    // Start the game after a short delay
    setTimeout(() => {
      this.startGame(matchId);
    }, 3000);
  }

  @SubscribeMessage('submitGuess')
  async handleGuess(client: Socket, payload: { gameId: string; guess: string }) {
    const { gameId, guess } = payload;
    const game = this.activeGames.get(gameId);
    
    if (!game || game.status !== 'active') {
      return { error: 'Invalid game state' };
    }

    const result = await this.gameService.processGuess(gameId, client.id, guess);
    if (result.winner) {
      this.endRound(gameId, result);
    }
    
    return result;
  }

  private async startGame(gameId: string) {
    const game = await this.gameService.initializeGame(gameId);
    this.activeGames.set(gameId, game);
    
    // Notify both players
    this.logger.log(`Emitting gameStart to gameId: ${gameId}`);
    this.server.to(gameId).emit('gameStart', {
      gameId,
      wordLength: game.word.length,
      roundId: game.currentRound
    });

    // Start the first tick
    this.startTick(gameId);
  }

  private startTick(gameId: string) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    this.server.to(gameId).emit('tickStart', {
      gameId,
      timeRemaining: 5000 // 5 seconds
    });

    setTimeout(() => {
      this.endTick(gameId);
    }, 5000);
  }

  private async endTick(gameId: string) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

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

    // Start next round or end game
    if (this.shouldEndGame(game)) {
      this.endGame(gameId);
    } else {
      this.startGame(gameId);
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