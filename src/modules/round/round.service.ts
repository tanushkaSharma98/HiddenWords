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
    const allWords = this.wordsService.getAllWords();
    const availableWords = allWords.filter(word => !usedWords.includes(word));

    if (availableWords.length === 0) {
      throw new Error('No more unique words available for this match');
    }

    const randomIndex = Math.floor(Math.random() * availableWords.length);
    const selectedWord = availableWords[randomIndex];

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
      relations: ['rounds', 'rounds.winner', 'player1', 'player2','winner'],
    });

    if (!match || match.status === 'completed') return;

    const rounds = match.rounds;

    if (rounds.length < 5) return;

    const allRoundsCompleted = rounds.every(round => round.winner !== null);
    if (!allRoundsCompleted) return;

    const player1Wins = rounds.filter(round => round.winner?.id === match.player1.id).length;
    const player2Wins = rounds.filter(round => round.winner?.id === match.player2.id).length;

    match.status = 'completed';

    if (player1Wins > player2Wins) {
      match.winner = match.player1;
    } else if (player2Wins > player1Wins) {
      match.winner = match.player2;
    } else {
      match.winner = null; 
    }

    await this.matchRepo.save(match);
  }

  
  async setRoundWinner(roundId: string, playerId: string): Promise<void> {
    const round = await this.roundRepo.findOne({
      where: { id: roundId },
      relations: ['match', 'match.player1', 'match.player2'],
    });

    if (!round) throw new NotFoundException(`Round not found`);
    if (round.winner) return; // Already set

    round.winner = { id: playerId } as any; 
    round.endedAt = new Date();

    await this.roundRepo.save(round);

    
    await this.checkAndEndMatchIfCompleted(round.match.id);
  }
}
