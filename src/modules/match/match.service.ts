import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Match } from 'src/entities/match.entity';
import { Player } from 'src/entities/player.entity';
import { Repository } from 'typeorm';
import { CreateMatchDto } from './dto/create-match.dto';
import { RoundService } from '../round/round.service';
import { In } from 'typeorm';

@Injectable()
export class MatchService {
  constructor(
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(Player) private playerRepo: Repository<Player>,
    private readonly roundService: RoundService,
  ) {}

  async createMatch(dto: { player1Id: string; player2Id: string }) {
    const { player1Id, player2Id } = dto;

    // Check for existing ongoing match between these two players (any order)
    const existing = await this.matchRepo.findOne({
      where: [
        { player1: { id: player1Id }, player2: { id: player2Id }, status: In(['pending', 'ongoing', 'active']) },
        { player1: { id: player2Id }, player2: { id: player1Id }, status: In(['pending', 'ongoing', 'active']) }
      ],
      relations: ['player1', 'player2'],
    });
    if (existing) {
      throw new Error('An ongoing match already exists between these two players.');
    }

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

    const firstRound = await this.roundService.createAutoRound(savedMatch.id);

    return {
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
