'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/shared/store-truncation.js
 * ════════════════════════════════════════════════════════════════════
 * Utilitário reutilizável de truncagem "lazy" de stores Netlify Blobs.
 * Anteriormente estava duplicado em audit.js e versioning.js — agora
 * existe num único sítio (DRY).
 *
 * Uso:
 *   const { criarTruncador } = require('../shared/store-truncation');
 *   const _truncar = criarTruncador(STORES.AUDITORIA, 2000, 5 * 60 * 1000);
 *   // ...após inserção:
 *   _truncar(db).catch(() => {});
 * ════════════════════════════════════════════════════════════════════
 */

/**
 * Cria uma função de truncagem lazy para um store específico.
 *
 * @param {string}  nomeStore         - Nome do store Netlify Blobs
 * @param {number}  maxEntradas       - Limite máximo de entradas a conservar
 * @param {number}  intervaloMs       - Intervalo mínimo entre truncagens (ms)
 * @param {string}  campoOrdenacao    - Campo usado para ordenar (default: 'timestamp')
 * @returns {Function}                - Função truncadora: (db) => Promise<void>
 */
function criarTruncador(nomeStore, maxEntradas, intervaloMs, campoOrdenacao) {
  const campo = campoOrdenacao || 'timestamp';
  let _ultimaExecucao = 0;

  return async function _truncarSeNecessario(db) {
    const agora = Date.now();
    if (agora - _ultimaExecucao < intervaloMs) return;
    _ultimaExecucao = agora;
    try {
      const lista = await db.listarTudo(nomeStore);
      if (lista.length <= maxEntradas) return;
      lista.sort((a, b) => (b[campo] || '').localeCompare(a[campo] || ''));
      const truncada = lista.slice(0, maxEntradas);
      await db.gravarTudo(nomeStore, truncada);
      console.info(`[${nomeStore}] Store truncada: ${lista.length} → ${truncada.length} entradas.`);
    } catch (e) {
      console.error(`[${nomeStore}] Falha ao truncar store:`, e.message);
    }
  };
}

module.exports = { criarTruncador };
