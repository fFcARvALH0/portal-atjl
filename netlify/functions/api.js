'use strict';
/**
 * netlify/functions/api.js - REFATORADO
 * Ponto de entrada único da API. Imports atualizados para lib/modules/*.
 * Ver lib/shared/logger.js, lib/shared/errors.js para infraestrutura.
 */

const db              = require('./lib/db');
const { STORES, LIMITES_TEXTO, APP_INFO } = require('./lib/config');
const { sanitizarObjeto } = require('./lib/security');
const { garantirSetupInicial } = require('./lib/seed');
const { getStore }    = require('@netlify/blobs');
const auth            = require('./lib/modules/auth');
const legislation     = require('./lib/modules/legislation');
const jurisprudence   = require('./lib/modules/jurisprudence');
const audit           = require('./lib/modules/audit');
const versioning      = require('./lib/modules/versioning');
const favorites       = require('./lib/modules/favorites');
const search          = require('./lib/modules/search');
const relations       = require('./lib/modules/relations');
const pdf             = require('./lib/modules/pdf');
const parser          = require('./lib/parser');
const { criarLogger }        = require('./lib/shared/logger');
const { resolverStatusCode } = require('./lib/shared/errors');

const log = criarLogger('api');

/* ── Rate limiting ──────────────────────────────────────────────── */
const RL_WINDOW_MS = 60 * 1000;
const RL_MAX = 120;
const RL_MEM_TTL = 3 * 1000;
const _rlMem = new Map();

function _rlStore() {
  const sid = process.env.NETLIFY_SITE_ID;
  const tok = process.env.NETLIFY_BLOBS_TOKEN;
  return (sid && tok)
    ? getStore({ name: 'ratelimit', siteID: sid, token: tok })
    : getStore('ratelimit');
}
function _rlKey(ip) { return 'rl:' + ip.replace(/[^a-zA-Z0-9._-]/g, '_'); }
function _obterIp(ev) {
  const h = ev.headers || {};
  return h['x-nf-client-connection-ip'] || h['client-ip'] ||
    (h['x-forwarded-for'] ? h['x-forwarded-for'].split(',')[0].trim() : null) || 'unknown';
}
async function _limiteExcedido(ip) {
  const agora = Date.now(); const chave = _rlKey(ip);
  const cached = _rlMem.get(ip);
  if (cached && agora < cached.expMem) {
    cached.contagem++;
    if (cached.contagem > RL_MAX) return true;
    _rlStore().setJSON(chave, { contagem: cached.contagem, resetEm: cached.resetEm }).catch(() => {});
    return false;
  }
  try {
    const store = _rlStore();
    const raw   = await store.get(chave, { type: 'json' });
    const base  = (raw && agora <= raw.resetEm) ? raw : { contagem: 0, resetEm: agora + RL_WINDOW_MS };
    base.contagem++;
    _rlMem.set(ip, { ...base, expMem: agora + RL_MEM_TTL });
    if (_rlMem.size > 2000) _rlMem.forEach((v, k) => { if (agora > v.expMem) _rlMem.delete(k); });
    store.setJSON(chave, { contagem: base.contagem, resetEm: base.resetEm }).catch(() => {});
    return base.contagem > RL_MAX;
  } catch {
    const fb = _rlMem.get(ip) || { contagem: 0, resetEm: agora + RL_WINDOW_MS, expMem: 0 };
    fb.contagem++; fb.expMem = agora + RL_MEM_TTL;
    _rlMem.set(ip, fb);
    return fb.contagem > RL_MAX;
  }
}

/* ── Lookup seguro (SEC-06) ─────────────────────────────────────── */
function _acao(mapa, action) {
  return Object.prototype.hasOwnProperty.call(mapa, action) ? mapa[action] : null;
}

const TTL_CACHE_SEG = {
  infoPublica: 300, listarLeis: 60, obterLei: 60,
  listarAcordaos: 60, obterAcordao: 60, obterCitantesArtigo: 60
};

/* ── Ações públicas ─────────────────────────────────────────────── */
const ACOES_PUBLICAS = {
  infoPublica:     async ()       => APP_INFO,
  listarLeis:      async ()       => legislation.listarLeis(),
  obterLei:        async ({ id }) => ({
    lei:    await legislation.obterLei(id),
    artigos: await legislation.listarArtigos(id)
  }),
  listarAcordaos:  async ()       => jurisprudence.listarAcordaos(),
  obterAcordao:    async ({ id }) => jurisprudence.obterAcordao(id),
  obterCitantesArtigo: async ({ artigoId }) => {
    if (!artigoId) return [];
    const rels  = await relations.listarRelacoesDoArtigo(artigoId);
    if (!rels.length) return [];
    const ids   = new Set(rels.map((r) => r.acordaoId));
    const todos = await jurisprudence.listarAcordaos();
    return todos
      .filter((a) => ids.has(a.id))
      .map((a) => ({ id: a.id, numero: a.numero, titulo: a.titulo, data: a.data, estado: a.estado, tipo: a.tipo }));
  },
  pesquisar:          async ({ query, filtros }) =>
    search.pesquisar(query, (filtros || {}).tipo, (filtros || {}).limite),
  analisarDocumento:  async ({ texto }) => parser.analisarDocumento(texto),
  login:  async ({ username, password }) => auth.autenticar(username, password),
  logout: async ({ token })             => auth.terminarSessao(token),
  exportarLeiPdf:    async ({ id })     => pdf.exportarLei(id),
  exportarAcordaoPdf: async ()          => pdf.exportarAcordaos(),
  exportarLotePdf:    async ()          => pdf.exportarAcordaos()
};

/* ── Ações autenticadas ─────────────────────────────────────────── */
const ACOES_AUTENTICADAS = {
  alterarPassword: async ({ token, csrf, atual, nova }) =>
    auth.alterarPassword(token, csrf, atual, nova),

  criarLei: async ({ token, csrf, dados }) => {
    const s = await auth.requerPermissao(token, csrf, 'gerir_leis');
    return legislation.criarLei(sanitizarObjeto(dados, { ementa: LIMITES_TEXTO.medio }), s.username);
  },
  atualizarLei: async ({ token, csrf, id, dados }) => {
    const s = await auth.requerPermissao(token, csrf, 'gerir_leis');
    return legislation.atualizarLei(id, sanitizarObjeto(dados, { ementa: LIMITES_TEXTO.medio }), s.username);
  },
  eliminarLei: async ({ token, csrf, id }) => {
    const s = await auth.requerPermissao(token, csrf, 'gerir_leis');
    await legislation.eliminarLei(id, s.username);
    return { ok: true };
  },

  criarArtigo: async ({ token, csrf, dados }) => {
    const s = await auth.requerPermissao(token, csrf, 'gerir_artigos');
    const lims = { texto: LIMITES_TEXTO.longo, interpretacaoTexto: LIMITES_TEXTO.longo };
    return legislation.criarArtigo(sanitizarObjeto(dados, lims), s.username);
  },
  atualizarArtigo: async ({ token, csrf, id, dados }) => {
    const s = await auth.requerPermissao(token, csrf, 'gerir_artigos');
    const lims = { texto: LIMITES_TEXTO.longo, interpretacaoTexto: LIMITES_TEXTO.longo };
    return legislation.atualizarArtigo(id, sanitizarObjeto(dados, lims), s.username);
  },
  eliminarArtigo: async ({ token, csrf, id }) => {
    const s = await auth.requerPermissao(token, csrf, 'gerir_artigos');
    await legislation.eliminarArtigo(id, s.username);
    return { ok: true };
  },
  importarArtigos: async ({ token, csrf, leiId, listaArtigos }) => {
    const s = await auth.requerPermissao(token, csrf, 'importar');
    if (!Array.isArray(listaArtigos) || !listaArtigos.length)
      throw new Error('Lista de artigos vazia ou inválida.');
    return legislation.importarArtigosEmLote(leiId, listaArtigos, s.username);
  },
  eliminarTodosArtigos: async ({ token, csrf, leiId }) => {
    if (!leiId) throw new Error('leiId em falta.');
    const s = await auth.requerPermissao(token, csrf, 'importar');
    return legislation.eliminarTodosArtigosDaLei(leiId, s.username);
  },

  criarAcordao: async ({ token, csrf, dados }) => {
    const s = await auth.requerPermissao(token, csrf, 'gerir_acordaos');
    const lims = { sumario: LIMITES_TEXTO.longo, factos: LIMITES_TEXTO.longo,
      fundamentacao: LIMITES_TEXTO.longo, decisao: LIMITES_TEXTO.longo };
    return jurisprudence.criarAcordao(sanitizarObjeto(dados, lims), s.username);
  },
  atualizarAcordao: async ({ token, csrf, id, dados }) => {
    const s = await auth.requerPermissao(token, csrf, 'gerir_acordaos');
    const lims = { sumario: LIMITES_TEXTO.longo, factos: LIMITES_TEXTO.longo,
      fundamentacao: LIMITES_TEXTO.longo, decisao: LIMITES_TEXTO.longo };
    return jurisprudence.atualizarAcordao(id, sanitizarObjeto(dados, lims), s.username);
  },
  eliminarAcordao: async ({ token, csrf, id }) => {
    const s = await auth.requerPermissao(token, csrf, 'gerir_acordaos');
    await jurisprudence.eliminarAcordao(id, s.username);
    return { ok: true };
  },

  listarVersoes: async ({ token, csrf, tipo, id }) =>
    versioning.listarVersoes(token, csrf, tipo, id),
  restaurarVersao: async ({ token, csrf, tipo, versaoId }) =>
    versioning.restaurarVersao(token, csrf, tipo, versaoId,
      legislation.atualizarLei, legislation.atualizarArtigo, jurisprudence.atualizarAcordao),

  obterAuditoria: async ({ token, csrf, filtros }) => {
    await auth.requerPermissao(token, csrf, 'ver_auditoria');
    return audit.obterAuditoria(filtros);
  },

  listarUtilizadores:    async ({ token, csrf })                          => auth.listarUtilizadores(token, csrf),
  criarUtilizador:       async ({ token, csrf, dados })                   => auth.criarUtilizador(token, csrf, dados),
  alterarRoleUtilizador: async ({ token, csrf, username, role, ativo })   => auth.alterarRoleUtilizador(token, csrf, username, role, ativo),

  adicionarFavorito: async ({ token, csrf, tipo, id, titulo }) => favorites.adicionarFavorito(token, csrf, tipo, id, titulo),
  removerFavorito:   async ({ token, csrf, id })               => favorites.removerFavorito(token, csrf, id),
  listarFavoritos:   async ({ token, csrf })                   => favorites.listarFavoritos(token, csrf),

  guardarPesquisa:          async () => ({ ok: false, erro: 'Funcionalidade em desenvolvimento.' }),
  listarPesquisasGuardadas: async () => [],
  eliminarPesquisaGuardada: async () => ({ ok: true }),

  eliminarDadosUtilizador: async ({ token, csrf }) => {
    const s = await auth.requerPermissao(token, csrf, null);
    await db.atualizar(STORES.UTILIZADORES, 'username', s.username,
      { nome: 'Utilizador anonimizado', ativo: false, email: '' });
    await audit.logarAuditoria(s.username, 'rgpd_anonimizar', 'Utilizador', s.username,
      'Pedido de anonimização RGPD processado.');
    await auth.terminarSessao(token);
    return { ok: true };
  }
};

/* ── Handler da Netlify Function ────────────────────────────────── */
exports.handler = async (event) => {
  const origem = process.env.URL || process.env.DEPLOY_PRIME_URL || '*';
  const corsH = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origem,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsH, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsH, body: JSON.stringify({ ok: false, erro: 'Método não permitido.' }) };
  }

  const ip = _obterIp(event);
  if (await _limiteExcedido(ip)) {
    return { statusCode: 429, headers: corsH, body: JSON.stringify({ ok: false, erro: 'Demasiados pedidos. Tente novamente em breve.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: corsH, body: JSON.stringify({ ok: false, erro: 'Corpo do pedido inválido.' }) }; }

  const { action, payload } = body;
  const fn = _acao(ACOES_PUBLICAS, action) || _acao(ACOES_AUTENTICADAS, action);
  if (!fn) {
    return { statusCode: 404, headers: corsH, body: JSON.stringify({ ok: false, erro: `Ação desconhecida: ${action}` }) };
  }

  const ttl = TTL_CACHE_SEG[action];
  const headersResp = { ...corsH, 'Cache-Control': ttl ? `public, s-maxage=${ttl}, stale-while-revalidate=30` : 'no-store' };

  try {
    await garantirSetupInicial();
    const dados = await fn(payload || {});
    return { statusCode: 200, headers: headersResp, body: JSON.stringify({ ok: true, dados }) };
  } catch (e) {
    const status = resolverStatusCode(e);
    log.error(`Ação [${action}] falhou`, e);
    return {
      statusCode: status === 200 ? 200 : status,
      headers: { ...corsH, 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, erro: e.message || 'Erro desconhecido.' })
    };
  }
};
