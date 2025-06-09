import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from '../../entities/match.entity';
import { Player } from '../../entities/player.entity';
import { Round } from '../../entities/round.entity';
import { GuessModule } from '../guess/guess.module';
import { RoundModule } from '../round/round.module';
import { MatchModule } from '../match/match.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match, Player, Round]),
    GuessModule,
    RoundModule,
    MatchModule
  ],
  providers: [GameGateway, GameService],
})
export class GameModule {}
