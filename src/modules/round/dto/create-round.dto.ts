import {
  IsUUID,
  IsString,
  IsBoolean,
  IsArray,
  IsInt,
  IsOptional,
} from 'class-validator';

export class CreateRoundDto {
  @IsUUID()
  matchId: string;

  @IsString()
  word: string;

  @IsArray()
  @IsBoolean({ each: true }) 
  revealedTiles: boolean[];  

  @IsUUID()
  @IsOptional()
  winnerId?: string | null;

  @IsInt()
  roundNumber: number;
}
