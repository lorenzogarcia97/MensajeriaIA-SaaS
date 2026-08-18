import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WHATSAPP_INCOMING_QUEUE } from './whatsapp.constants';

@Controller('webhook/whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    @InjectQueue(WHATSAPP_INCOMING_QUEUE) private readonly incomingQueue: Queue,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === expectedToken) {
      this.logger.log('Webhook verificado correctamente por Meta.');
      return challenge;
    }

    this.logger.warn(
      `Intento de verificacion con token invalido (recibido: "${token}").`,
    );
    throw new ForbiddenException('Token de verificacion invalido');
  }

  @Post()
  @HttpCode(200)
  async receive(@Body() body: unknown) {
    // Ya NO se procesa aca: se encola y se responde YA. Meta espera
    // una respuesta rapida -- si tarda, reintenta el mismo envio
    // (duplicando trabajo). El procesamiento real ocurre en
    // WhatsappIncomingProcessor, en su propio worker.
    await this.incomingQueue.add('process-message', body);
    return { status: 'queued' };
  }
}
