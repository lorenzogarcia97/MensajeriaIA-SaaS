import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { WHATSAPP_INCOMING_QUEUE } from '../whatsapp/whatsapp.constants';

const CHECK_TIMEOUT_MS = 3000;

type CheckResult = { status: 'ok' } | { status: 'error'; message: string };

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectQueue(WHATSAPP_INCOMING_QUEUE) private readonly queue: Queue,
  ) {}

  @Get()
  async check() {
    const [postgres, redis] = await Promise.all([
      this.runCheck(() => this.dataSource.query('SELECT 1')),
      this.runCheck(async () => {
        // La interfaz de cliente que expone bullmq (IRedisClient, para
        // poder soportar tambien node-redis/Bun ademas de ioredis) no
        // declara `ping()` -- `info()` si esta declarado y fuerza el
        // mismo viaje de ida y vuelta real a Redis para confirmar la
        // conexion, no solo lee un flag local en memoria.
        const client = await this.queue.client;
        await client.info();
      }),
    ]);

    const checks = { postgres, redis };
    const healthy = postgres.status === 'ok' && redis.status === 'ok';

    if (!healthy) {
      throw new HttpException({ status: 'error', checks }, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return { status: 'ok', checks };
  }

  // Cada chequeo tiene un timeout propio: si Postgres o Redis estan
  // caidos de verdad (no solo lentos), el driver puede quedarse
  // reintentando en silencio en vez de fallar rapido -- sin este limite
  // /health podria colgarse indefinidamente en vez de reportar el error.
  private async runCheck(fn: () => Promise<unknown>): Promise<CheckResult> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Timeout tras ${CHECK_TIMEOUT_MS}ms`)),
        CHECK_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([fn(), timeout]);
      return { status: 'ok' };
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : String(err) };
    } finally {
      clearTimeout(timer!);
    }
  }
}
