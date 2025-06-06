import { IsOptional, IsString } from 'class-validator';

export class CreatePlayerDto {
  @IsOptional()
  @IsString()
  username?: string;
}