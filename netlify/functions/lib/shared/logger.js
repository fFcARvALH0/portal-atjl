'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/shared/logger.js
 * ════════════════════════════════════════════════════════════════════
 * Logger centralizado do lado do servidor.
 * Adiciona contexto estruturado (timestamp, nível, módulo) a todos os
 * registos para facilitar diagnóstico em produção via Netlify Functions
 * logs.
 *
 * Uso:
 *   const logger = require('../shared/logger').criarLogger('auth');
 *   logger.info('Utilizador autenticado', { username });
 *   logger.error('Falha no login', err);
 *   logger.warn('Tentativa suspeita', { ip });
 *   logger.debug('Cache hit', { chave }); // só emite se DEBUG=true
 * ════════════════════════════════════════════════════════════════════
 */

const DEBUG_ATIVO = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

/**
 * Formata uma mensagem de log como JSON estruturado de linha única.
 * O Netlify captura stdout linha a linha — JSON facilita parseamento.
 */
function _formatar(nivel, modulo, msg, dados) {
  const entrada = {
    ts: new Date().toISOString(),
    nivel,
    modulo: modulo || 'app',
    msg
  };
  if (dados != null) {
    if (dados instanceof Error) {
      entrada.erro = { nome: dados.name, mensagem: dados.message };
    } else {
      entrada.dados = dados;
    }
  }
  return JSON.stringify(entrada);
}

/**
 * Cria um logger com contexto de módulo.
 * @param {string} modulo - Nome do módulo (ex: 'auth', 'legislation')
 */
function criarLogger(modulo) {
  return {
    info:  (msg, dados) => console.log(_formatar('INFO',  modulo, msg, dados)),
    warn:  (msg, dados) => console.warn(_formatar('WARN',  modulo, msg, dados)),
    error: (msg, dados) => console.error(_formatar('ERROR', modulo, msg, dados)),
    debug: (msg, dados) => { if (DEBUG_ATIVO) console.log(_formatar('DEBUG', modulo, msg, dados)); }
  };
}

/** Logger genérico da aplicação (sem contexto de módulo). */
const logger = criarLogger('app');

module.exports = { criarLogger, logger };
