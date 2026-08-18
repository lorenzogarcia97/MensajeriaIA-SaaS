import { Module } from '@nestjs/common';
import { TenantModule } from '../common/tenant/tenant.module';
import { AiModule } from '../ai/ai.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeSearchService } from './knowledge-search.service';

@Module({
  imports: [TenantModule, AiModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeSearchService],
  exports: [KnowledgeService, KnowledgeSearchService],
})
export class KnowledgeModule {}
