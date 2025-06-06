import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class WordsService {
  private words: string[];

  constructor() {
    const filePath = path.join(process.cwd(), 'src', 'data', 'word.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    this.words = JSON.parse(raw);
  }

  getRandomWords(count = 5): string[] {
    const shuffled = [...this.words].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  
  getAllWords(): string[] {
    return [...this.words]; 
  }
}
