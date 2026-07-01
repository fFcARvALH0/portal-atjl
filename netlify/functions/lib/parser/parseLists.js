'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser/parseLists.js
 * ════════════════════════════════════════════════════════════════════
 * Deteta marcadores de alínea ("a)", "aa)"), subalínea (numerais
 * romanos minúsculos: "i)", "ii)"…) e itens de lista não ordenada
 * ("•", "*", "—") dentro do corpo de um artigo. É usado por
 * parseNumbers.js, que combina estes marcadores com os de número
 * ("1.", "(1)") para reconstruir a árvore de números/alíneas/subalíneas
 * de um artigo.
 * ════════════════════════════════════════════════════════════════════
 */

const { ITEM_ALINEA, ITEM_BULLET } = require('./patterns');
const { romanParaInt } = require('./helpers');

/**
 * "i)", "ii)", "iii)"… só contam como SUBALÍNEA (numeral romano
 * minúsculo) quando aparecem dentro de uma alínea já aberta — fora
 * desse contexto são indistinguíveis de uma alínea normal ("i" é a
 * 9ª letra do alfabeto) pelo que são tratadas como alínea.
 */
function _pareceRomanoMinusculo(marcador) {
  return /^[ivxlc]+$/.test(marcador) && romanParaInt(marcador.toUpperCase()) !== null;
}

/**
 * Classifica uma linha (já sem indentação) como alínea, subalínea ou
 * item de bullet. `dentroDeAlinea` indica se o contentor aberto mais
 * próximo é uma alínea, o que desambigua marcadores tipo "i)".
 * Devolve null se a linha não corresponder a nenhum marcador conhecido.
 */
function detetarMarcadorLista(linha, dentroDeAlinea) {
  let m = linha.match(ITEM_ALINEA);
  if (m) {
    const marcador = m[1].toLowerCase();
    const tipo = (dentroDeAlinea && _pareceRomanoMinusculo(marcador)) ? 'subalinea' : 'alinea';
    return { tipo, marcador, texto: m[2] };
  }
  m = linha.match(ITEM_BULLET);
  if (m) {
    return { tipo: 'item', marcador: '•', texto: m[1] };
  }
  return null;
}

module.exports = { detetarMarcadorLista };
