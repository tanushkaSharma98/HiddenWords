import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from '../../entities/match.entity';
import { Player } from '../../entities/player.entity';
import { Round } from '../../entities/round.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Match, Player, Round])],
  providers: [GameGateway, GameService],
})
export class GameModule {}
// This module sets up the Game module with the necessary imports and providers.