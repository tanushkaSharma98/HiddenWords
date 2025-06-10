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

  constructor(private readonly gameService: GameService) {}

  async handleConnection(client: Socket) {
    const playerId = uuidv4();
    this.socketToPlayer.set(client.id, playerId);

    // Create a new player in the database if not exists
    await this.gameService.createPlayerIfNotExists(playerId);

    client.emit('playerId', { playerId });
    this.logger.log(`Assigned playerId ${playerId} to socket ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Handle player disconnection
    const gameId = this.findGameByPlayerId(client.id);
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
    // Pass both socket and playerId to the service
    await this.gameService.addToLobby(client, playerId, this.server);
  }

  @SubscribeMessage('joinMatch')
async handleJoinMatch(client: Socket, { matchId, playerId }) {
  client.join(matchId);
  this.server.to(matchId).emit('playerJoined', { playerId });
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