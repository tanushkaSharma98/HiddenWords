import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Player } from './player.entity';
import { Round } from './round.entity';

@Entity()
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Player, (player) => player.matchesAsPlayer1, { onDelete: 'CASCADE' })
  player1: Player;

  @ManyToOne(() => Player, (player) => player.matchesAsPlayer2, { onDelete: 'CASCADE' })
  player2: Player;

  @Column({ default: 0 })
  score1: number;

  @Column({ default: 0 })
  score2: number;

  @Column({ type: 'enum', enum: ['ongoing', 'completed'], default: 'ongoing' })
  status: 'ongoing' | 'completed';

    @ManyToOne(() => Player, { nullable: true })
  winner: Player | null;


  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Round, (round) => round.match)
  rounds: Round[];
}
