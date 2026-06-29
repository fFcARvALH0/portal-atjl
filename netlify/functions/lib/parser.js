'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser.js
 * ════════════════════════════════════════════════════════════════════
 * Deteta a estrutura (Título/Capítulo/Secção/Artigo) de um texto de
 * lei importado. Suporta texto extraído de .docx, .txt, .md e .pdf.
 * A importação final é sempre reprocessada e validada no servidor antes
 * de ser gravada.
 * ════════════════════════════════════════════════════════════════════
 */

const { sanitizarTexto } = require('./security');
const { LIMITES_TEXTO } = require('./config');

// ── Padrões de deteção de estrutura ──────────────────────────────────
// Suportam: numeração romana, arábica, por extenso (ÚNICO, PRIMEIRO…)
// Separadores flexíveis: espaço, ponto, dois pontos, travessão (– —)
const PADROES_PARSER = {
  // TÍTULO I / PARTE II / LIVRO I  — opcionalmente seguido de epígrafe
  titulo: /^(T[ÍI]TULO|PARTE|LIVRO)\s+([^\s\-–—:\.]+)[.\-–—:\s]*(.*)/i,

  // CAPÍTULO I / CAP. II / CAPÍTULO ÚNICO
  capitulo: /^CAP[ÍI]TULO\s+([^\s\-–—:\.]+)[.\-–—:\s]*(.*)/i,

  // SUBSECÇÃO / SUBSEÇÃO (antes de SECÇÃO para não haver colisão)
  subseccao: /^SUB[-\s]?S[EE]C[ÇC][ÃA]O\s+([^\s\-–—:\.]+)[.\-–—:\s]*(.*)/i,

  // SECÇÃO I / SEÇÃO I / SEC. I
  seccao: /^S[EE]C[ÇC][ÃA]O\s+([^\s\-–—:\.]+)[.\-–—:\s]*(.*)/i,

  // Formas aceites de «Artigo»:
  //   Artigo 1.º   Art. 1.º   Art.º 1   ARTIGO 1   Art 1.º —   art. 1.°
  //   Artigo Único / Artigo ÚNICO  (número de texto)
  artigo: /^(?:Artigo|ARTIGO|Art[\.º°]?\s*\.?\s*[º°]?)\s+(\d+|[ÚU]nico|Primeiro|Segundo|Terceiro)[\.º°]*\s*[-–—]?\s*(.*)/i,
};

// ── Linhas a ignorar (artefactos de PDF: números de página, URLs…) ───
const PADROES_IGNORAR = [
  /^[-–—═=_*•·▪◆▸►]+$/,                          // separadores visuais
  /^[Pp][aá]gina\s*\d+(\s*de\s*\d+)?$/i,         // "Página 1 de 10"
  /^\d+\s*\/\s*\d+$/,                             // "1/10"
  /^\d+\s*$(?!.*artigo)/i,                        // número sozinho (número de página)
  /^www\.|https?:\/\//i,                          // URLs
  /^Diário da República|^D\.R\.\s*n[.º°]?/i,     // cabeçalhos do DR
  /^ISSN\s+\d/i,                                  // ISSN
  /^I\s+SÉRIE|^II\s+SÉRIE/i,                     // séries do Diário da República
];

/**
 * Normaliza variantes tipográficas comuns no texto extraído de PDF:
 *  - hífens duplos → travessão
 *  - espaços múltiplos → espaço simples
 *  - aspas tipográficas → aspas neutras
 *  - grau (°) → ordinal masculino (º) para uniformidade
 */
function _normalizar(linha) {
  return linha
    .replace(/--/g, '—')
    .replace(/\s{2,}/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/°/g, 'º')
    .trim();
}

function _deveIgnorar(linha) {
  return PADROES_IGNORAR.some(p => p.test(linha));
}

/** Converte "Único"/"ÚNICO" → "Único" para normalizar o número do artigo. */
function _normalizarNumArtigo(raw) {
  const u = raw.toUpperCase();
  if (u === 'ÚNICO' || u === 'UNICO') return 'Único';
  return raw;
}

function analisarDocumento(texto) {
  texto = sanitizarTexto(texto, LIMITES_TEXTO.longo * 5);
  const linhas = String(texto || '').split(/\r?\n/);

  let grupoAtual   = null;   // TÍTULO / PARTE / LIVRO
  let capAtual     = null;   // CAPÍTULO
  let secAtual     = null;   // SECÇÃO
  let subSecAtual  = null;   // SUBSECÇÃO
  let artigoAtual  = null;
  const artigos    = [];

  const finalizar = () => {
    if (!artigoAtual) return;
    artigos.push({
      numero:    'Artigo ' + artigoAtual.n + '.º',
      titulo:    artigoAtual.t,
      texto:     artigoAtual.linhas.join('\n').trim(),
      grupoTipo: grupoAtual  ? grupoAtual.tipo  : null,
      grupoNum:  grupoAtual  ? grupoAtual.num   : null,
      grupoTit:  grupoAtual  ? grupoAtual.tit   : null,
      capNum:    capAtual    ? capAtual.num      : null,
      capTit:    capAtual    ? capAtual.tit      : null,
      secNum:    secAtual    ? secAtual.num      : null,
      secTit:    secAtual    ? secAtual.tit      : null,
      subSecNum: subSecAtual ? subSecAtual.num   : null,
      subSecTit: subSecAtual ? subSecAtual.tit   : null,
      ordem:     artigos.length,
    });
    artigoAtual = null;
  };

  linhas.forEach((linhaOriginal) => {
    const linha = _normalizar(linhaOriginal);

    // Linha vazia → parágrafo em branco dentro do artigo (preservar estrutura)
    if (!linha) {
      if (artigoAtual) artigoAtual.linhas.push('');
      return;
    }

    // Ignorar artefactos de PDF/cabeçalhos
    if (_deveIgnorar(linha)) return;

    let m;

    if ((m = linha.match(PADROES_PARSER.titulo))) {
      finalizar();
      grupoAtual  = { tipo: m[1].toUpperCase(), num: m[2].trim(), tit: (m[3] || '').trim() };
      capAtual    = null;
      secAtual    = null;
      subSecAtual = null;
      return;
    }

    if ((m = linha.match(PADROES_PARSER.subseccao))) {
      finalizar();
      subSecAtual = { num: m[1].trim(), tit: (m[2] || '').trim() };
      return;
    }

    if ((m = linha.match(PADROES_PARSER.capitulo))) {
      finalizar();
      capAtual    = { num: m[1].trim(), tit: (m[2] || '').trim() };
      secAtual    = null;
      subSecAtual = null;
      return;
    }

    if ((m = linha.match(PADROES_PARSER.seccao))) {
      finalizar();
      secAtual    = { num: m[1].trim(), tit: (m[2] || '').trim() };
      subSecAtual = null;
      return;
    }

    if ((m = linha.match(PADROES_PARSER.artigo))) {
      finalizar();
      artigoAtual = { n: _normalizarNumArtigo(m[1]), t: (m[2] || '').trim(), linhas: [] };
      return;
    }

    // Corpo do artigo atual
    if (artigoAtual) artigoAtual.linhas.push(linha);
  });

  finalizar();
  return artigos;
}

module.exports = { analisarDocumento };
