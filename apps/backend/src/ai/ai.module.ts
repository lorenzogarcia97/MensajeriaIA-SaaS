import { Module } from '@nestjs/common';
import { ClaudeService } from './claude.service';
import { VoyageService } from './voyage.service';

@Module({
  providers: [ClaudeService, VoyageService],
  exports: [ClaudeService, VoyageService],
})
export class AiModule {}
