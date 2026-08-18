import { Module } from '@nestjs/common';
import { MockInventoryController } from './mock-inventory.controller';

@Module({
  controllers: [MockInventoryController],
})
export class MockInventoryModule {}
