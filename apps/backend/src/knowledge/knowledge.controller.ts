import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('documents')
  async uploadDocument(@Body() body: { displayName: string; content: string }) {
    return this.knowledgeService.ingestDocument(body.displayName, body.content);
  }

  @Get('documents')
  async listDocuments() {
    return this.knowledgeService.listDocuments();
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string) {
    const deleted = await this.knowledgeService.deleteDocument(id);
    if (!deleted) {
      throw new NotFoundException('Documento no encontrado (o no te pertenece).');
    }
    return { deleted: true, id };
  }
}
