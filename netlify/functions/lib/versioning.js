'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/versioning.js  (equivalente a Versioning.gs)
 * ════════════════════════════════════════════════════════════════════
 * Antes de qualquer atualização ou eliminação, o estado anterior
 * completo é gravado na tabela "versoes". Permite listar o histórico
 * de uma entidade e restaurar uma versão anterior.
 *
 * CORREÇÃO: tal como acontecia em audit.js antes da correção lá
 * aplicada, esta store nunca era truncada — cresce para sempre a cada
 * edição/eliminação, com o mesmo risco de o blob ultrapassar os 5 MB
 * do Netlify Blobs. Foi adicionada a mesma truncagem "lazy": após cada
 * inserção, verifica (no máximo uma vez a cada INTERVALO_TRUNCAGEM_MS)
 * se o total de entradas excede MAX_ENTRADAS e, em caso afirmativo,
 * descarta as mais antigas. Corre em background — nunca bloqueia a
 * operação principal.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('./db');
const { STORES } = require('./config');
const auth = require('./auth');

/** Número máximo de entradas a manter na store de versões. */
const MAX_ENTRADAS = 2000;

/** Intervalo mínimo entre truncagens (evita escritas excessivas). */
const INTERVALO_TRUNCAGEM_MS = 5 * 60 * 1000; // 5 minutos

let _ultimaTruncagem = 0;

async function _truncarSeNecessario() {
  const agora = Date.now();
  if (agora - _ultimaTruncagem < INTERVALO_TRUNCAGEM_MS) return;
  _ultimaTruncagem = agora;
  try {
    const lista = await db.listarTudo(STORES.VERSOES);
    if (lista.length <= MAX_ENTRADAS) return;
    // Ordenar por timestamp descendente e manter apenas as mais recentes.
    lista.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    const truncada = lista.slice(0, MAX_ENTRADAS);
    await db.gravarTudo(STORES.VERSOES, truncada);
    console.info(`[versioning] Store truncada: ${lista.length} → ${truncada.length} entradas.`);
  } catch (e) {
    console.error('[versioning] Falha ao truncar store de versões:', e.message);
  }
}

async function guardarVersao(tipo, entidadeId, snapshot, utilizador) {
  await db.inserir(STORES.VERSOES, {
    id: db.gerarId(),
    tipo,
    entidadeId,
    timestamp: new Date().toISOString(),
    utilizador: utilizador || '—',
    snapshotJSON: JSON.stringify(snapshot)
  });
  // Truncagem lazy em background — não aguardamos o resultado.
  _truncarSeNecessario().catch((e) => console.error('[versioning] Erro na truncagem lazy:', e.message));
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
