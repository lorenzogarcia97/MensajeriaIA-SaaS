import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    PassportModule,
    // registerAsync (no register): con register(), este objeto se
    // evalua al CARGAR el modulo -- que en Node ocurre antes de que
    // ConfigModule.forRoot() (en AppModule) llegue a leer el .env,
    // porque los imports de un archivo se resuelven antes que el
    // propio codigo de ese archivo. registerAsync usa una factory
    // que Nest invoca mas tarde, durante la resolucion de
    // dependencias, cuando el .env ya esta cargado.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('Falta la variable de entorno JWT_SECRET. Revisa tu archivo .env.');
        }
        return {
          secret,
          signOptions: { expiresIn: '8h' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService],
})
export class AuthModule {}
