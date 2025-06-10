import { Controller, Post, Get, Param } from '@nestjs/common';
import { RoundService } from './round.service';

@Controller('api/round')
export class RoundController {
  constructor(private readonly roundService: RoundService) {}

  
  @Post('create/:matchId')
  async createRound(@Param('matchId') matchId: string) {
    const round = await this.roundService.createAutoRound(matchId);
    return {
      message: 'Round created successfully',
      roundId: round.id,
      roundNumber: round.roundNumber,
      word: round.word,
    };
  }

  @Get('match/:matchId')
  async getRoundsByMatch(@Param('matchId') matchId: string) {
    const rounds = await this.roundService.getRoundsByMatchId(matchId);
    return rounds;
  }
}


//  handles the creation of rounds and fetching rounds by match ID. 