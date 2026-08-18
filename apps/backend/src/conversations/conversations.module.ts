import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../common/tenant/tenant.module';
import { Conversation } from './conversation.entity';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [
    TenantModule,
    // Registra la entidad para que TypeORM conozca su metadata --
    // necesario aunque el acceso real a datos pase por
    // TenantContextService.manager y no por un Repository inyectado.
    TypeOrmModule.forFeature([Conversation]),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
