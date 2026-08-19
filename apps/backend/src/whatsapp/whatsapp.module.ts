import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CryptoModule } from '../common/crypto/crypto.module';
import { AiModule } from '../ai/ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappIncomingProcessor } from './whatsapp-incoming.processor';
import { WHATSAPP_INCOMING_QUEUE } from './whatsapp.constants';

@Module({
  imports: [
    CryptoModule,
    AiModule,
    KnowledgeModule,
    IntegrationsModule,
    BullModule.registerQueue({
      name: WHATSAPP_INCOMING_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    }),
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappIncomingProcessor],
  // Reexporta el BullModule de la cola para que HealthModule pueda
  // inyectar la misma Queue y chequear la conexion real a Redis sin
  // abrir una segunda conexion aparte.
  exports: [BullModule],
})
export class WhatsappModule {}
