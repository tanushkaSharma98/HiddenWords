import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from 'src/entities/match.entity';
import { Player } from 'src/entities/player.entity';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { WordsModule } from '../words/words.module';
import { RoundModule } from '../round/round.module';
@Module({
  imports: [TypeOrmModule.forFeature([Match, Player]), RoundModule, WordsModule],
  controllers: [MatchController],
  providers: [MatchService],
})
export class MatchModule {}