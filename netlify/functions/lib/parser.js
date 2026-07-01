'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser.js
 * ════════════════════════════════════════════════════════════════════
 * Mantido apenas como ponto de compatibilidade: o parser foi
 * reformulado e modularizado em lib/parser/ (normalize, patterns,
 * detectArticles, detectHierarchy, detectAnnexes, parseNumbers,
 * parseLists, parseTables, validators, helpers). Este ficheiro só
 * reexporta a API pública para que `require('./lib/parser')` continue
 * a funcionar sem alterações em netlify/functions/api.js.
 *
 * Ver lib/parser/index.js para a implementação e documentação completas.
 * ════════════════════════════════════════════════════════════════════
 */
module.exports = require('./parser/index');
