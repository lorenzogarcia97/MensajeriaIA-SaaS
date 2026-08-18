import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
}

// Funcion aparte (no metodo de la clase) porque en un constructor que
// extiende otra clase, TypeScript no permite ejecutar nada antes de
// llamar a super() -- pero SI permite llamar funciones normales dentro
// de la expresion que arma el argumento de super(). Esto tambien nos
// da un mensaje de error claro al arrancar si falta la variable, en
// vez de un fallo confuso mas adelante.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Falta la variable de entorno JWT_SECRET. Revisa tu archivo .env.');
  }
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  // El objeto que retorna esta funcion es lo que Nest deja en
  // request.user -- de ahi lo lee el TenantInterceptor.
  async validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    };
  }
}
