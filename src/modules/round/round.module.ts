import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Round } from 'src/entities/round.entity';
import { Match } from 'src/entities/match.entity';
import { RoundService } from './round.service';
import { RoundController } from './round.controller';
import { WordsModule } from 'src/modules/words/words.module';

@Module({
  imports: [TypeOrmModule.forFeature([Round, Match]), WordsModule,],
  controllers: [RoundController],
  providers: [RoundService],
  exports: [RoundService],
})
export class RoundModule {}
