'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser/detectArticles.js
 * ════════════════════════════════════════════════════════════════════
 * Reconhece o início de um artigo em qualquer uma das formas aceites
 * (ver patterns.ARTIGO) e normaliza o número capturado para uma forma
 * canónica, mantendo também uma chave de ordenação numérica para que
 * o validador consiga detetar saltos/duplicados independentemente do
 * formato original (romano, extenso, dígito, com ou sem sufixo de
 * letra de artigo inserido — "10.º-A").
 * ════════════════════════════════════════════════════════════════════
 */

const { ARTIGO } = require('./patterns');
const { romanParaInt, ordinalPorExtensoParaInt } = require('./helpers');

const RE_SUFIXO_LETRA = /-\s*([A-ZÀ-Ú])\s*$/i;
const RE_MARCA_ORDINAL = /\.?\s*[º°ª]\s*$/i;
const RE_UNICO = /^[úu]nic[oa]$/i;

/** Capitaliza apenas a primeira letra de cada palavra separada por espaço. */
function _capitalizar(s) {
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/**
 * Normaliza o número bruto capturado pela regex ARTIGO numa estrutura
 * { tipo, valorNum, sufixo, display } onde:
 *   tipo     — 'digito' | 'romano' | 'extenso' | 'unico'
 *   valorNum — inteiro para ordenação/validação (null para 'unico')
 *   sufixo   — letra de artigo inserido (ex.: "A" em "10.º-A"), ou null
 *   display  — número formatado para apresentação ("12.º-A", "Único", "VII")
 */
function normalizarNumeroArtigo(raw) {
  let s = String(raw || '').trim();

  let sufixo = null;
  const mSuf = s.match(RE_SUFIXO_LETRA);
  if (mSuf) {
    sufixo = mSuf[1].toUpperCase();
    s = s.slice(0, mSuf.index).trim();
  }

  // Único / Única
  if (RE_UNICO.test(s)) {
    return { tipo: 'unico', valorNum: null, sufixo, display: 'Único' };
  }

  // Forma com dígitos (com ou sem marca ordinal .º/.°/ª)
  const semOrdinal = s.replace(RE_MARCA_ORDINAL, '').trim();
  if (/^\d+$/.test(semOrdinal)) {
    const valorNum = parseInt(semOrdinal, 10);
    const display = semOrdinal + '.º' + (sufixo ? '-' + sufixo : '');
    return { tipo: 'digito', valorNum, sufixo, display };
  }

  // Forma romana (só letras romanas válidas)
  if (/^[IVXLCDM]+$/i.test(semOrdinal)) {
    const valorNum = romanParaInt(semOrdinal);
    if (valorNum !== null) {
      return { tipo: 'romano', valorNum, sufixo, display: semOrdinal.toUpperCase() + (sufixo ? '-' + sufixo : '') };
    }
  }

  // Forma por extenso (Primeiro, Décimo Quinto, Centésimo…)
  const valorExtenso = ordinalPorExtensoParaInt(semOrdinal);
  if (valorExtenso !== null) {
    return { tipo: 'extenso', valorNum: valorExtenso, sufixo, display: _capitalizar(semOrdinal) + (sufixo ? '-' + sufixo : '') };
  }

  // Fallback: não foi possível interpretar — preserva o texto bruto para
  // não perder o artigo, mas sinaliza tipo desconhecido para validação.
  return { tipo: 'desconhecido', valorNum: null, sufixo, display: s };
}

/**
 * Testa se uma linha (já normalizada) marca o início de um artigo.
 * Devolve null se não corresponder, ou um objeto com o número
 * normalizado, a epígrafe (título) capturada na mesma linha, e o
 * texto "numero" pronto para apresentação ("Artigo 12.º-A").
 */
function detetarArtigo(linha) {
  const m = linha.match(ARTIGO);
  if (!m) return null;
  const info = normalizarNumeroArtigo(m[1]);
  const titulo = (m[2] || '').trim();
  return {
    numeroInfo: info,
    numero: 'Artigo ' + info.display,
    titulo,
    sortKey: info.valorNum
  };
}

module.exports = { detetarArtigo, normalizarNumeroArtigo };
