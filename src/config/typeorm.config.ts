import { DataSource } from 'typeorm';
import { Player } from '../entities/player.entity';
import { Match } from '../entities/match.entity';
import { Round } from '../entities/round.entity';
import { Guess } from '../entities/guess.entity';
import * as path from 'path';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'tanu1234',
  database: 'hidden_words',
  synchronize: false,
  migrations: [path.join(__dirname, 'migrations', '*.js')],
  entities: [Player, Match, Round, Guess],
});
