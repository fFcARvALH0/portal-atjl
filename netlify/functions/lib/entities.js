'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/entities.js  (equivalente à parte de Leis/Artigos/Acordãos de Database.gs)
 * ════════════════════════════════════════════════════════════════════
 * CRUD de Leis, Artigos e Acórdãos sobre Netlify Blobs, com:
 *   - histórico de versões antes de cada UPDATE/DELETE (Versioning)
 *   - registo de auditoria em cada escrita (Audit)
 *   - invalidação de cache de listas (db.invalidarCache)
 *   - vinculação automática acórdão↔artigos após criar/editar acórdão
 *     (ver lib/relacoes.js, chamado em runtime para evitar import
 *     circular)
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('./db');
const { STORES } = require('./config');
const { logarAuditoria } = require('./audit');
const { guardarVersao } = require('./versioning');

/* ── LEIS ──────────────────────────────────────────────────────── */

async function listarLeis() {
  const cacheKey = 'leis_lista';
  const emCache = db.cacheGet(cacheKey);
  if (emCache) return emCache;
  const leis = await db.listarTudo(STORES.LEIS);
  leis.sort((a, b) => (b.criado || '').localeCompare(a.criado || ''));
  db.cachePut(cacheKey, leis);
  return leis;
}

async function obterLei(id) {
  const leis = await listarLeis();
  return leis.find((l) => l.id === id) || null;
}

async function criarLei(dados, utilizador) {
  const agora = new Date().toISOString();
  const lei = Object.assign({}, dados, { id: db.gerarId(), criado: agora, atualizado: agora, criadoPor: utilizador });
  await db.inserir(STORES.LEIS, lei);
  db.invalidarCache(['leis_lista']);
  await logarAuditoria(utilizador, 'criar', 'Lei', lei.id, 'Lei "' + lei.numero + '" criada.');
  return lei;
}

async function atualizarLei(id, dados, utilizador) {
  const todas = await db.listarTudo(STORES.LEIS);
  const atual = todas.find((l) => l.id === id);
  if (!atual) throw new Error('Lei não encontrada.');
  await guardarVersao('Lei', id, atual, utilizador);
  const nova = Object.assign({}, atual, dados, { atualizado: new Date().toISOString() });
  await db.substituir(STORES.LEIS, 'id', id, nova);
  db.invalidarCache(['leis_lista']);
  await logarAuditoria(utilizador, 'editar', 'Lei', id, 'Lei "' + nova.numero + '" atualizada.');
  return nova;
}

async function eliminarLei(id, utilizador) {
  const todas = await db.listarTudo(STORES.LEIS);
  const atual = todas.find((l) => l.id === id);
  if (!atual) return;
  await guardarVersao('Lei', id, atual, utilizador);
  await db.remover(STORES.LEIS, 'id', id);
  const artigos = (await db.listarTudo(STORES.ARTIGOS)).filter((a) => a.leiId === id);
  await db.removerVarios(STORES.ARTIGOS, 'leiId', [id]);
  db.invalidarCache(['leis_lista', 'artigos_' + id]);
  await logarAuditoria(utilizador, 'eliminar', 'Lei', id, 'Lei "' + atual.numero + '" eliminada (com ' + artigos.length + ' artigos).');
}

/* ── ARTIGOS ───────────────────────────────────────────────────── */

async function listarArtigos(leiId) {
  const cacheKey = 'artigos_' + leiId;
  const emCache = db.cacheGet(cacheKey);
  if (emCache) return emCache;
  const artigos = (await db.listarTudo(STORES.ARTIGOS))
    .filter((a) => a.leiId === leiId)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  db.cachePut(cacheKey, artigos);
  return artigos;
}

async function listarTodosArtigos() {
  return db.listarTudo(STORES.ARTIGOS);
}

async function criarArtigo(dados, utilizador) {
  const artigo = Object.assign({}, dados, { id: db.gerarId(), atualizado: new Date().toISOString() });
  await db.inserir(STORES.ARTIGOS, artigo);
  db.invalidarCache(['artigos_' + artigo.leiId]);
  await logarAuditoria(utilizador, 'criar', 'Artigo', artigo.id, 'Artigo "' + artigo.numero + '" criado.');
  return artigo;
}

async function atualizarArtigo(id, dados, utilizador) {
  const todos = await db.listarTudo(STORES.ARTIGOS);
  const atual = todos.find((a) => a.id === id);
  if (!atual) throw new Error('Artigo não encontrado.');
  await guardarVersao('Artigo', id, atual, utilizador);
  const novo = Object.assign({}, atual, dados, { atualizado: new Date().toISOString() });
  await db.substituir(STORES.ARTIGOS, 'id', id, novo);
  db.invalidarCache(['artigos_' + novo.leiId]);
  await logarAuditoria(utilizador, 'editar', 'Artigo', id, 'Artigo "' + novo.numero + '" atualizado.');
  return novo;
}

async function eliminarArtigo(id, utilizador) {
  const todos = await db.listarTudo(STORES.ARTIGOS);
  const atual = todos.find((a) => a.id === id);
  if (!atual) return;
  await guardarVersao('Artigo', id, atual, utilizador);
  await db.remover(STORES.ARTIGOS, 'id', id);
  db.invalidarCache(['artigos_' + atual.leiId]);
  await logarAuditoria(utilizador, 'eliminar', 'Artigo', id, 'Artigo "' + atual.numero + '" eliminado.');
}

async function importarArtigosEmLote(leiId, listaArtigos, utilizador) {
  const todos = await db.listarTudo(STORES.ARTIGOS);
  const existentes = todos.filter((a) => a.leiId === leiId);
  for (const a of existentes) {
    await guardarVersao('Artigo', a.id, a, utilizador);
  }
  await db.removerVarios(STORES.ARTIGOS, 'leiId', [leiId]);

  const agora = new Date().toISOString();
  const novosArtigos = listaArtigos.map((a, i) => Object.assign({}, a, { id: db.gerarId(), leiId, ordem: i, atualizado: agora }));
  if (novosArtigos.length) await db.inserirVarios(STORES.ARTIGOS, novosArtigos);

  db.invalidarCache(['artigos_' + leiId]);
  await logarAuditoria(utilizador, 'importar', 'Artigo', leiId, novosArtigos.length + ' artigo(s) importados em lote (substituindo ' + existentes.length + ').');
  return { importados: novosArtigos.length, substituidos: existentes.length };
}

/* ── ACÓRDÃOS ──────────────────────────────────────────────────── */

async function listarAcordaos() {
  const cacheKey = 'acordaos_lista';
  const emCache = db.cacheGet(cacheKey);
  if (emCache) return emCache;
  const acs = await db.listarTudo(STORES.ACORDAOS);
  acs.sort((a, b) => (b.criado || '').localeCompare(a.criado || ''));
  db.cachePut(cacheKey, acs);
  return acs;
}

async function obterAcordao(id) {
  const acs = await listarAcordaos();
  return acs.find((a) => a.id === id) || null;
}

async function criarAcordao(dados, utilizador) {
  const agora = new Date().toISOString();
  const ac = Object.assign({}, dados, { id: db.gerarId(), criado: agora, atualizado: agora, criadoPor: utilizador });
  await db.inserir(STORES.ACORDAOS, ac);
  db.invalidarCache(['acordaos_lista']);
  await logarAuditoria(utilizador, 'criar', 'Acordao', ac.id, 'Acórdão "' + ac.numero + '" publicado.');
  await require('./relacoes').tentarVincularAutomaticamente(ac.id);
  return ac;
}

async function atualizarAcordao(id, dados, utilizador) {
  const todos = await db.listarTudo(STORES.ACORDAOS);
  const atual = todos.find((a) => a.id === id);
  if (!atual) throw new Error('Acórdão não encontrado.');
  await guardarVersao('Acordao', id, atual, utilizador);
  const novo = Object.assign({}, atual, dados, { atualizado: new Date().toISOString() });
  await db.substituir(STORES.ACORDAOS, 'id', id, novo);
  db.invalidarCache(['acordaos_lista']);
  await logarAuditoria(utilizador, 'editar', 'Acordao', id, 'Acórdão "' + novo.numero + '" atualizado.');
  await require('./relacoes').tentarVincularAutomaticamente(id);
  return novo;
}

async function eliminarAcordao(id, utilizador) {
  const todos = await db.listarTudo(STORES.ACORDAOS);
  const atual = todos.find((a) => a.id === id);
  if (!atual) return;
  await guardarVersao('Acordao', id, atual, utilizador);
  await db.remover(STORES.ACORDAOS, 'id', id);
  db.invalidarCache(['acordaos_lista']);
  await logarAuditoria(utilizador, 'eliminar', 'Acordao', id, 'Acórdão "' + atual.numero + '" eliminado.');
}

module.exports = {
  listarLeis, obterLei, criarLei, atualizarLei, eliminarLei,
  listarArtigos, listarTodosArtigos, criarArtigo, atualizarArtigo, eliminarArtigo, importarArtigosEmLote,
  listarAcordaos, obterAcordao, criarAcordao, atualizarAcordao, eliminarAcordao
};
