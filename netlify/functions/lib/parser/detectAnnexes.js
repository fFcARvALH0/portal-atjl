'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser/detectAnnexes.js
 * ════════════════════════════════════════════════════════════════════
 * Identifica blocos de ANEXO/APÊNDICE (e elementos de suporte como
 * Modelo/Mapa/Quadro/Figura) e separa-os do corpo articulado principal,
 * preservando o texto completo e quaisquer tabelas neles contidas.
 * ════════════════════════════════════════════════════════════════════
 */

const { ANEXO, ELEMENTO_SUPORTE } = require('./patterns');
const { detetarTabelas } = require('./parseTables');
const { gerarIdNo } = require('./helpers');

/**
 * Recebe o array de linhas (objetos { texto, indice }) do documento
 * completo. Devolve { corpo, anexos } onde `corpo` são as linhas que
 * antecedem o primeiro ANEXO (para análise hierárquica normal) e
 * `anexos` é a lista de blocos de anexo já estruturados.
 */
function separarAnexos(linhasComIndice) {
  let primeiraOcorrencia = -1;
  for (let i = 0; i < linhasComIndice.length; i++) {
    if (ANEXO.test(linhasComIndice[i].texto.trim())) { primeiraOcorrencia = i; break; }
  }
  if (primeiraOcorrencia === -1) {
    return { corpo: linhasComIndice, anexos: [] };
  }

  const corpo = linhasComIndice.slice(0, primeiraOcorrencia);
  const resto = linhasComIndice.slice(primeiraOcorrencia);

  // Agrupa por cabeçalho de ANEXO (cada ocorrência inicia um novo bloco).
  const blocos = [];
  let atual = null;
  resto.forEach((l) => {
    const t = l.texto.trim();
    const m = t.match(ANEXO);
    if (m) {
      if (atual) blocos.push(atual);
      atual = { tipo: m[1].toUpperCase(), numero: (m[2] || '').trim() || null, titulo: (m[3] || '').trim(), linhas: [] };
    } else if (atual) {
      atual.linhas.push(l);
    }
  });
  if (atual) blocos.push(atual);

  const anexos = blocos.map((b) => {
    const tabelas = detetarTabelas(b.linhas);
    const indicesTabelas = new Set();
    tabelas.forEach((t) => {
      for (let idx = t.inicioIndice; idx <= t.fimIndice; idx++) indicesTabelas.add(idx);
    });
    const elementosSuporte = [];
    const textoLinhas = [];
    b.linhas.forEach((l) => {
      if (indicesTabelas.has(l.indice)) return;
      const t = l.texto.trim();
      const mSup = t.match(ELEMENTO_SUPORTE);
      if (mSup) {
        elementosSuporte.push({ tipo: mSup[1].toUpperCase(), numero: (mSup[2] || '').trim() || null, titulo: (mSup[3] || '').trim() });
        return;
      }
      textoLinhas.push(l.texto);
    });

    return {
      id: gerarIdNo(),
      tipo: b.tipo,
      numero: b.numero,
      titulo: b.titulo,
      texto: textoLinhas.join('\n').trim(),
      tabelas,
      elementosSuporte
    };
  });

  return { corpo, anexos };
}

module.exports = { separarAnexos };
