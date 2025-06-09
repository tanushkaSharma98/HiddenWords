import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Player } from './entities/player.entity';
import { Match } from './entities/match.entity';
import { Round } from './entities/round.entity';
import { Guess } from './entities/guess.entity';
import { PlayerModule } from './modules/player/player.module'; 
import { MatchModule } from './modules/match/match.module';
import { GameModule } from './modules/game/game.module';
import { RoundModule } from './modules/round/round.module';
import { WordsModule } from './modules/words/words.module';
import { GuessModule } from './modules/guess/guess.module';
import { GameGateway } from './modules/game/game.gateway';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'tanu1234',
      database: 'hidden_words',
      autoLoadEntities: true,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Player, Match, Round, Guess]),

    PlayerModule,
    MatchModule, 
    GameModule,
      RoundModule,
      WordsModule,
    GuessModule,

  ],
  controllers: [AppController],
  providers: [AppService],
  
  
})
export class AppModule {}


