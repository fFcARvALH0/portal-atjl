'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/modules/versioning.js
 * ════════════════════════════════════════════════════════════════════
 * Histórico de versões: antes de qualquer UPDATE ou DELETE, o estado
 * completo da entidade é guardado na store "versoes". Permite listar
 * o histórico e restaurar versões anteriores.
 *
 * MELHORIA: a lógica de truncagem "lazy" foi extraída para
 * lib/shared/store-truncation.js (DRY — era duplicada aqui e em
 * audit.js). O comportamento mantém-se idêntico.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('../db');
const { STORES } = require('../config');
const auth = require('./auth');
const { criarTruncador } = require('../shared/store-truncation');
const { criarLogger } = require('../shared/logger');

const log = criarLogger('versioning');

/** Máximo de versões a manter; truncagem a cada 5 minutos (por instância). */
const _truncarSeNecessario = criarTruncador(
  STORES.VERSOES,
  2000,
  5 * 60 * 1000
);

/**
 * Guarda um snapshot do estado atual de uma entidade antes de a alterar.
 *
 * @param {string} tipo        - Tipo da entidade ('Lei', 'Artigo', 'Acordao')
 * @param {string} entidadeId  - ID da entidade
 * @param {object} snapshot    - Estado atual completo (antes da alteração)
 * @param {string} utilizador  - Quem está a fazer a alteração
 */
async function guardarVersao(tipo, entidadeId, snapshot, utilizador) {
  await db.inserir(STORES.VERSOES, {
    id: db.gerarId(),
    tipo,
    entidadeId,
    timestamp: new Date().toISOString(),
    utilizador: utilizador || '—',
    snapshotJSON: JSON.stringify(snapshot)
  });
  // Truncagem lazy em background — não bloqueia a operação principal.
  _truncarSeNecessario(db).catch((e) =>
    log.error('Erro na truncagem lazy', e)
  );
}

/**
 * Lista todas as versões históricas de uma entidade.
 *
 * @param {string} token      - Token de sessão
 * @param {string} csrf       - Token CSRF
 * @param {string} tipo       - Tipo da entidade
 * @param {string} entidadeId - ID da entidade
 */
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

/**
 * Restaura uma entidade para uma versão anterior.
 * Apenas administradores têm permissão 'restaurar_versao'.
 *
 * @param {string}   token          - Token de sessão
 * @param {string}   csrf           - Token CSRF
 * @param {string}   tipo           - Tipo da entidade
 * @param {string}   versaoId       - ID da versão a restaurar
 * @param {Function} atualizarLei       - Função de update de Lei
 * @param {Function} atualizarArtigo    - Função de update de Artigo
 * @param {Function} atualizarAcordao   - Função de update de Acórdão
 */
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
