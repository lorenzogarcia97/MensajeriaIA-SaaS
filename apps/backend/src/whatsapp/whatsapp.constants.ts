// Archivo separado a proposito: si esta constante viviera dentro de
// whatsapp.module.ts, y el controller/processor la importaran DESDE
// ahi, se forma una dependencia circular entre archivos (el modulo
// importa al controller, el controller importa del modulo) que hace
// que Nest reciba "undefined" en el nombre de la cola en tiempo de
// arranque -- exactamente el bug que causaba el error BullQueue_default.
export const WHATSAPP_INCOMING_QUEUE = 'whatsapp-incoming';
