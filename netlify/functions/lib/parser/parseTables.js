'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser/parseTables.js
 * ════════════════════════════════════════════════════════════════════
 * Deteta blocos de tabela dentro do texto (linhas consecutivas com o
 * mesmo número de colunas, separadas por "|" ou por 2+ espaços/tabs) e
 * converte-os em estrutura { linhas: [[célula,...]] } + Markdown
 * equivalente, para nunca perder informação tabular ao "achatar" o
 * documento em texto corrido.
 * ════════════════════════════════════════════════════════════════════
 */

const { gerarIdNo } = require('./helpers');

function _dividirPipe(linha) {
  return linha.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

function _dividirEspacos(linha) {
  return linha.split(/ {2,}|\t+/).map((c) => c.trim()).filter((c) => c.length);
}

function _candidatoLinhaTabela(linha) {
  const t = linha.trim();
  if (!t) return null;
  if ((t.match(/\|/g) || []).length >= 2) return { celulas: _dividirPipe(t), modo: 'pipe' };
  const porEspacos = _dividirEspacos(t);
  if (porEspacos.length >= 2) return { celulas: porEspacos, modo: 'espacos' };
  return null;
}

function _paraMarkdown(linhas) {
  if (!linhas.length) return '';
  const out = [];
  out.push('| ' + linhas[0].join(' | ') + ' |');
  out.push('| ' + linhas[0].map(() => '---').join(' | ') + ' |');
  for (let i = 1; i < linhas.length; i++) out.push('| ' + linhas[i].join(' | ') + ' |');
  return out.join('\n');
}

/**
 * Procura blocos tabulares num array de linhas { texto, indice }.
 * Devolve um array de tabelas detetadas, cada uma com o intervalo de
 * índices ocupado (para que o chamador remova essas linhas do fluxo de
 * texto normal) e a estrutura/markdown resultante.
 */
function detetarTabelas(linhasComIndice) {
  const tabelas = [];
  let i = 0;
  while (i < linhasComIndice.length) {
    const cand = _candidatoLinhaTabela(linhasComIndice[i].texto);
    if (!cand) { i++; continue; }

    const bloco = [cand.celulas];
    const inicio = i;
    let j = i + 1;
    while (j < linhasComIndice.length) {
      const txt = linhasComIndice[j].texto.trim();
      if (!txt) break;
      const c = _candidatoLinhaTabela(txt);
      if (!c || c.modo !== cand.modo) break;
      // Tolerância de +-1 coluna entre linhas (células vazias por bordo).
      if (Math.abs(c.celulas.length - cand.celulas.length) > 1) break;
      bloco.push(c.celulas);
      j++;
    }

    if (bloco.length >= 2) {
      const nCols = Math.max(...bloco.map((l) => l.length));
      const normalizado = bloco.map((l) => {
        const linha = l.slice();
        while (linha.length < nCols) linha.push('');
        return linha;
      });
      tabelas.push({
        id: gerarIdNo(),
        inicioIndice: linhasComIndice[inicio].indice,
        fimIndice: linhasComIndice[j - 1].indice,
        linhas: normalizado,
        markdown: _paraMarkdown(normalizado)
      });
      i = j;
    } else {
      i++;
    }
  }
  return tabelas;
}

module.exports = { detetarTabelas };
