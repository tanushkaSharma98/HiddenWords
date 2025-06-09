import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GuessService } from 'src/modules/guess/guess.service';
import { RoundService } from 'src/modules/round/round.service';
import { MatchService } from 'src/modules/match/match.service';
import { Round } from 'src/entities/round.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private socketToPlayer = new Map<string, string>();
  private waitingPlayer: { socket: Socket; playerId: string } | null = null;
  private tickIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly guessService: GuessService,
    private readonly roundService: RoundService,
    private readonly matchService: MatchService,
  ) {}

  handleConnection(socket: Socket) {
    console.log(`Client connected: ${socket.id}`);
  }

  handleDisconnect(socket: Socket) {
    const playerId = this.socketToPlayer.get(socket.id);
    console.log(`Client disconnected: ${socket.id} (Player: ${playerId})`);
    this.socketToPlayer.delete(socket.id);

    if (this.waitingPlayer?.socket.id === socket.id) {
      this.waitingPlayer = null;
    }
  }

  @SubscribeMessage('joinLobby')
  async handleJoinLobby(
    @MessageBody() data: { playerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log('joinLobby received from:', data.playerId);
    this.socketToPlayer.set(client.id, data.playerId);

    if (!this.waitingPlayer) {
      this.waitingPlayer = { socket: client, playerId: data.playerId };
      client.emit('waitingForOpponent');
    } else {
      const player1Id = this.waitingPlayer.playerId;
      const player2Id = data.playerId;

      const matchResult = await this.matchService.createMatch({
        player1Id,
        player2Id,
      });

      const matchId = matchResult.matchId;

      client.join(matchId);
      this.waitingPlayer.socket.join(matchId);

      client.emit('matchStarted', {
        matchId,
        opponentId: player1Id,
        firstRound: matchResult.firstRound,
      });

      this.waitingPlayer.socket.emit('matchStarted', {
        matchId,
        opponentId: player2Id,
        firstRound: matchResult.firstRound,
      });
//       console.log('✅ Emitting matchStarted to both players:', {
//   player1Id,
//   player2Id,
//   matchId,
// });


      const fullRound = await this.roundService.getRoundById(
        matchResult.firstRound.roundId,
      );
      await this.startTickCycle(fullRound, matchId);

      this.waitingPlayer = null;
    }
  }

  @SubscribeMessage('joinMatch')
  handleJoinMatch(
    @MessageBody() data: { matchId: string; playerId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    console.log('joinMatch received:', data);
    socket.join(data.matchId);
    this.socketToPlayer.set(socket.id, data.playerId);
    this.server.to(data.matchId).emit('playerJoined', {
      message: `Player ${data.playerId} joined match ${data.matchId}`,
    });
  }

  @SubscribeMessage('newGuess')
  async handleNewGuess(
    @MessageBody() data: { roundId: string; playerId: string; guess: string },
    @ConnectedSocket() socket: Socket,
  ) {
    console.log('newGuess received:', data);

    try {
      const round = await this.roundService.getRoundById(data.roundId);
      if (round.endedAt) {
        socket.emit('errorMsg', {
          message: 'Round already ended',
        });
        return;
      }

      const guess = await this.guessService.createGuess(
        data.roundId,
        data.playerId,
        data.guess,
      );

      socket.emit('guessResult', {
        isCorrect: guess.isCorrect,
        guess: guess.guess,
      });

      const matchId = round.match.id;

      this.server.to(matchId).emit('newGuessBroadcast', {
        playerId: data.playerId,
        guess: guess.guess,
        isCorrect: guess.isCorrect,
      });

      if (guess.isCorrect) {
        console.log(` Round Ended: Winner = ${data.playerId}`);
        clearInterval(this.tickIntervals.get(round.id));
        this.tickIntervals.delete(round.id);

        await this.roundService.setRoundWinner(data.roundId, data.playerId);

        this.server.to(matchId).emit('roundEnded', {
          winnerId: data.playerId,
          roundId: data.roundId,
        });

        await this.roundService.checkAndEndMatchIfCompleted(matchId);
        console.log(` Checked if match ${matchId} needs to be ended.`);

        const nextRound =
          await this.roundService.createNextRoundIfMatchOngoing(matchId);
        if (nextRound) {
          console.log(` Next round started for match ${matchId}`);
          this.server.to(matchId).emit('nextRoundStarted', {
            roundId: nextRound.id,
            wordLength: nextRound.word.length,
            roundNumber: nextRound.roundNumber,
          });
          await this.startTickCycle(nextRound, matchId);
        }
      }
    } catch (error) {
      socket.emit('errorMsg', {
        message: error.message || 'An error occurred during guess.',
      });
    }
  }

  // ✅ Updated Tick and Reveal Logic
  private async startTickCycle(round: Round, matchId: string) {
    const roundId = round.id;
    const wordLength = round.word.length;
    const maxReveals = Math.ceil(wordLength * 0.6); // Max 60% of word
    let revealCount = 0;

    const interval = setInterval(async () => {
      const updatedRound = await this.roundService.getRoundById(roundId);
      if (updatedRound.endedAt) {
        clearInterval(interval);
        this.tickIntervals.delete(roundId);
        return;
      }

      const unrevealedIndexes = updatedRound.revealedTiles
        .map((revealed, index) => (!revealed ? index : null))
        .filter((index) => index !== null);

      if (revealCount >= maxReveals || unrevealedIndexes.length === 0) {
        updatedRound.endedAt = new Date();
        await this.roundService.saveRound(updatedRound);

        this.server.to(matchId).emit('roundEnded', {
          winnerId: null,
          roundId,
          revealedWord: updatedRound.word,
        });

        clearInterval(interval);
        this.tickIntervals.delete(roundId);
        return;
      }

      const indexToReveal =
        unrevealedIndexes[Math.floor(Math.random() * unrevealedIndexes.length)];
      updatedRound.revealedTiles[indexToReveal] = true;
      revealCount++;

      await this.roundService.saveRound(updatedRound);

      this.server.to(matchId).emit('revealTile', {
        index: indexToReveal,
        letter: updatedRound.word[indexToReveal],
      });

      this.server.to(matchId).emit('tickStart', {
        roundId,
        revealedTiles: updatedRound.revealedTiles,
      });
    }, 5000); // Tick every 5 seconds

    this.tickIntervals.set(roundId, interval);
  }
}
