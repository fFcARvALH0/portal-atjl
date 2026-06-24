'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/db.js  (equivalente a Database.gs no projeto Apps Script original)
 * ════════════════════════════════════════════════════════════════════
 * MIGRAÇÃO GOOGLE APPS SCRIPT → NETLIFY:
 *   A versão Apps Script usava Google Sheets como base de dados, com
 *   LockService (concorrência) e CacheService (cache de listagens).
 *
 *   Substituído por Netlify Blobs:
 *     - Cada "tabela" (Leis, Artigos, Acordaos, ...) é um STORE de
 *       Netlify Blobs (key-value), guardado como uma lista JSON sob
 *       uma única chave "_all" — leitura/escrita atómica equivalente.
 *     - Netlify Blobs já garante consistência forte por escrita (não
 *       há LockService explícito porque cada escrita lê + grava a
 *       lista completa numa única operação atómica suportada pela
 *       plataforma).
 *     - Cache de listas públicas substituído por um cache em memória
 *       de curta duração dentro da função (TTL aplicado manualmente).
 *
 * Todas as funções desta camada são assíncronas (Netlify Blobs usa
 * Promises), ao contrário do SpreadsheetApp síncrono original.
 * ════════════════════════════════════════════════════════════════════
 */

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const { STORES, SEGURANCA } = require('./config');

/* ── Cache em memória (processo da function) ───────────────────────
   Equivalente simplificado ao CacheService.getScriptCache() do Apps
   Script. Como funções serverless podem "morrer" e reiniciar a
   qualquer momento, isto é apenas uma otimização de curto prazo;
   a fonte de verdade é sempre o Netlify Blobs. */
const _memCache = new Map();

function _cacheGet(chave) {
  const item = _memCache.get(chave);
  if (!item) return null;
  if (Date.now() > item.exp) { _memCache.delete(chave); return null; }
  return item.valor;
}
function _cachePut(chave, valor, ttlSeg) {
  _memCache.set(chave, { valor, exp: Date.now() + ttlSeg * 1000 });
}
function _cacheDel(chave) {
  _memCache.delete(chave);
}

/* ── Acesso genérico a um "store" (tabela) ──────────────────────── */

function _store(nome) {
  return getStore(nome);
}

function gerarId() {
  return crypto.randomUUID();
}

/** Lê a lista completa de uma tabela (equivalente a _linhasComoObjetos). */
async function listarTudo(nomeStore) {
  const store = _store(nomeStore);
  const raw = await store.get('_all', { type: 'json' });
  return Array.isArray(raw) ? raw : [];
}

/** Grava a lista completa de uma tabela. */
async function _gravarTudo(nomeStore, lista) {
  const store = _store(nomeStore);
  await store.setJSON('_all', lista);
}

/** Adiciona um registo a uma tabela. */
async function inserir(nomeStore, objeto) {
  const lista = await listarTudo(nomeStore);
  lista.push(objeto);
  await _gravarTudo(nomeStore, lista);
  return objeto;
}

/** Insere vários registos de uma vez (equivalente a appendRow em lote). */
async function inserirVarios(nomeStore, objetos) {
  const lista = await listarTudo(nomeStore);
  lista.push(...objetos);
  await _gravarTudo(nomeStore, lista);
  return objetos;
}

/** Atualiza o registo cujo campo `chave` === `valor`, fazendo merge dos novos dados. */
async function atualizar(nomeStore, chave, valor, novosDados) {
  const lista = await listarTudo(nomeStore);
  const idx = lista.findIndex((o) => o[chave] === valor);
  if (idx === -1) return null;
  lista[idx] = Object.assign({}, lista[idx], novosDados);
  await _gravarTudo(nomeStore, lista);
  return lista[idx];
}

/** Substitui por completo o registo encontrado por `chave`/`valor`. */
async function substituir(nomeStore, chave, valor, novoObjeto) {
  const lista = await listarTudo(nomeStore);
  const idx = lista.findIndex((o) => o[chave] === valor);
  if (idx === -1) return null;
  lista[idx] = novoObjeto;
  await _gravarTudo(nomeStore, lista);
  return novoObjeto;
}

/** Remove o(s) registo(s) cujo campo `chave` === `valor`. */
async function remover(nomeStore, chave, valor) {
  const lista = await listarTudo(nomeStore);
  const restantes = lista.filter((o) => o[chave] !== valor);
  const removidos = lista.length - restantes.length;
  if (removidos > 0) await _gravarTudo(nomeStore, restantes);
  return removidos;
}

/** Remove vários registos cujo campo `chave` esteja no array `valores`. */
async function removerVarios(nomeStore, chave, valores) {
  const set = new Set(valores);
  const lista = await listarTudo(nomeStore);
  const restantes = lista.filter((o) => !set.has(o[chave]));
  const removidos = lista.length - restantes.length;
  if (removidos > 0) await _gravarTudo(nomeStore, restantes);
  return removidos;
}

function invalidarCache(chaves) {
  (chaves || []).forEach((k) => _cacheDel(k));
}

module.exports = {
  gerarId,
  listarTudo,
  gravarTudo: _gravarTudo,
  inserir,
  inserirVarios,
  atualizar,
  substituir,
  remover,
  removerVarios,
  invalidarCache,
  cacheGet: _cacheGet,
  cachePut: (k, v, ttl) => _cachePut(k, v, ttl || SEGURANCA.CACHE_LISTAS_TTL_SEG),
  STORES
};
