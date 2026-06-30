'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/security.js  (equivalente a Security.gs)
 * ════════════════════════════════════════════════════════════════════
 * Sanitização e validação do lado do servidor — defesa em
 * profundidade, nunca confiar apenas no cliente.
 *
 * CORREÇÃO: a sanitização de HTML/JS deixou de ser feita com uma
 * blacklist de regex feita à mão (que era trivial de contornar com
 * vetores como <svg onload=...> sem aspas, <img src=x onerror=...> ou
 * tags aninhadas) e passou a usar a biblioteca sanitize-html. Por
 * omissão removemos todas as tags e atributos, mantendo apenas o
 * texto — para esta aplicação não há necessidade de permitir HTML
 * rico nos campos de texto, pelo que esta é a opção mais segura.
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

const sanitizeHtml = require('sanitize-html');
const { LIMITES_TEXTO } = require('./config');

/** Opções do sanitize-html: nenhuma tag/atributo permitido — só texto. */
const OPCOES_SANITIZACAO = {
  allowedTags: [],
  allowedAttributes: {},
  // O conteúdo de <script>, <style>, etc. é descartado por completo
  // (comportamento por omissão do sanitize-html), não apenas a tag.
  disallowedTagsMode: 'discard'
};

function sanitizarTexto(texto, limite) {
  if (texto === undefined || texto === null) return '';
  let t = String(texto);
  t = sanitizeHtml(t, OPCOES_SANITIZACAO);
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
