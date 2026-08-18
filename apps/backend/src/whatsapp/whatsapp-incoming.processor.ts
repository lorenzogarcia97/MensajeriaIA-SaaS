import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WhatsappService } from './whatsapp.service';
import { WHATSAPP_INCOMING_QUEUE } from './whatsapp.constants';

@Processor(WHATSAPP_INCOMING_QUEUE)
export class WhatsappIncomingProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappIncomingProcessor.name);

  constructor(private readonly whatsappService: WhatsappService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Procesando job ${job.id} (intento ${job.attemptsMade + 1})`);
    await this.whatsappService.processIncomingWebhook(job.data);
  }

  // Sin esto, un job que falla solo se ve como "se reintenta", sin
  // ninguna pista de POR QUE. Distingue entre "va a reintentar" (warn)
  // y "ya se rindio, esto necesita que alguien lo mire" (error).
  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts ?? 1;

    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Job ${job.id} fallo DEFINITIVAMENTE tras ${job.attemptsMade} intentos: ${error.message}`,
      );
    } else {
      this.logger.warn(
        `Job ${job.id} fallo en el intento ${job.attemptsMade} (se va a reintentar): ${error.message}`,
      );
    }
  }
}
