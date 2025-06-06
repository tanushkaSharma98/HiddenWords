import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { JoinLobbyPayload } from './types';
import { InjectRepository } from '@nestjs/typeorm';
import { Match } from '../../entities/match.entity';
import { Player } from '../../entities/player.entity';
import { Round } from '../../entities/round.entity';
import { Repository } from 'typeorm';

@Injectable()
export class GameService {
  private lobbyQueue: { socket: Socket; playerId: string }[] = [];
  private logger: Logger = new Logger('GameService');

  constructor(
    @InjectRepository(Match)
    private matchRepo: Repository<Match>,

    @InjectRepository(Player)
    private playerRepo: Repository<Player>,

    @InjectRepository(Round)
    private roundRepo: Repository<Round>,
  ) {}

  async addToLobby(socket: Socket, playerId: string) {
  this.logger.log(`Player ${playerId} joined the lobby`);
  this.lobbyQueue.push({ socket, playerId });

  if (this.lobbyQueue.length >= 2) {
    const [p1, p2] = this.lobbyQueue.splice(0, 2);

    try {
      const player1 = await this.playerRepo.findOneBy({ id: p1.playerId });
      const player2 = await this.playerRepo.findOneBy({ id: p2.playerId });

      if (!player1 || !player2) {
        this.logger.error('One or both players not found in DB');
        return;
      }

      

      const match = this.matchRepo.create({
        player1,
        player2,
        status: 'ongoing',
      });
      await this.matchRepo.save(match);

      const word = 'apple';
      const round = this.roundRepo.create({
        match,
        word,
      });
      await this.roundRepo.save(round);

      p1.socket.emit('startRound', {
        roundId: round.id,
        wordLength: word.length,
      });
      p2.socket.emit('startRound', {
        roundId: round.id,
        wordLength: word.length,
      });

      this.logger.log(`Started match between ${p1.playerId} and ${p2.playerId}`);
    } catch (error) {
      this.logger.error('Error starting match:', error);
    }
  }
}

  handleDisconnect(client: Socket) {
    this.lobbyQueue = this.lobbyQueue.filter(p => p.socket.id !== client.id);
    this.logger.warn(`Removed player from lobby due to disconnect: ${client.id}`);
  }
}