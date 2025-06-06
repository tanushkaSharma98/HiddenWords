import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Match } from './match.entity';
import { Player } from './player.entity';
import { Guess } from './guess.entity';

@Entity()
export class Round {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Match, (match) => match.rounds, { onDelete: 'CASCADE' })
  match: Match;

  @Column()
  word: string;

  @Column('bool', { array: true })
  revealedTiles: boolean[];

  @ManyToOne(() => Player, (player) => player.roundsWon, { nullable: true })
  winner: Player | null;

  @Column()
  roundNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
endedAt: Date | null;

  @OneToMany(() => Guess, (guess) => guess.round)
  guesses: Guess[];
}
