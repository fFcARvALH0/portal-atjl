'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  netlify/functions/api.js  (equivalente a Code.gs)
 * ════════════════════════════════════════════════════════════════════
 * MIGRAÇÃO GOOGLE APPS SCRIPT → NETLIFY:
 *   No Apps Script, o cliente chamava funções do servidor diretamente
 *   por nome via `google.script.run.apiX(...)`. No Netlify isso não
 *   existe — usamos uma única Netlify Function ("api") que recebe um
 *   POST com {action, payload}, despacha para a função correspondente
 *   e devolve sempre {ok, dados} ou {ok:false, erro}, exatamente como
 *   o envelope original (ver _envolverApi).
 *
 * O ficheiro netlify.toml redireciona /api/* para esta function, por
 * isso o cliente chama simplesmente fetch('/api', {method:'POST', ...}).
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('./lib/db');
const { STORES, LIMITES_TEXTO, APP_INFO } = require('./lib/config');
const auth = require('./lib/auth');
const entities = require('./lib/entities');
const audit = require('./lib/audit');
const versioning = require('./lib/versioning');
const favoritos = require('./lib/favoritos');
const searchEngine = require('./lib/searchEngine');
const parser = require('./lib/parser');
const pdfExport = require('./lib/pdfExport');
const { sanitizarObjeto } = require('./lib/security');
const { garantirSetupInicial } = require('./lib/seed');

/* ── Mapa de ações públicas (sem autenticação) ────────────────────── */

const ACOES_PUBLICAS = {
  infoPublica: async () => APP_INFO,
  listarLeis: async () => entities.listarLeis(),
  obterLei: async ({ id }) => ({ lei: await entities.obterLei(id), artigos: await entities.listarArtigos(id) }),
  listarAcordaos: async () => entities.listarAcordaos(),
  obterAcordao: async ({ id }) => entities.obterAcordao(id),
  pesquisar: async ({ query, filtros }) => searchEngine.pesquisarPortal(query, filtros),
  analisarDocumento: async ({ texto }) => parser.analisarDocumento(texto),

  login: async ({ username, password }) => auth.autenticar(username, password),
  logout: async ({ token }) => auth.terminarSessao(token),

  exportarLeiPdf: async ({ id }) => pdfExport.exportarLeiParaPdf(id),
  exportarAcordaoPdf: async ({ id }) => pdfExport.exportarAcordaoParaPdf(id)
};

/* ── Mapa de ações autenticadas (recebem token + csrf) ────────────── */

const ACOES_AUTENTICADAS = {
  alterarPassword: async ({ token, csrf, atual, nova }) => auth.alterarPassword(token, csrf, atual, nova),

  criarLei: async ({ token, csrf, dados }) => {
    const sessao = await auth.requerPermissao(token, csrf, 'gerir_leis');
    return entities.criarLei(sanitizarObjeto(dados, { ementa: LIMITES_TEXTO.medio }), sessao.username);
  },
  atualizarLei: async ({ token, csrf, id, dados }) => {
    const sessao = await auth.requerPermissao(token, csrf, 'gerir_leis');
    return entities.atualizarLei(id, sanitizarObjeto(dados, { ementa: LIMITES_TEXTO.medio }), sessao.username);
  },
  eliminarLei: async ({ token, csrf, id }) => {
    const sessao = await auth.requerPermissao(token, csrf, 'gerir_leis');
    await entities.eliminarLei(id, sessao.username);
    return { ok: true };
  },

  criarArtigo: async ({ token, csrf, dados }) => {
    const sessao = await auth.requerPermissao(token, csrf, 'gerir_artigos');
    return entities.criarArtigo(sanitizarObjeto(dados, { texto: LIMITES_TEXTO.longo, interpretacaoTexto: LIMITES_TEXTO.longo }), sessao.username);
  },
  atualizarArtigo: async ({ token, csrf, id, dados }) => {
    const sessao = await auth.requerPermissao(token, csrf, 'gerir_artigos');
    return entities.atualizarArtigo(id, sanitizarObjeto(dados, { texto: LIMITES_TEXTO.longo, interpretacaoTexto: LIMITES_TEXTO.longo }), sessao.username);
  },
  eliminarArtigo: async ({ token, csrf, id }) => {
    const sessao = await auth.requerPermissao(token, csrf, 'gerir_artigos');
    await entities.eliminarArtigo(id, sessao.username);
    return { ok: true };
  },
  importarArtigos: async ({ token, csrf, leiId, listaArtigos }) => {
    const sessao = await auth.requerPermissao(token, csrf, 'importar');
    if (!Array.isArray(listaArtigos) || !listaArtigos.length) throw new Error('Lista de artigos vazia ou inválida.');
    return entities.importarArtigosEmLote(leiId, listaArtigos, sessao.username);
  },

  criarAcordao: async ({ token, csrf, dados }) => {
    const sessao = await auth.requerPermissao(token, csrf, 'gerir_acordaos');
    return entities.criarAcordao(sanitizarObjeto(dados, { sumario: LIMITES_TEXTO.longo, factos: LIMITES_TEXTO.longo, fundamentacao: LIMITES_TEXTO.longo, decisao: LIMITES_TEXTO.longo }), sessao.username);
  },
  atualizarAcordao: async ({ token, csrf, id, dados }) => {
    const sessao = await auth.requerPermissao(token, csrf, 'gerir_acordaos');
    return entities.atualizarAcordao(id, sanitizarObjeto(dados, { sumario: LIMITES_TEXTO.longo, factos: LIMITES_TEXTO.longo, fundamentacao: LIMITES_TEXTO.longo, decisao: LIMITES_TEXTO.longo }), sessao.username);
  },
  eliminarAcordao: async ({ token, csrf, id }) => {
    const sessao = await auth.requerPermissao(token, csrf, 'gerir_acordaos');
    await entities.eliminarAcordao(id, sessao.username);
    return { ok: true };
  },

  listarVersoes: async ({ token, csrf, tipo, id }) => versioning.listarVersoes(token, csrf, tipo, id),
  restaurarVersao: async ({ token, csrf, tipo, versaoId }) =>
    versioning.restaurarVersao(token, csrf, tipo, versaoId, entities.atualizarLei, entities.atualizarArtigo, entities.atualizarAcordao),
  obterAuditoria: async ({ token, csrf, filtros }) => {
    await auth.requerPermissao(token, csrf, 'ver_auditoria');
    return audit.obterAuditoria(filtros);
  },

  listarUtilizadores: async ({ token, csrf }) => auth.listarUtilizadores(token, csrf),
  criarUtilizador: async ({ token, csrf, dados }) => auth.criarUtilizador(token, csrf, dados),
  alterarRoleUtilizador: async ({ token, csrf, username, role, ativo }) => auth.alterarRoleUtilizador(token, csrf, username, role, ativo),

  adicionarFavorito: async ({ token, csrf, tipo, id }) => favoritos.adicionarFavorito(token, csrf, tipo, id),
  removerFavorito: async ({ token, csrf, tipo, id }) => favoritos.removerFavorito(token, csrf, tipo, id),
  listarFavoritos: async ({ token, csrf }) => favoritos.listarFavoritos(token, csrf),

  guardarPesquisa: async ({ token, csrf, nome, query, filtros }) => searchEngine.guardarPesquisa(token, csrf, nome, query, filtros),
  listarPesquisasGuardadas: async ({ token, csrf }) => searchEngine.listarPesquisasGuardadas(token, csrf),
  eliminarPesquisaGuardada: async ({ token, csrf, id }) => searchEngine.eliminarPesquisaGuardada(token, csrf, id),

  // RGPD — direito ao esquecimento: anonimiza os dados pessoais mas
  // mantém o registo de auditoria por obrigação legal de rastreabilidade.
  eliminarDadosUtilizador: async ({ token, csrf }) => {
    const sessao = await auth.requerPermissao(token, csrf, null);
    await db.atualizar(STORES.UTILIZADORES, 'username', sessao.username, { nome: 'Utilizador anonimizado', ativo: false, email: '' });
    await audit.logarAuditoria(sessao.username, 'rgpd_anonimizar', 'Utilizador', sessao.username, 'Pedido de anonimização processado.');
    await auth.terminarSessao(token);
    return { ok: true };
  }
};

/* ── Handler da Netlify Function ──────────────────────────────────── */

exports.handler = async (event) => {
  const headersCORS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headersCORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: headersCORS, body: JSON.stringify({ ok: false, erro: 'Método não permitido.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: headersCORS, body: JSON.stringify({ ok: false, erro: 'Corpo do pedido inválido.' }) };
  }

  const { action, payload } = body;
  const fn = ACOES_PUBLICAS[action] || ACOES_AUTENTICADAS[action];

  if (!fn) {
    return { statusCode: 404, headers: headersCORS, body: JSON.stringify({ ok: false, erro: 'Ação desconhecida: ' + action }) };
  }

  try {
    await garantirSetupInicial();
    const dados = await fn(payload || {});
    return { statusCode: 200, headers: headersCORS, body: JSON.stringify({ ok: true, dados }) };
  } catch (e) {
    console.error('Erro API [' + action + ']:', e.message);
    return { statusCode: 200, headers: headersCORS, body: JSON.stringify({ ok: false, erro: e.message || 'Erro desconhecido.' }) };
  }
};
