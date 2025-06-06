import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Round } from './round.entity';
import { Player } from './player.entity';

@Entity()
export class Guess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Round, (round) => round.guesses, { onDelete: 'CASCADE' })
  round: Round;

  @ManyToOne(() => Player, (player) => player.guesses, { onDelete: 'CASCADE' })
  player: Player;

  @Column()
  guess: string;

  @Column({ default: false })
  isCorrect: boolean;

  @CreateDateColumn()
  timestamp: Date;
}
