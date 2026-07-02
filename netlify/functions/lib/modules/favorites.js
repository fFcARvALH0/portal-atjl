'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/modules/favorites.js
 * ════════════════════════════════════════════════════════════════════
 * Gestão de favoritos por utilizador (leis, artigos, acórdãos).
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('../db');
const { STORES } = require('../config');
const { requerPermissao } = require('./auth');

async function listarFavoritos(token, csrf) {
  const sessao = await requerPermissao(token, csrf, null);
  const todos = await db.listarTudo(STORES.FAVORITOS);
  return todos.filter((f) => f.username === sessao.username);
}

async function adicionarFavorito(token, csrf, tipo, entidadeId, titulo) {
  const sessao = await requerPermissao(token, csrf, null);
  const todos = await db.listarTudo(STORES.FAVORITOS);
  const jaExiste = todos.some(
    (f) => f.username === sessao.username && f.entidadeId === entidadeId
  );
  if (jaExiste) return { ok: true, ignorado: true };
  await db.inserir(STORES.FAVORITOS, {
    id: db.gerarId(),
    username: sessao.username,
    tipo, entidadeId, titulo: titulo || '',
    criado: new Date().toISOString()
  });
  return { ok: true };
}

async function removerFavorito(token, csrf, entidadeId) {
  const sessao = await requerPermissao(token, csrf, null);
  await db.removerPor(STORES.FAVORITOS, (f) =>
    f.username === sessao.username && f.entidadeId === entidadeId
  );
  return { ok: true };
}

module.exports = { listarFavoritos, adicionarFavorito, removerFavorito };
