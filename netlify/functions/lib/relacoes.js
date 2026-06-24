'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/relacoes.js  (equivalente a Relacoes.gs)
 * ════════════════════════════════════════════════════════════════════
 * Sempre que um acórdão é criado/editado, analisa o campo
 * "artigosAplicados" e o texto da decisão à procura de padrões
 * "Artigo N.º" e cria automaticamente entradas associando o acórdão
 * aos artigos correspondentes, marcando a relação como "automatica".
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('./db');
const { STORES } = require('./config');

async function tentarVincularAutomaticamente(acordaoId) {
  try {
    const acs = await db.listarTudo(STORES.ACORDAOS);
    const ac = acs.find((a) => a.id === acordaoId);
    if (!ac) return;
    const textoCompleto = [ac.artigosAplicados, ac.decisao, ac.fundamentacao].filter(Boolean).join(' \n ');
    const padrao = /Artigo\s*(\d+)[.\u00ba\u00b0]?/gi;
    const numerosEncontrados = new Set();
    let m;
    while ((m = padrao.exec(textoCompleto)) !== null) numerosEncontrados.add(m[1]);
    if (!numerosEncontrados.size) return;

    const todosArtigos = await db.listarTudo(STORES.ARTIGOS);
    const relacoesExistentes = (await db.listarTudo(STORES.RELACOES)).filter((r) => r.acordaoId === acordaoId && r.automatica === true);
    const jaLigados = new Set(relacoesExistentes.map((r) => r.artigoId));

    const novasRelacoes = [];
    numerosEncontrados.forEach((numero) => {
      todosArtigos
        .filter((a) => String(a.numero).replace(/\D/g, '') === numero)
        .forEach((a) => {
          if (jaLigados.has(a.id)) return;
          novasRelacoes.push({
            id: db.gerarId(), leiId: a.leiId, artigoId: a.id, acordaoId,
            tipo: 'aplicacao', automatica: true, criado: new Date().toISOString()
          });
        });
    });
    if (novasRelacoes.length) await db.inserirVarios(STORES.RELACOES, novasRelacoes);
  } catch (e) {
    console.error('Vinculação automática falhou:', e.message);
  }
}

async function listarRelacoesDoArtigo(artigoId) {
  return (await db.listarTudo(STORES.RELACOES)).filter((r) => r.artigoId === artigoId);
}

async function listarRelacoesDoAcordao(acordaoId) {
  return (await db.listarTudo(STORES.RELACOES)).filter((r) => r.acordaoId === acordaoId);
}

module.exports = { tentarVincularAutomaticamente, listarRelacoesDoArtigo, listarRelacoesDoAcordao };
