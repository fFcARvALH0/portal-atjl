'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/modules/legislation.js
 * ════════════════════════════════════════════════════════════════════
 * Módulo de Legislação: CRUD completo de Leis e Artigos sobre
 * Netlify Blobs, com histórico de versões, auditoria, cache em
 * memória e limpeza de dados dependentes (relações, favoritos).
 *
 * Extraído de lib/entities.js para separar claramente as duas
 * grandes entidades de negócio: Legislação e Jurisprudência.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('../db');
const { STORES } = require('../config');
const { logarAuditoria } = require('./audit');
const { guardarVersao } = require('./versioning');
const { criarLogger } = require('../shared/logger');

const log = criarLogger('legislation');

/* ══════════════════════════════════════════════════════════════════
   LEIS
   ══════════════════════════════════════════════════════════════════ */

/**
 * Lista todas as leis ordenadas por data de criação descendente.
 * Usa cache em memória de curta duração (TTL definido em config.js).
 */
async function listarLeis() {
  const cacheKey = 'leis_lista';
  const emCache = db.cacheGet(cacheKey);
  if (emCache) return emCache;
  const leis = await db.listarTudo(STORES.LEIS);
  leis.sort((a, b) => (b.criado || '').localeCompare(a.criado || ''));
  db.cachePut(cacheKey, leis);
  return leis;
}

/**
 * Obtém uma lei pelo seu ID.
 * @param {string} id
 * @returns {object|null}
 */
async function obterLei(id) {
  const leis = await listarLeis();
  return leis.find((l) => l.id === id) || null;
}

/**
 * Cria uma nova lei.
 * @param {object} dados     - Campos da lei (sanitizados pelo caller)
 * @param {string} utilizador - Username de quem cria
 */
async function criarLei(dados, utilizador) {
  const agora = new Date().toISOString();
  const lei = Object.assign({}, dados, {
    id: db.gerarId(), criado: agora, atualizado: agora, criadoPor: utilizador
  });
  await db.inserir(STORES.LEIS, lei);
  db.invalidarCache(['leis_lista']);
  await logarAuditoria(utilizador, 'criar', 'Lei', lei.id, `Lei "${lei.numero}" criada.`);
  log.info('Lei criada', { id: lei.id, numero: lei.numero, utilizador });
  return lei;
}

/**
 * Atualiza uma lei existente (guarda versão anterior antes).
 */
async function atualizarLei(id, dados, utilizador) {
  const todas = await db.listarTudo(STORES.LEIS);
  const atual = todas.find((l) => l.id === id);
  if (!atual) throw new Error('Lei não encontrada.');
  await guardarVersao('Lei', id, atual, utilizador);
  const nova = Object.assign({}, atual, dados, { atualizado: new Date().toISOString() });
  await db.substituir(STORES.LEIS, 'id', id, nova);
  db.invalidarCache(['leis_lista']);
  await logarAuditoria(utilizador, 'editar', 'Lei', id, `Lei "${nova.numero}" atualizada.`);
  return nova;
}

/**
 * Elimina uma lei e todos os seus artigos, relações e favoritos dependentes.
 */
async function eliminarLei(id, utilizador) {
  const todas = await db.listarTudo(STORES.LEIS);
  const atual = todas.find((l) => l.id === id);
  if (!atual) return;
  await guardarVersao('Lei', id, atual, utilizador);
  await db.remover(STORES.LEIS, 'id', id);

  // Artigos da lei
  const artigos = (await db.listarTudo(STORES.ARTIGOS)).filter((a) => a.leiId === id);
  const idsArtigos = artigos.map((a) => a.id);
  await db.removerVarios(STORES.ARTIGOS, 'leiId', [id]);

  // Limpeza de dados dependentes (relações e favoritos órfãos)
  if (idsArtigos.length) await db.removerVarios(STORES.RELACOES, 'artigoId', idsArtigos);
  await db.removerVarios(STORES.FAVORITOS, 'entidadeId', [id].concat(idsArtigos));

  db.invalidarCache(['leis_lista', `artigos_${id}`]);
  await logarAuditoria(utilizador, 'eliminar', 'Lei', id,
    `Lei "${atual.numero}" eliminada (com ${artigos.length} artigos).`);
  log.info('Lei eliminada', { id, numero: atual.numero, artigosEliminados: artigos.length });
}

/* ══════════════════════════════════════════════════════════════════
   ARTIGOS
   ══════════════════════════════════════════════════════════════════ */

/**
 * Lista os artigos de uma lei específica, ordenados por campo 'ordem'.
 */
async function listarArtigos(leiId) {
  const cacheKey = `artigos_${leiId}`;
  const emCache = db.cacheGet(cacheKey);
  if (emCache) return emCache;
  const artigos = (await db.listarTudo(STORES.ARTIGOS))
    .filter((a) => a.leiId === leiId)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  db.cachePut(cacheKey, artigos);
  return artigos;
}

/**
 * Lista todos os artigos de todas as leis (usado pela pesquisa).
 */
async function listarTodosArtigos() {
  return db.listarTudo(STORES.ARTIGOS);
}

/**
 * Cria um novo artigo.
 */
async function criarArtigo(dados, utilizador) {
  const artigo = Object.assign({}, dados, {
    id: db.gerarId(), atualizado: new Date().toISOString()
  });
  await db.inserir(STORES.ARTIGOS, artigo);
  db.invalidarCache([`artigos_${artigo.leiId}`]);
  await logarAuditoria(utilizador, 'criar', 'Artigo', artigo.id, `Artigo "${artigo.numero}" criado.`);
  return artigo;
}

/**
 * Atualiza um artigo existente.
 */
async function atualizarArtigo(id, dados, utilizador) {
  const todos = await db.listarTudo(STORES.ARTIGOS);
  const atual = todos.find((a) => a.id === id);
  if (!atual) throw new Error('Artigo não encontrado.');
  await guardarVersao('Artigo', id, atual, utilizador);
  const novo = Object.assign({}, atual, dados, { atualizado: new Date().toISOString() });
  await db.substituir(STORES.ARTIGOS, 'id', id, novo);
  db.invalidarCache([`artigos_${novo.leiId}`]);
  await logarAuditoria(utilizador, 'editar', 'Artigo', id, `Artigo "${novo.numero}" atualizado.`);
  return novo;
}

/**
 * Elimina um artigo e dados dependentes (relações, favoritos).
 */
async function eliminarArtigo(id, utilizador) {
  const todos = await db.listarTudo(STORES.ARTIGOS);
  const atual = todos.find((a) => a.id === id);
  if (!atual) return;
  await guardarVersao('Artigo', id, atual, utilizador);
  await db.remover(STORES.ARTIGOS, 'id', id);
  await db.remover(STORES.RELACOES, 'artigoId', id);
  await db.remover(STORES.FAVORITOS, 'entidadeId', id);
  db.invalidarCache([`artigos_${atual.leiId}`]);
  await logarAuditoria(utilizador, 'eliminar', 'Artigo', id, `Artigo "${atual.numero}" eliminado.`);
}

/**
 * Substitui em bloco todos os artigos de uma lei (importação).
 * Guarda versão de todos os artigos existentes antes da substituição.
 */
async function importarArtigosEmLote(leiId, listaArtigos, utilizador) {
  const todos = await db.listarTudo(STORES.ARTIGOS);
  const existentes = todos.filter((a) => a.leiId === leiId);

  // Versões dos artigos substituídos
  for (const a of existentes) {
    await guardarVersao('Artigo', a.id, a, utilizador);
  }
  await db.removerVarios(STORES.ARTIGOS, 'leiId', [leiId]);

  // Limpeza de dados dependentes dos artigos removidos
  const idsAntigos = existentes.map((a) => a.id);
  if (idsAntigos.length) {
    await db.removerVarios(STORES.RELACOES, 'artigoId', idsAntigos);
    await db.removerVarios(STORES.FAVORITOS, 'entidadeId', idsAntigos);
  }

  const agora = new Date().toISOString();
  const novosArtigos = listaArtigos.map((a, i) =>
    Object.assign({}, a, { id: db.gerarId(), leiId, ordem: i, atualizado: agora })
  );
  if (novosArtigos.length) await db.inserirVarios(STORES.ARTIGOS, novosArtigos);

  db.invalidarCache([`artigos_${leiId}`]);
  await logarAuditoria(utilizador, 'importar', 'Artigo', leiId,
    `${novosArtigos.length} artigo(s) importados em lote (substituindo ${existentes.length}).`);
  log.info('Importação em lote', { leiId, importados: novosArtigos.length, substituidos: existentes.length });
  return { importados: novosArtigos.length, substituidos: existentes.length };
}

/**
 * Elimina todos os artigos de uma lei em bloco.
 */
async function eliminarTodosArtigosDaLei(leiId, utilizador) {
  const todos = await db.listarTudo(STORES.ARTIGOS);
  const existentes = todos.filter((a) => a.leiId === leiId);
  if (!existentes.length) return { eliminados: 0 };

  for (const a of existentes) await guardarVersao('Artigo', a.id, a, utilizador);
  await db.removerVarios(STORES.ARTIGOS, 'leiId', [leiId]);

  const ids = existentes.map((a) => a.id);
  await db.removerVarios(STORES.RELACOES, 'artigoId', ids);
  await db.removerVarios(STORES.FAVORITOS, 'entidadeId', ids);

  db.invalidarCache([`artigos_${leiId}`]);
  await logarAuditoria(utilizador, 'eliminar', 'Artigo', leiId,
    `${existentes.length} artigo(s) eliminados em lote da lei ${leiId}.`);
  return { eliminados: existentes.length };
}

module.exports = {
  // Leis
  listarLeis, obterLei, criarLei, atualizarLei, eliminarLei,
  // Artigos
  listarArtigos, listarTodosArtigos, criarArtigo, atualizarArtigo, eliminarArtigo,
  importarArtigosEmLote, eliminarTodosArtigosDaLei
};
