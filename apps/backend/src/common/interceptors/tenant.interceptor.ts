import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ModuleRef, ContextIdFactory } from '@nestjs/core';
import { Observable, from, firstValueFrom } from 'rxjs';
import { DataSource, QueryRunner } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { TenantContextService } from '../tenant/tenant-context.service';

/**
 * IMPORTANTE (segunda version): TenantInterceptor ya NO inyecta
 * TenantContextService por constructor. Hacerlo forzaba a Nest a
 * recrear el interceptor completo en cada request (por depender de
 * un provider request-scoped), y en ese camino especial la
 * inyeccion de DataSource se perdia -- por eso "dataSource" llegaba
 * undefined en tiempo de ejecucion aunque el arranque no mostrara
 * ningun error.
 *
 * La solucion: TenantInterceptor vuelve a ser un singleton normal
 * (igual que AuthService, donde @InjectDataSource() si funciona sin
 * problemas). Para llegar igual a la instancia de TenantContextService
 * que le corresponde a ESTE request especifico, se usa el patron
 * oficial de Nest para este caso: ContextIdFactory.getByRequest()
 * + ModuleRef.resolve(), pedido en el momento exacto que se necesita,
 * no en el constructor.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly moduleRef: ModuleRef,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.user?.tenantId;

    if (!tenantId) {
      return next.handle();
    }

    return from(this.runInTenantTransaction(tenantId, request, next));
  }

  private async runInTenantTransaction(tenantId: string, request: any, next: CallHandler) {
    // Resuelve la MISMA instancia de TenantContextService que Nest le
    // va a inyectar mas adelante al controller/service de este mismo
    // request -- por eso el contextId se saca del propio "request".
    const contextId = ContextIdFactory.getByRequest(request);
    const tenantContext = await this.moduleRef.resolve(
      TenantContextService,
      contextId,
      { strict: false },
    );

    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        [tenantId],
      );

      tenantContext.setQueryRunner(queryRunner);
      tenantContext.setTenantId(tenantId);

      const result = await firstValueFrom(next.handle());

      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
