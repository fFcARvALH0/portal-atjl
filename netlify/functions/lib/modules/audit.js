'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/modules/audit.js
 * ════════════════════════════════════════════════════════════════════
 * Registo de auditoria: toda a ação de escrita (criar/editar/eliminar/
 * importar/login) é registada na store "auditoria", com timestamp,
 * utilizador, ação, entidade afetada e detalhes legíveis.
 *
 * MELHORIA: a lógica de truncagem "lazy" foi extraída para
 * lib/shared/store-truncation.js (DRY — era duplicada aqui e em
 * versioning.js). O comportamento mantém-se idêntico.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('../db');
const { STORES } = require('../config');
const { criarTruncador } = require('../shared/store-truncation');
const { criarLogger } = require('../shared/logger');

const log = criarLogger('audit');

/** Máximo de entradas a manter; truncagem a cada 5 minutos (por instância). */
const _truncarSeNecessario = criarTruncador(
  STORES.AUDITORIA,
  2000,
  5 * 60 * 1000
);

/**
 * Regista uma entrada de auditoria de forma assíncrona e não-bloqueante.
 * Nunca lança exceção — a auditoria nunca impede a operação principal.
 *
 * @param {string} utilizador  - Username do utilizador que executou a ação
 * @param {string} accao       - Código da ação (ex: 'criar', 'editar', 'login_sucesso')
 * @param {string} entidade    - Tipo de entidade afetada (ex: 'Lei', 'Artigo')
 * @param {string} entidadeId  - ID da entidade afetada
 * @param {string} detalhes    - Descrição legível da ação
 */
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
    // Truncagem lazy em background — não bloqueia a operação principal.
    _truncarSeNecessario(db).catch((e) =>
      log.error('Erro na truncagem lazy', e)
    );
  } catch (e) {
    log.error('Falha ao gravar auditoria', e);
  }
}

/**
 * Lista entradas de auditoria com filtros e limite opcionais.
 *
 * @param {object} filtros
 * @param {string} [filtros.utilizador] - Filtrar por username
 * @param {string} [filtros.entidade]   - Filtrar por tipo de entidade
 * @param {number} [filtros.limite]     - Número máximo de resultados (default: 200)
 */
async function obterAuditoria(filtros) {
  filtros = filtros || {};
  let linhas = await db.listarTudo(STORES.AUDITORIA);
  linhas.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  if (filtros.utilizador) linhas = linhas.filter((l) => l.utilizador === filtros.utilizador);
  if (filtros.entidade) linhas = linhas.filter((l) => l.entidade === filtros.entidade);
  return linhas.slice(0, filtros.limite || 200);
}

module.exports = { logarAuditoria, obterAuditoria };
