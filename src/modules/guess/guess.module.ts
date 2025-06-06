import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guess } from 'src/entities/guess.entity';
import { GuessService } from './guess.service';
import { GuessController } from './guess.controller';
import { Round } from 'src/entities/round.entity';
import { Player } from 'src/entities/player.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Guess, Round, Player])],
  providers: [GuessService],
  controllers: [GuessController],
})
export class GuessModule {}
