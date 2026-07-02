'use strict';
/**
 * @deprecated Extraído em lib/modules/legislation.js + lib/modules/jurisprudence.js
 * Este shim mantém compatibilidade com qualquer código que ainda importe entities.js.
 */
const legislation  = require('./modules/legislation');
const jurisprudence = require('./modules/jurisprudence');
module.exports = { ...legislation, ...jurisprudence };
