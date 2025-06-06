import { Body, Controller, Param, Post } from '@nestjs/common';
import { GuessService } from './guess.service';

@Controller('api/guess')
export class GuessController {
  constructor(private readonly guessService: GuessService) {}

  @Post(':roundId')
  async makeGuess(
    @Param('roundId') roundId: string,
    @Body() body: { playerId: string; guess: string }
  ) {
    const guess = await this.guessService.createGuess(roundId, body.playerId, body.guess);
    return {
      message: guess.isCorrect ? 'Correct Guess!' : 'Incorrect Guess',
      guessId: guess.id,
      isCorrect: guess.isCorrect,
    };
  }
}
