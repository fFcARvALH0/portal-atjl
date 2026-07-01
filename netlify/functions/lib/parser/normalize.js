'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser/normalize.js
 * ════════════════════════════════════════════════════════════════════
 * Normaliza texto bruto (vindo de DOCX/PDF/TXT/MD/HTML) antes de
 * qualquer deteção estrutural:
 *   - remove caracteres invisíveis / Unicode problemático
 *   - junta palavras partidas por hífen de quebra de linha
 *   - colapsa espaços/tabs duplicados e linhas vazias repetidas
 *   - deteta e remove cabeçalhos/rodapés repetidos (típico de PDF)
 *   - remove numeração de página solta
 * Devolve sempre um array de linhas já normalizadas, prontas para os
 * detetores de estrutura.
 * ════════════════════════════════════════════════════════════════════
 */

const { RUIDO } = require('./patterns');

// Caracteres invisíveis/zero-width e variantes problemáticas de espaço.
const INVISIVEIS = /[\u200B-\u200F\u202A-\u202E\uFEFF\u00AD]/g;

/** Limpeza por linha: aspas tipográficas, espaços múltiplos, graus, invisíveis. */
function _limparLinha(linha) {
  return linha
    .replace(INVISIVEIS, '')
    .replace(/\u00A0/g, ' ')                 // nbsp → espaço normal
    .replace(/--/g, '—')
    .replace(/[''‚‛]/g, "'")
    .replace(/[""„‟]/g, '"')
    .replace(/°/g, 'º')
    .replace(/\t+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/[ \t]+$/g, '')
    .trimEnd();
}

/**
 * Junta linhas onde uma palavra foi partida por um hífen de fim-de-linha
 * típico de PDF/DOCX justificado (ex.: "consti-\ntucional" → "constitucional").
 * Só junta quando a linha seguinte começa por minúscula (evita juntar
 * indevidamente travessões de diálogo ou fins de frase com maiúscula).
 */
function _juntarPalavrasPartidas(linhas) {
  const out = [];
  for (let i = 0; i < linhas.length; i++) {
    const atual = linhas[i];
    const m = atual.match(/^(.*[a-zà-ú])-$/);
    const proxima = linhas[i + 1];
    if (m && proxima && /^[a-zà-ú]/.test(proxima.trimStart())) {
      const resto = proxima.replace(/^\s+/, '');
      const partes = resto.split(/\s+/);
      const primeiraPalavra = partes.shift();
      out.push(m[1] + primeiraPalavra);
      linhas[i + 1] = partes.join(' ');
      if (!linhas[i + 1]) { i++; continue; }
      continue;
    }
    out.push(atual);
  }
  return out;
}

/**
 * Deteta linhas curtas que se repetem muitas vezes ao longo do
 * documento (cabeçalhos/rodapés institucionais, títulos repetidos por
 * página) e remove todas as ocorrências exceto a primeira. Só
 * considera candidatas linhas curtas (<120 carateres) para não
 * apanhar parágrafos legítimos que coincidam por acaso.
 */
function _removerCabecalhosRodapesRepetidos(linhas) {
  const contagem = new Map();
  linhas.forEach((l) => {
    const t = l.trim();
    if (t.length >= 4 && t.length <= 120) {
      contagem.set(t, (contagem.get(t) || 0) + 1);
    }
  });
  const total = linhas.length;
  // Heurística: repete-se muitas vezes (>=4) e cobre uma fração
  // significativa do documento → quase certamente cabeçalho/rodapé.
  const limiar = Math.max(4, Math.floor(total / 400));
  const repetidas = new Set();
  contagem.forEach((n, txt) => { if (n >= limiar && n >= 3) repetidas.add(txt); });
  if (!repetidas.size) return linhas;

  const vistos = new Set();
  return linhas.filter((l) => {
    const t = l.trim();
    if (repetidas.has(t)) {
      if (vistos.has(t)) return false;
      vistos.add(t);
      return false; // mesmo a primeira ocorrência de um cabeçalho repetido não é corpo de texto
    }
    return true;
  });
}

/** Remove linhas vazias repetidas, deixando no máximo uma linha em branco consecutiva. */
function _colapsarLinhasVazias(linhas) {
  const out = [];
  let vazias = 0;
  for (const l of linhas) {
    if (!l.trim()) {
      vazias++;
      if (vazias <= 1) out.push('');
    } else {
      vazias = 0;
      out.push(l);
    }
  }
  return out;
}

/** Remove linhas reconhecidas como ruído (números de página, URLs, cabeçalhos do DR, etc.). */
function _removerRuido(linhas) {
  return linhas.filter((l) => {
    const t = l.trim();
    if (!t) return true; // linhas vazias tratadas à parte
    return !RUIDO.some((p) => p.test(t));
  });
}

/**
 * Ponto de entrada do módulo. Recebe texto bruto e devolve um array de
 * linhas normalizadas, livre de artefactos comuns de extração de PDF/DOCX.
 */
function normalizarTexto(textoBruto) {
  let texto = String(textoBruto || '');
  // Normaliza quebras de linha (Windows/Mac → Unix) antes de tudo.
  texto = texto.replace(/\r\n?/g, '\n');

  let linhas = texto.split('\n').map(_limparLinha);
  linhas = _juntarPalavrasPartidas(linhas);
  linhas = _removerRuido(linhas);
  linhas = _removerCabecalhosRodapesRepetidos(linhas);
  linhas = _colapsarLinhasVazias(linhas);

  // Remove espaços em branco nas extremidades do documento.
  while (linhas.length && !linhas[0].trim()) linhas.shift();
  while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();

  return linhas;
}

module.exports = { normalizarTexto, _limparLinha };
