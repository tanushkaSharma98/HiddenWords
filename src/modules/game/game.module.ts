import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { Match } from '../../entities/match.entity';
import { Player } from '../../entities/player.entity';
import { Round } from '../../entities/round.entity';
import { Guess } from '../../entities/guess.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match, Player, Round, Guess])
  ],
  providers: [GameGateway, GameService],
})
export class GameModule {}