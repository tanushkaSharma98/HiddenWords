import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Match } from 'src/entities/match.entity';
import { Player } from 'src/entities/player.entity';
import { Repository } from 'typeorm';
import { CreateMatchDto } from './dto/create-match.dto';
import { RoundService } from '../round/round.service';

@Injectable()
export class MatchService {
  constructor(
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(Player) private playerRepo: Repository<Player>,
    private readonly roundService: RoundService,
  ) {}

  async createMatch(dto: CreateMatchDto) {
    const { player1Id, player2Id } = dto;

    const player1 = await this.playerRepo.findOneBy({ id: player1Id });
    const player2 = await this.playerRepo.findOneBy({ id: player2Id });

    if (!player1 || !player2) {
      throw new NotFoundException('One or both players not found');
    }

    const match = this.matchRepo.create({
      player1,
      player2,
      status: 'ongoing',
    });

    const savedMatch = await this.matchRepo.save(match);

    // Automatically create first round
    const firstRound = await this.roundService.createAutoRound(savedMatch.id);

    return {
      message: 'Match and first round created successfully',
      matchId: savedMatch.id,
      status: savedMatch.status,
      players: [player1.username, player2.username],
      firstRound: {
        roundId: firstRound.id,
        word: firstRound.word,
        roundNumber: firstRound.roundNumber,
      },
    };
  }

  async findById(matchId: string): Promise<Match | null> {
    return await this.matchRepo.findOne({
      where: { id: matchId },
      relations: ['player1', 'player2'],
    });
  }
}
