import { Controller, Get, Headers, NotFoundException, Param, UnauthorizedException } from '@nestjs/common';

const MOCK_API_KEY = 'mock-secret-key-123';

const MOCK_STOCK: Record<string, { name: string; stock: number; price: number }> = {
  taladro: { name: 'Taladro Percutor 500W', stock: 14, price: 29990 },
  martillo: { name: 'Martillo 16oz', stock: 0, price: 5990 },
  'cinta-metrica': { name: 'Cinta metrica 5m', stock: 37, price: 3990 },
};

/**
 * Endpoint falso que simula el inventario de un proveedor externo --
 * existe unicamente para probar el tool calling dinamico (Fase 3) sin
 * depender de un sistema real de terceros. Nada del frontend lo llama:
 * solo lo consume IntegrationsService.executeTool() por HTTP, igual
 * que consultaria cualquier API externa real (misma exigencia de
 * API key por header que tendria un proveedor de verdad).
 */
@Controller('mock-inventory')
export class MockInventoryController {
  @Get('stock/:sku')
  getStock(@Param('sku') sku: string, @Headers('x-api-key') apiKey: string) {
    if (apiKey !== MOCK_API_KEY) {
      throw new UnauthorizedException('API key invalida');
    }

    const item = MOCK_STOCK[sku.toLowerCase()];
    if (!item) {
      throw new NotFoundException(`No se encontro el producto "${sku}" en el inventario.`);
    }

    return { sku: sku.toLowerCase(), ...item };
  }
}
