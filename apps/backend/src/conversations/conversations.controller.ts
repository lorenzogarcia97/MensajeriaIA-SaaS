import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  findOpen() {
    // Cuando este handler se ejecuta, el TenantInterceptor YA abrio
    // la transaccion y ya seteo app.current_tenant_id. No hay nada
    // especial que este controller deba hacer al respecto.
    return this.conversationsService.findOpenConversations();
  }
}
