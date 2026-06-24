'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser.js  (equivalente a Parser.gs)
 * ════════════════════════════════════════════════════════════════════
 * Deteta a estrutura (Título/Capítulo/Secção/Artigo) de um texto de
 * lei importado. A importação final é sempre reprocessada e validada
 * no servidor antes de ser gravada.
 * ════════════════════════════════════════════════════════════════════
 */

const { sanitizarTexto } = require('./security');
const { LIMITES_TEXTO } = require('./config');

const PADROES_PARSER = {
  titulo: /^(T[ÍI]TULO|PARTE|LIVRO)\s+([\dIVXLCivxlc]+|[A-ZÀ-Ú]+)\b[.:]?\s*(.*)/i,
  capitulo: /^CAP[ÍI]TULO\s+([\dIVXLCivxlc]+|[A-ZÀ-Ú]+)\b[.:]?\s*(.*)/i,
  seccao: /^SEC[ÇC][ÃA]O\s+([\dIVXLCivxlc]+|[A-ZÀ-Ú]+)\b[.:]?\s*(.*)/i,
  artigo: /^(?:Artigo|Art\.º?|Art\.)\s*(\d+)[.\u00ba\u00b0]*\s*[-\u2013\u2014]?\s*(.*)/i
};

function analisarDocumento(texto) {
  texto = sanitizarTexto(texto, LIMITES_TEXTO.longo * 5);
  const linhas = String(texto || '').split(/\r?\n/);
  let grupoAtual = null, capAtual = null, secAtual = null, artigoAtual = null;
  const artigos = [];

  const finalizar = () => {
    if (!artigoAtual) return;
    artigos.push({
      numero: 'Artigo ' + artigoAtual.n + '.º',
      titulo: artigoAtual.t,
      texto: artigoAtual.linhas.join('\n').trim(),
      grupoTipo: grupoAtual ? grupoAtual.tipo : null,
      grupoNum: grupoAtual ? grupoAtual.num : null,
      grupoTit: grupoAtual ? grupoAtual.tit : null,
      capNum: capAtual ? capAtual.num : null,
      capTit: capAtual ? capAtual.tit : null,
      secNum: secAtual ? secAtual.num : null,
      secTit: secAtual ? secAtual.tit : null,
      ordem: artigos.length
    });
    artigoAtual = null;
  };

  linhas.forEach((linhaOriginal) => {
    const linha = linhaOriginal.trim();
    if (!linha) { if (artigoAtual) artigoAtual.linhas.push(''); return; }
    let m;
    if ((m = linha.match(PADROES_PARSER.titulo))) { finalizar(); grupoAtual = { tipo: m[1].toUpperCase(), num: m[2], tit: m[3].trim() }; capAtual = null; secAtual = null; return; }
    if ((m = linha.match(PADROES_PARSER.capitulo))) { finalizar(); capAtual = { num: m[1], tit: m[2].trim() }; secAtual = null; return; }
    if ((m = linha.match(PADROES_PARSER.seccao))) { finalizar(); secAtual = { num: m[1], tit: m[2].trim() }; return; }
    if ((m = linha.match(PADROES_PARSER.artigo))) { finalizar(); artigoAtual = { n: m[1], t: m[2].trim(), linhas: [] }; return; }
    if (artigoAtual) artigoAtual.linhas.push(linha);
  });
  finalizar();
  return artigos;
}

module.exports = { analisarDocumento };
