import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { Match } from '../../entities/match.entity';
import { Player } from '../../entities/player.entity';
import { Round } from '../../entities/round.entity';
import { Guess } from '../../entities/guess.entity';
import { RoundModule } from '../round/round.module';
import { GuessModule } from '../guess/guess.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match, Player, Round, Guess]),
    RoundModule,
    GuessModule
  ],
  providers: [GameGateway, GameService],
})
export class GameModule {}