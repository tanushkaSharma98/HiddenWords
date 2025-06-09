import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guess } from 'src/entities/guess.entity';
import { Round } from 'src/entities/round.entity';
import { Player } from 'src/entities/player.entity';

@Injectable()
export class GuessService {
  constructor(
    @InjectRepository(Guess) private readonly guessRepo: Repository<Guess>,
    @InjectRepository(Round) private readonly roundRepo: Repository<Round>,
    @InjectRepository(Player) private readonly playerRepo: Repository<Player>,
  ) {}

  async createGuess(
    roundId: string,
    playerId: string,
    guessText: string,
  ): Promise<Guess> {
    const round = await this.roundRepo.findOne({
      where: { id: roundId },
      relations: ['match', 'winner'],
    });

    if (!round) throw new NotFoundException(`Round ${roundId} not found`);
    if (round.endedAt) throw new Error('Round already ended');

    const player = await this.playerRepo.findOneBy({ id: playerId });
    if (!player) throw new NotFoundException(`Player ${playerId} not found`);

    const isCorrect =
      guessText.trim().toLowerCase() === round.word.toLowerCase();

    const guess = this.guessRepo.create({
      guess: guessText,
      isCorrect,
      round,
      player,
    });

    if (isCorrect) {
      round.endedAt = new Date();
      round.winner = player;
      await this.roundRepo.save(round);
    }

    const savedGuess = await this.guessRepo.save(guess);

    // Log the guess that was created
    console.log('Guess Created:', {
      guess: savedGuess.guess,
      isCorrect: savedGuess.isCorrect,
      playerId: savedGuess.player.id,
      roundId: savedGuess.round.id,
    });

    return savedGuess;
  }
}
