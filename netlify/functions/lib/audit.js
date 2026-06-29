'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/audit.js  (equivalente a Audit.gs)
 * ════════════════════════════════════════════════════════════════════
 * Toda a ação de escrita (criar/editar/eliminar/importar/login) é
 * registada na tabela "auditoria", com timestamp, utilizador, ação,
 * entidade afetada e detalhes legíveis.
 *
 * CORREÇÃO: a store de auditoria nunca era truncada — com uso intenso
 * o blob _all podia ultrapassar os 5 MB do Netlify Blobs e começar a
 * falhar. Foi adicionada uma truncagem "lazy": após cada inserção,
 * verifica (no máximo uma vez a cada INTERVALO_TRUNCAGEM_MS) se o
 * total de entradas excede MAX_ENTRADAS e, em caso afirmativo,
 * descarta as mais antigas, mantendo apenas as MAX_ENTRADAS mais
 * recentes. A truncagem corre em background — nunca bloqueia nem
 * impede a operação principal de concluir.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('./db');
const { STORES } = require('./config');

/** Número máximo de entradas a manter na store de auditoria. */
const MAX_ENTRADAS = 2000;

/** Intervalo mínimo entre truncagens (evita escritas excessivas). */
const INTERVALO_TRUNCAGEM_MS = 5 * 60 * 1000; // 5 minutos

let _ultimaTruncagem = 0;

async function _truncarSeNecessario() {
  const agora = Date.now();
  if (agora - _ultimaTruncagem < INTERVALO_TRUNCAGEM_MS) return;
  _ultimaTruncagem = agora;
  try {
    const lista = await db.listarTudo(STORES.AUDITORIA);
    if (lista.length <= MAX_ENTRADAS) return;
    // Ordenar por timestamp descendente e manter apenas as mais recentes.
    lista.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    const truncada = lista.slice(0, MAX_ENTRADAS);
    await db.gravarTudo(STORES.AUDITORIA, truncada);
    console.info(`[audit] Store truncada: ${lista.length} → ${truncada.length} entradas.`);
  } catch (e) {
    console.error('[audit] Falha ao truncar store de auditoria:', e.message);
  }
}

async function logarAuditoria(utilizador, accao, entidade, entidadeId, detalhes) {
  try {
    await db.inserir(STORES.AUDITORIA, {
      id: db.gerarId(),
      timestamp: new Date().toISOString(),
      utilizador: utilizador || '—',
      accao,
      entidade,
      entidadeId: entidadeId || '',
      detalhes: detalhes || ''
    });
    // Truncagem lazy em background — não aguardamos o resultado.
    _truncarSeNecessario().catch((e) => console.error('[audit] Erro na truncagem lazy:', e.message));
  } catch (e) {
    // A auditoria nunca deve impedir a operação principal de concluir.
    console.error('Falha ao gravar auditoria:', e.message);
  }
}

async function obterAuditoria(filtros) {
  filtros = filtros || {};
  let linhas = await db.listarTudo(STORES.AUDITORIA);
  linhas.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  if (filtros.utilizador) linhas = linhas.filter((l) => l.utilizador === filtros.utilizador);
  if (filtros.entidade) linhas = linhas.filter((l) => l.entidade === filtros.entidade);
  return linhas.slice(0, filtros.limite || 200);
}

module.exports = { logarAuditoria, obterAuditoria };
