'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/security.js  (equivalente a Security.gs)
 * ════════════════════════════════════════════════════════════════════
 * Sanitização e validação do lado do servidor — defesa em
 * profundidade, nunca confiar apenas no cliente.
 *
 * NOTA SOBRE A "NEUTRALIZAÇÃO DE FÓRMULAS":
 *   Essa proteção existia porque os dados eram gravados em Google
 *   Sheets, onde um texto começado por "=" podia ser interpretado
 *   como fórmula. Em Netlify Blobs os dados são gravados como JSON
 *   puro (não há motor de fórmulas), por isso essa classe de risco
 *   deixa de existir — mantém-se apenas por segurança extra caso os
 *   dados sejam alguma vez exportados para uma folha de cálculo.
 * ════════════════════════════════════════════════════════════════════
 */

const { LIMITES_TEXTO } = require('./config');

function sanitizarTexto(texto, limite) {
  if (texto === undefined || texto === null) return '';
  let t = String(texto);
  t = t.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  t = t.replace(/ on\w+="[^"]*"/gi, '').replace(/ on\w+='[^']*'/gi, '');
  t = t.replace(/javascript:/gi, '');
  t = neutralizarFormula(t);
  if (limite && t.length > limite) t = t.substring(0, limite);
  return t.trim();
}

function neutralizarFormula(texto) {
  if (/^[=+\-@]/.test(texto)) return "'" + texto;
  return texto;
}

function sanitizarObjeto(obj, mapaLimites) {
  const limpo = {};
  Object.keys(obj || {}).forEach((k) => {
    const limite = (mapaLimites && mapaLimites[k]) || LIMITES_TEXTO.medio;
    limpo[k] = typeof obj[k] === 'string' ? sanitizarTexto(obj[k], limite) : obj[k];
  });
  return limpo;
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

/** Nome de utilizador: letras, números, ponto, underscore e hífen; 3-40 caracteres. */
function validarUsername(username) {
  return /^[a-zA-Z0-9._-]{3,40}$/.test(String(username || ''));
}

module.exports = { sanitizarTexto, sanitizarObjeto, neutralizarFormula, validarEmail, validarUsername };
