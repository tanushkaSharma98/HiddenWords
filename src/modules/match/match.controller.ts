import { Body, Controller, Post, Get, Param, NotFoundException } from '@nestjs/common';
import { CreateMatchDto } from './dto/create-match.dto';
import { MatchService } from './match.service';
import { RoundService } from '../round/round.service';

@Controller('api/match')
export class MatchController {
  constructor(
    private readonly matchService: MatchService,
    private readonly roundService: RoundService,
  ) {}

  @Post('create')
  create(@Body() dto: CreateMatchDto) {
    return this.matchService.createMatch(dto);
  }

  @Get(':matchId')
  async getMatch(@Param('matchId') matchId: string) {
    const match = await this.matchService.findById(matchId);
    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }
    return match;
  }

  @Get(':matchId/rounds')
  async getRoundsByMatchId(@Param('matchId') matchId: string) {
    return this.roundService.getRoundsByMatchId(matchId);
  }
}
