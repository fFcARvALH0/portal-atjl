'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/modules/jurisprudence.js
 * ════════════════════════════════════════════════════════════════════
 * Módulo de Jurisprudência: CRUD de Acórdãos sobre Netlify Blobs,
 * com histórico de versões, auditoria, cache em memória, limpeza de
 * dados dependentes e vinculação automática a artigos.
 *
 * Extraído de lib/entities.js para separar claramente as duas
 * grandes entidades de negócio: Legislação e Jurisprudência.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('../db');
const { STORES } = require('../config');
const { logarAuditoria } = require('./audit');
const { guardarVersao } = require('./versioning');
const { criarLogger } = require('../shared/logger');

const log = criarLogger('jurisprudence');

/* ══════════════════════════════════════════════════════════════════
   ACÓRDÃOS
   ══════════════════════════════════════════════════════════════════ */

/**
 * Lista todos os acórdãos ordenados por data de criação descendente.
 * Usa cache em memória de curta duração.
 */
async function listarAcordaos() {
  const cacheKey = 'acordaos_lista';
  const emCache = db.cacheGet(cacheKey);
  if (emCache) return emCache;
  const acs = await db.listarTudo(STORES.ACORDAOS);
  acs.sort((a, b) => (b.criado || '').localeCompare(a.criado || ''));
  db.cachePut(cacheKey, acs);
  return acs;
}

/**
 * Obtém um acórdão pelo seu ID.
 * @param {string} id
 * @returns {object|null}
 */
async function obterAcordao(id) {
  const acs = await listarAcordaos();
  return acs.find((a) => a.id === id) || null;
}

/**
 * Cria um novo acórdão e tenta vincular automaticamente a artigos.
 * @param {object} dados     - Campos do acórdão (sanitizados pelo caller)
 * @param {string} utilizador - Username de quem publica
 */
async function criarAcordao(dados, utilizador) {
  const agora = new Date().toISOString();
  const ac = Object.assign({}, dados, {
    id: db.gerarId(), criado: agora, atualizado: agora, criadoPor: utilizador
  });
  await db.inserir(STORES.ACORDAOS, ac);
  db.invalidarCache(['acordaos_lista']);
  await logarAuditoria(utilizador, 'criar', 'Acordao', ac.id, `Acórdão "${ac.numero}" publicado.`);
  log.info('Acórdão criado', { id: ac.id, numero: ac.numero, utilizador });

  // Vinculação automática acórdão ↔ artigos (lazy require para evitar import circular)
  require('./relations').tentarVincularAutomaticamente(ac.id).catch((e) =>
    log.warn('Vinculação automática falhou após criar acórdão', e)
  );
  return ac;
}

/**
 * Atualiza um acórdão existente e re-executa a vinculação automática.
 */
async function atualizarAcordao(id, dados, utilizador) {
  const todos = await db.listarTudo(STORES.ACORDAOS);
  const atual = todos.find((a) => a.id === id);
  if (!atual) throw new Error('Acórdão não encontrado.');
  await guardarVersao('Acordao', id, atual, utilizador);
  const novo = Object.assign({}, atual, dados, { atualizado: new Date().toISOString() });
  await db.substituir(STORES.ACORDAOS, 'id', id, novo);
  db.invalidarCache(['acordaos_lista']);
  await logarAuditoria(utilizador, 'editar', 'Acordao', id, `Acórdão "${novo.numero}" atualizado.`);

  require('./relations').tentarVincularAutomaticamente(id).catch((e) =>
    log.warn('Vinculação automática falhou após atualizar acórdão', e)
  );
  return novo;
}

/**
 * Elimina um acórdão e dados dependentes (relações, favoritos).
 */
async function eliminarAcordao(id, utilizador) {
  const todos = await db.listarTudo(STORES.ACORDAOS);
  const atual = todos.find((a) => a.id === id);
  if (!atual) return;
  await guardarVersao('Acordao', id, atual, utilizador);
  await db.remover(STORES.ACORDAOS, 'id', id);
  await db.remover(STORES.RELACOES, 'acordaoId', id);
  await db.remover(STORES.FAVORITOS, 'entidadeId', id);
  db.invalidarCache(['acordaos_lista']);
  await logarAuditoria(utilizador, 'eliminar', 'Acordao', id, `Acórdão "${atual.numero}" eliminado.`);
  log.info('Acórdão eliminado', { id, numero: atual.numero });
}

module.exports = { listarAcordaos, obterAcordao, criarAcordao, atualizarAcordao, eliminarAcordao };
