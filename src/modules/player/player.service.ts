import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from 'src/entities/player.entity';
import { CreatePlayerDto } from './dto/create-player.dto';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
  ) {}

  async createPlayer(dto: CreatePlayerDto): Promise<Player> {
    const username = dto.username || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
    const player = this.playerRepository.create({ username });
    return await this.playerRepository.save(player);
  }

  async findById(playerId: string): Promise<Player | null> {
    return await this.playerRepository.findOne({ where: { id: playerId } });
  }
}
