import { Module } from '@nestjs/common';
import { CryptoModule } from '../common/crypto/crypto.module';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [CryptoModule],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
