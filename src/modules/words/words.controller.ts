import { Controller, Get, Query } from '@nestjs/common';
import { WordsService } from './words.service';

@Controller('api/words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get()
  getWords(@Query('count') count: string) {
    const num = parseInt(count, 10) || 5;
    return this.wordsService.getRandomWords(num);
  }
}
