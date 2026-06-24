'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/audit.js  (equivalente a Audit.gs)
 * ════════════════════════════════════════════════════════════════════
 * Toda a ação de escrita (criar/editar/eliminar/importar/login) é
 * registada na tabela "auditoria", com timestamp, utilizador, ação,
 * entidade afetada e detalhes legíveis.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('./db');
const { STORES } = require('./config');

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
