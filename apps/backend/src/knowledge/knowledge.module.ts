import { Module } from '@nestjs/common';
import { TenantModule } from '../common/tenant/tenant.module';
import { AiModule } from '../ai/ai.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [TenantModule, AiModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
