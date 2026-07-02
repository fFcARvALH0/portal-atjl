'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/modules/search.js
 * ════════════════════════════════════════════════════════════════════
 * Motor de pesquisa textual multi-entidade (Leis, Artigos, Acórdãos).
 * Suporta pesquisa por termos, sinónimos jurídicos e filtragem por tipo.
 * Preparado para evoluir para pesquisa por relevância / full-text index.
 * ════════════════════════════════════════════════════════════════════
 */

const { sanitizar } = require('../security');
const { listarLeis, listarTodosArtigos } = require('./legislation');
const { listarAcordaos } = require('./jurisprudence');
const { criarLogger } = require('../shared/logger');

const log = criarLogger('search');

/* ── Sinónimos jurídicos ─────────────────────────────────────────── */
const SINONIMOS = {
  'lei': ['decreto', 'portaria', 'despacho', 'resolução', 'regulamento', 'diploma'],
  'decreto': ['lei', 'portaria', 'diploma', 'regulamento'],
  'portaria': ['lei', 'decreto', 'despacho'],
  'artigo': ['norma', 'disposição', 'preceito'],
  'acórdão': ['decisão', 'sentença', 'arresto', 'despacho judicial'],
  'decisão': ['acórdão', 'sentença', 'despacho'],
  'tribunal': ['stj', 'supremo', 'juízo', 'vara'],
  'inconstitucional': ['nulo', 'inválido', 'ilegal'],
  'contrato': ['acordo', 'convenção', 'ajuste'],
  'nulidade': ['invalidade', 'anulação', 'ineficácia']
};

/**
 * Expande um termo com os seus sinónimos jurídicos.
 */
function _expandirSinonimos(termo) {
  const t = termo.toLowerCase();
  return [t, ...(SINONIMOS[t] || [])];
}

/**
 * Normaliza texto para pesquisa: minúsculas, remove acentos, colapsa espaços.
 */
function _normalizar(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Executa pesquisa multi-entidade com suporte a sinónimos.
 *
 * @param {string}   query    - Termo de pesquisa
 * @param {string}   tipo     - 'tudo' | 'leis' | 'artigos' | 'acordaos'
 * @param {number}   limite   - Limite de resultados (default 50)
 * @returns {object} { resultados, total, tempoMs }
 */
async function pesquisar(query, tipo, limite) {
  const inicio = Date.now();
  const q = sanitizar(String(query || '').trim());
  if (!q || q.length < 2) {
    return { resultados: [], total: 0, tempoMs: 0, erro: 'Pesquisa demasiado curta.' };
  }

  const termos = q.split(/\s+/).flatMap(_expandirSinonimos);
  const max = Math.min(Number(limite) || 50, 200);
  const resultados = [];

  function _score(item, campos) {
    const qNorm = _normalizar(q);
    let pontos = 0;
    for (const campo of campos) {
      const val = _normalizar(item[campo] || '');
      if (!val) continue;
      // Correspondência exata da frase completa → pontuação alta
      if (val.includes(qNorm)) pontos += 10;
      // Correspondência de cada termo individualmente
      termos.forEach((t) => { if (val.includes(_normalizar(t))) pontos += 2; });
    }
    return pontos;
  }

  try {
    if (tipo === 'tudo' || tipo === 'leis') {
      const leis = await listarLeis();
      leis.forEach((l) => {
        const s = _score(l, ['numero', 'titulo', 'ementa', 'categorias']);
        if (s > 0) resultados.push({ tipo: 'Lei', score: s, ...l });
      });
    }
    if (tipo === 'tudo' || tipo === 'artigos') {
      const artigos = await listarTodosArtigos();
      artigos.forEach((a) => {
        const s = _score(a, ['numero', 'titulo', 'texto', 'interpretacao']);
        if (s > 0) resultados.push({ tipo: 'Artigo', score: s, ...a });
      });
    }
    if (tipo === 'tudo' || tipo === 'acordaos') {
      const acs = await listarAcordaos();
      acs.forEach((ac) => {
        const s = _score(ac, ['numero', 'relator', 'decisao', 'fundamentacao', 'artigosAplicados']);
        if (s > 0) resultados.push({ tipo: 'Acordao', score: s, ...ac });
      });
    }
  } catch (e) {
    log.error('Erro durante pesquisa', e);
    return { resultados: [], total: 0, tempoMs: Date.now() - inicio, erro: 'Erro interno na pesquisa.' };
  }

  resultados.sort((a, b) => b.score - a.score);
  const total = resultados.length;
  const tempoMs = Date.now() - inicio;
  log.debug('Pesquisa executada', { query: q, tipo, total, tempoMs });
  return { resultados: resultados.slice(0, max), total, tempoMs };
}

module.exports = { pesquisar };
