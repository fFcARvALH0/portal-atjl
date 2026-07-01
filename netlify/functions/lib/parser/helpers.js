'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser/helpers.js
 * ════════════════════════════════════════════════════════════════════
 * Utilitários genéricos partilhados por todos os módulos do parser:
 * conversão de numerais romanos, conversão de ordinais por extenso,
 * geração de identificadores e um logger leve com medição de tempo.
 * Não depende de nenhum outro módulo do parser (camada mais baixa).
 * ════════════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');

/* ── Numerais romanos ─────────────────────────────────────────────── */

const _ROMAN_MAP = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
];

/**
 * Converte um numeral romano (I, IV, XL, MCMXCIV…) em inteiro.
 * Devolve null se inválido OU se o numeral usar repetição não-padrão
 * (ex.: "IIII" — inválido; usa-se "IV").
 */
function romanParaInt(str) {
  if (!str) return null;
  const s = String(str).toUpperCase().trim();
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  let i = 0;
  let total = 0;
  for (const [valor, simbolo] of _ROMAN_MAP) {
    while (s.startsWith(simbolo, i)) {
      total += valor;
      i += simbolo.length;
    }
  }
  if (i !== s.length) return null;
  // Verifica round-trip: converte de volta para romano e compara.
  // Assim "IIII" (→4→ "IV") falha por não corresponder ao original.
  return intParaRoman(total) === s ? total : null;
}

/** Converte um inteiro positivo em numeral romano (uso interno/testes). */
function intParaRoman(num) {
  let n = Number(num);
  if (!Number.isInteger(n) || n <= 0 || n > 3999) return null;
  let out = '';
  for (const [valor, simbolo] of _ROMAN_MAP) {
    while (n >= valor) { out += simbolo; n -= valor; }
  }
  return out;
}

/* ── Ordinais por extenso (português) ─────────────────────────────── */
// Cobre o intervalo tipicamente usado em diplomas (Primeiro…Centésimo,
// incluindo combinações como "Trigésimo Segundo"). Comparação é feita
// sem acentos/maiúsculas para robustez.

const _UNIDADES = {
  'unico': 1, 'único': 1,
  'primeiro': 1, 'segundo': 2, 'terceiro': 3, 'quarto': 4, 'quinto': 5,
  'sexto': 6, 'setimo': 7, 'sétimo': 7, 'oitavo': 8, 'nono': 9
};
const _DEZENAS_EXATAS = {
  'decimo': 10, 'décimo': 10, 'vigesimo': 20, 'vigésimo': 20,
  'trigesimo': 30, 'trigésimo': 30, 'quadragesimo': 40, 'quadragésimo': 40,
  'quinquagesimo': 50, 'quinquagésimo': 50, 'sexagesimo': 60, 'sexagésimo': 60,
  'septuagesimo': 70, 'septuagésimo': 70, 'octogesimo': 80, 'octogésimo': 80,
  'nonagesimo': 90, 'nonagésimo': 90, 'centesimo': 100, 'centésimo': 100
};

function _semAcentos(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Converte um ordinal por extenso ("Décimo Quinto", "Centésimo", "Único")
 * num inteiro. Devolve null se não reconhecido. "Único" devolve 1, mas o
 * chamador deve tratar artigo único como caso especial semântico (sem
 * sucessor numérico esperado).
 */
function ordinalPorExtensoParaInt(raw) {
  if (!raw) return null;
  const partes = String(raw).trim().split(/\s+/).map(_semAcentos).map((p) => p.replace(/[íi]/g, 'i'));
  if (!partes.length) return null;

  if (partes.length === 1) {
    const p = partes[0];
    if (p in _UNIDADES) return _UNIDADES[p];
    if (p in _DEZENAS_EXATAS) return _DEZENAS_EXATAS[p];
    return null;
  }
  if (partes.length === 2) {
    const dez = _DEZENAS_EXATAS[partes[0]];
    const uni = _UNIDADES[partes[1]];
    if (dez !== undefined && uni !== undefined && uni < 10) return dez + uni;
  }
  return null;
}

/* ── Identificadores / slugs ──────────────────────────────────────── */

function gerarIdNo() {
  return 'n_' + crypto.randomBytes(6).toString('hex');
}

function slug(texto) {
  return _semAcentos(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);
}

/* ── Logger leve com medição de tempo ─────────────────────────────── */

function criarLogger(ativo) {
  const inicio = Date.now();
  const eventos = [];
  return {
    log(tipo, detalhe) {
      if (ativo) eventos.push({ t: Date.now() - inicio, tipo, detalhe });
    },
    eventos() { return eventos; },
    tempoDecorridoMs() { return Date.now() - inicio; }
  };
}

module.exports = {
  romanParaInt,
  intParaRoman,
  ordinalPorExtensoParaInt,
  gerarIdNo,
  slug,
  criarLogger,
  _semAcentos
};
