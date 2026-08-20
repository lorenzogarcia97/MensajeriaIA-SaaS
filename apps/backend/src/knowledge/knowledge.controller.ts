import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VisionService } from '../ai/vision.service';
import { KnowledgeService } from './knowledge.service';
import { detectFileSourceType, extractTextFromFile } from './document-parser';

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly visionService: VisionService,
  ) {}

  @Post('documents')
  async uploadDocument(@Body() body: { displayName: string; content: string }) {
    return this.knowledgeService.ingestDocument(body.displayName, body.content);
  }

  @Post('documents/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
    }),
  )
  async uploadDocumentFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { displayName?: string },
  ) {
    if (!file) {
      throw new BadRequestException('Falta el archivo a subir.');
    }

    const sourceType = detectFileSourceType(file.originalname, file.mimetype);
    const text = await extractTextFromFile(sourceType, file.buffer, (buffer, mediaType, label) =>
      this.visionService.describeImage(buffer, mediaType, label),
    );
    const displayName = body.displayName?.trim() || file.originalname;

    return this.knowledgeService.ingestDocument(displayName, text, sourceType);
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
