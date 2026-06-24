'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/favoritos.js  (equivalente a Favoritos.gs)
 * ════════════════════════════════════════════════════════════════════
 * Permite que utilizadores registados guardem leis, artigos ou
 * acórdãos como favoritos, para consulta rápida posterior.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('./db');
const { STORES } = require('./config');
const auth = require('./auth');

async function adicionarFavorito(token, csrf, tipo, entidadeId) {
  const sessao = await auth.requerPermissao(token, csrf, null);
  const existentes = await db.listarTudo(STORES.FAVORITOS);
  if (existentes.some((f) => f.utilizador === sessao.username && f.tipo === tipo && f.entidadeId === entidadeId)) {
    return { ok: true, jaExistia: true };
  }
  await db.inserir(STORES.FAVORITOS, { id: db.gerarId(), utilizador: sessao.username, tipo, entidadeId, criado: new Date().toISOString() });
  return { ok: true };
}

async function removerFavorito(token, csrf, tipo, entidadeId) {
  const sessao = await auth.requerPermissao(token, csrf, null);
  const todos = await db.listarTudo(STORES.FAVORITOS);
  const f = todos.find((x) => x.utilizador === sessao.username && x.tipo === tipo && x.entidadeId === entidadeId);
  if (f) await db.remover(STORES.FAVORITOS, 'id', f.id);
  return { ok: true };
}

async function listarFavoritos(token, csrf) {
  const sessao = await auth.requerPermissao(token, csrf, null);
  return (await db.listarTudo(STORES.FAVORITOS)).filter((f) => f.utilizador === sessao.username);
}

module.exports = { adicionarFavorito, removerFavorito, listarFavoritos };
