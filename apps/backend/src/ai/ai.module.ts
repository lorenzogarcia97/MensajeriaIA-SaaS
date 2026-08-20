import { Module } from '@nestjs/common';
import { ClaudeService } from './claude.service';
import { VoyageService } from './voyage.service';
import { VisionService } from './vision.service';

@Module({
  providers: [ClaudeService, VoyageService, VisionService],
  exports: [ClaudeService, VoyageService, VisionService],
})
export class AiModule {}
