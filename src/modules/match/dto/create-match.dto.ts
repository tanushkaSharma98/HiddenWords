import { IsUUID } from 'class-validator';

export class CreateMatchDto {
  @IsUUID()
  player1Id: string;

  @IsUUID()
  player2Id: string;
}