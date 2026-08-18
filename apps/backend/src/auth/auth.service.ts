import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

/**
 * IMPORTANTE: este servicio consulta la BD ANTES de que exista
 * contexto de tenant -- es literalmente el paso que determina cual
 * es el tenant. Por eso usa la funcion SQL SECURITY DEFINER
 * find_user_for_login() (migracion 008) en vez de pasar por
 * TenantContextService: aqui todavia no hay transaccion de tenant
 * abierta, ni la deberia haber.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM find_user_for_login($1)`,
      [email],
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    // Este es el payload que el TenantInterceptor leera mas adelante
    // como request.user.tenantId en cada peticion autenticada.
    const payload = {
      sub: user.id,
      tenantId: user.tenant_id,
      role: user.role,
    };

    return { access_token: this.jwtService.sign(payload) };
  }
}
