import { join } from 'path';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { getPgSslConfig } from './common/config/pg-ssl.util';
import { getRedisConnectionOptions } from './common/config/redis-connection.util';
import { TenantModule } from './common/tenant/tenant.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MockInventoryModule } from './mock-inventory/mock-inventory.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '..', '.env'),
      ],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: getPgSslConfig(process.env.DATABASE_URL),
      autoLoadEntities: true,
      synchronize: false,
    }),
    BullModule.forRoot({
      connection: getRedisConnectionOptions(),
    }),
    TenantModule,
    CryptoModule,
    AuthModule,
    ConversationsModule,
    WhatsappModule,
    KnowledgeModule,
    IntegrationsModule,
    MockInventoryModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
