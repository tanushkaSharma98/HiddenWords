import { Body, Controller, Post, Get, Param, NotFoundException } from '@nestjs/common';
import { PlayerService } from './player.service';
import { CreatePlayerDto } from './dto/create-player.dto';

@Controller('api/player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post('create')
  async create(@Body() dto: CreatePlayerDto) {
    const player = await this.playerService.createPlayer(dto);
    return {
      message: 'Player created successfully',
      playerId: player.id,
      username: player.username,
    };
  }

  @Get(':playerId')
  async getPlayer(@Param('playerId') playerId: string) {
    const player = await this.playerService.findById(playerId);
    if (!player) {
      throw new NotFoundException(`Player with ID ${playerId} not found`);
    }
    return player;
  }
}
