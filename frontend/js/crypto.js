/**
 * TecniBuy - filtro de contenido
 * El cifrado E2E (ECDH + AES-GCM) se sacó por completo: el chat ahora
 * guarda y muestra los mensajes en texto plano (ver chats.json en el
 * backend). Lo único que queda de este módulo es el filtro de palabras
 * prohibidas, que se sigue usando al enviar un mensaje.
 */

/**
 * Client-side content filter for prohibited words
 * Returns { allowed: boolean, reason?: string }
 */
export function filterContent(text, prohibitedWords = DEFAULT_PROHIBITED_WORDS) {
  const lowerText = text.toLowerCase();
  for (const word of prohibitedWords) {
    if (lowerText.includes(word.toLowerCase())) {
      return { allowed: false, reason: `Contenido no permitido: "${word}"` };
    }
  }
  return { allowed: true };
}

// Default prohibited words list (Spanish Rioplatense)
const DEFAULT_PROHIBITED_WORDS = [
  // Spam/scam indicators
  'whatsapp', 'telegram', 'contactame al', 'escribime al', 'agregame al',
  'envio por', 'pago por', 'transferencia por', 'mercadopago', 'mp ',
  'zelle', 'paypal', 'western union', 'moneygram',
  // External contact
  'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com',
  'mi numero', 'mi celular', 'mi tel', 'llámame', 'llamame',
  // Suspicious
  'oferta exclusiva', 'promoción limitada', 'ultimas unidades', 'últimas unidades',
  'click aqui', 'clic aquí', 'link en bio', 'enlace en bio',
];
