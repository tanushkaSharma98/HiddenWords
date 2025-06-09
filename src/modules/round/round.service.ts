import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Round } from 'src/entities/round.entity';
import { Match } from 'src/entities/match.entity';
import { Repository } from 'typeorm';
import { WordsService } from 'src/modules/words/words.service';

@Injectable()
export class RoundService {
  constructor(
    @InjectRepository(Round) private readonly roundRepo: Repository<Round>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    private readonly wordsService: WordsService,
  ) {}

  async createAutoRound(matchId: string): Promise<Round> {
    const match = await this.matchRepo.findOne({
      where: { id: matchId },
      relations: ['rounds'],
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    const existingRounds = match.rounds;
    if (existingRounds.length >= 5) {
      throw new Error('Maximum of 5 rounds per match reached');
    }

    const usedWords = existingRounds.map((round) => round.word);
    const availableWords = this.wordsService
      .getAllWords()
      .filter((word) => !usedWords.includes(word));

    if (availableWords.length === 0) {
      throw new Error('No more unique words available for this match');
    }

    const selectedWord = this.getRandomWord(availableWords);

    const round = this.roundRepo.create({
      match,
      word: selectedWord,
      roundNumber: existingRounds.length + 1,
      revealedTiles: new Array(selectedWord.length).fill(false),
      endedAt: null,
      winner: null,
    });

    return this.roundRepo.save(round);
  }

  async getRoundsByMatchId(matchId: string): Promise<Round[]> {
    const match = await this.matchRepo.findOneBy({ id: matchId });
    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    return this.roundRepo.find({
      where: { match: { id: matchId } },
      relations: ['winner'],
      order: { roundNumber: 'ASC' },
    });
  }

  async checkAndEndMatchIfCompleted(matchId: string): Promise<void> {
    const match = await this.matchRepo.findOne({
      where: { id: matchId },
      relations: ['rounds', 'rounds.winner', 'player1', 'player2', 'winner'],
    });

    if (!match || match.status === 'completed') return;

    const rounds = match.rounds;
    if (rounds.length < 5) return;

    const allRoundsCompleted = rounds.every((r) => r.winner !== null);
    if (!allRoundsCompleted) return;

    const player1Wins = rounds.filter((r) => r.winner?.id === match.player1.id).length;
    const player2Wins = rounds.filter((r) => r.winner?.id === match.player2.id).length;

    match.status = 'completed';

    if (player1Wins > player2Wins) {
      match.winner = match.player1;
    } else if (player2Wins > player1Wins) {
      match.winner = match.player2;
    } else {
      match.winner = null; // draw
    }

    await this.matchRepo.save(match);
  }

  async setRoundWinner(roundId: string, playerId: string): Promise<void> {
    const round = await this.roundRepo.findOne({
      where: { id: roundId },
      relations: ['match', 'match.player1', 'match.player2'],
    });

    if (!round) {
      throw new NotFoundException(`Round not found`);
    }
    if (round.winner) return;

    round.winner = { id: playerId } as any;
    round.endedAt = new Date();

    await this.roundRepo.save(round);
    await this.checkAndEndMatchIfCompleted(round.match.id);
  }

  async createNextRoundIfMatchOngoing(matchId: string): Promise<Round | null> {
    const match = await this.matchRepo.findOne({
      where: { id: matchId },
      relations: ['rounds'],
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    if (match.status === 'completed') return null;

    const existingRounds = match.rounds;
    const completedRounds = existingRounds.filter((r) => r.endedAt !== null);

    if (completedRounds.length >= 5) return null;

    const usedWords = existingRounds.map((r) => r.word);
    const availableWords = this.wordsService
      .getAllWords()
      .filter((w) => !usedWords.includes(w));

    if (availableWords.length === 0) {
      throw new Error('No more unique words available');
    }

    const selectedWord = this.getRandomWord(availableWords);

    const newRound = this.roundRepo.create({
      match,
      word: selectedWord,
      roundNumber: existingRounds.length + 1,
      revealedTiles: new Array(selectedWord.length).fill(false),
      endedAt: null,
      winner: null,
    });

    return await this.roundRepo.save(newRound);
  }

  async getRoundById(roundId: string): Promise<Round> {
    const round = await this.roundRepo.findOne({
      where: { id: roundId },
      relations: ['match'],
    });

    if (!round) {
      throw new NotFoundException(`Round with ID ${roundId} not found`);
    }

    return round;
  }

  // 🔄 Utility method for random word selection
  private getRandomWord(words: string[]): string {
    const index = Math.floor(Math.random() * words.length);
    return words[index];
  }

async saveRound(round: Round): Promise<Round> {
  return this.roundRepo.save(round);
}

}
