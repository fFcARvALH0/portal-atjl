'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/versioning.js  (equivalente a Versioning.gs)
 * ════════════════════════════════════════════════════════════════════
 * Antes de qualquer atualização ou eliminação, o estado anterior
 * completo é gravado na tabela "versoes". Permite listar o histórico
 * de uma entidade e restaurar uma versão anterior.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('./db');
const { STORES } = require('./config');
const auth = require('./auth');

async function guardarVersao(tipo, entidadeId, snapshot, utilizador) {
  await db.inserir(STORES.VERSOES, {
    id: db.gerarId(),
    tipo,
    entidadeId,
    timestamp: new Date().toISOString(),
    utilizador: utilizador || '—',
    snapshotJSON: JSON.stringify(snapshot)
  });
}

async function listarVersoes(token, csrf, tipo, entidadeId) {
  await auth.requerPermissao(token, csrf, null);
  const lista = await db.listarTudo(STORES.VERSOES);
  return lista
    .filter((v) => v.tipo === tipo && v.entidadeId === entidadeId)
    .map((v) => {
      let snapshot;
      try {
        snapshot = JSON.parse(v.snapshotJSON);
      } catch {
        snapshot = null; // snapshotJSON corrompido — devolver null em vez de crashar
      }
      return { id: v.id, timestamp: v.timestamp, utilizador: v.utilizador, snapshot };
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

async function restaurarVersao(token, csrf, tipo, versaoId, atualizarLei, atualizarArtigo, atualizarAcordao) {
  const sessao = await auth.requerPermissao(token, csrf, 'restaurar_versao');
  const versoes = await db.listarTudo(STORES.VERSOES);
  const v = versoes.find((x) => x.id === versaoId);
  if (!v) throw new Error('Versão não encontrada.');
  let snap;
  try {
    snap = JSON.parse(v.snapshotJSON);
  } catch {
    throw new Error('Snapshot da versão está corrompido e não pode ser restaurado.');
  }

  if (tipo === 'Lei') return atualizarLei(snap.id, snap, sessao.username);
  if (tipo === 'Artigo') return atualizarArtigo(snap.id, snap, sessao.username);
  if (tipo === 'Acordao') return atualizarAcordao(snap.id, snap, sessao.username);
  throw new Error('Tipo de entidade desconhecido.');
}

module.exports = { guardarVersao, listarVersoes, restaurarVersao };
