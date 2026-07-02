/**
 * js/services/api.js
 * Cliente HTTP centralizado para a API Netlify.
 * Toda a comunicação com o backend passa por este módulo — nunca
 * chamar fetch() diretamente a partir de views ou componentes.
 *
 * Padrão de resposta: sempre { ok, dados } ou { ok:false, erro }
 */

const API_URL = '/api';

/**
 * Executa um pedido POST à API.
 * @param {string} action  - Nome da ação (ex: 'listarLeis')
 * @param {object} payload - Dados do pedido
 * @returns {Promise<any>} - Devolve dados diretamente; lança Error se ok:false
 */
async function _post(action, payload = {}) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });

  if (!resp.ok && resp.status !== 200) {
    // Erros HTTP de infraestrutura (429, 500, etc.)
    throw new Error(`Erro HTTP ${resp.status}: ${resp.statusText}`);
  }

  const json = await resp.json();
  if (!json.ok) throw new Error(json.erro || 'Erro desconhecido na API.');
  return json.dados;
}

/* ── Info ────────────────────────────────────────────────────────── */
export const obterInfoPublica = () => _post('infoPublica');

/* ── Autenticação ────────────────────────────────────────────────── */
export const login  = (username, password) => _post('login',  { username, password });
export const logout = (token)              => _post('logout', { token });
export const alterarPassword = (token, csrf, atual, nova) =>
  _post('alterarPassword', { token, csrf, atual, nova });

/* ── Legislação ──────────────────────────────────────────────────── */
export const listarLeis  = ()     => _post('listarLeis');
export const obterLei    = (id)   => _post('obterLei', { id });

export const criarLei    = (token, csrf, dados) => _post('criarLei',    { token, csrf, dados });
export const atualizarLei = (token, csrf, id, dados) => _post('atualizarLei', { token, csrf, id, dados });
export const eliminarLei  = (token, csrf, id)        => _post('eliminarLei',  { token, csrf, id });

export const criarArtigo     = (token, csrf, dados)        => _post('criarArtigo',    { token, csrf, dados });
export const atualizarArtigo = (token, csrf, id, dados)    => _post('atualizarArtigo', { token, csrf, id, dados });
export const eliminarArtigo  = (token, csrf, id)           => _post('eliminarArtigo',  { token, csrf, id });
export const importarArtigos = (token, csrf, leiId, listaArtigos) =>
  _post('importarArtigos', { token, csrf, leiId, listaArtigos });
export const eliminarTodosArtigos = (token, csrf, leiId) =>
  _post('eliminarTodosArtigos', { token, csrf, leiId });

/* ── Jurisprudência ──────────────────────────────────────────────── */
export const listarAcordaos  = ()   => _post('listarAcordaos');
export const obterAcordao    = (id) => _post('obterAcordao', { id });
export const obterCitantesArtigo = (artigoId) => _post('obterCitantesArtigo', { artigoId });

export const criarAcordao    = (token, csrf, dados)     => _post('criarAcordao',    { token, csrf, dados });
export const atualizarAcordao = (token, csrf, id, dados) => _post('atualizarAcordao', { token, csrf, id, dados });
export const eliminarAcordao  = (token, csrf, id)        => _post('eliminarAcordao',  { token, csrf, id });

/* ── Pesquisa ────────────────────────────────────────────────────── */
export const pesquisar = (query, filtros = {}) => _post('pesquisar', { query, filtros });

/* ── Parser ──────────────────────────────────────────────────────── */
export const analisarDocumento = (texto) => _post('analisarDocumento', { texto });

/* ── Favoritos ───────────────────────────────────────────────────── */
export const listarFavoritos   = (token, csrf)               => _post('listarFavoritos',   { token, csrf });
export const adicionarFavorito = (token, csrf, tipo, id, titulo) => _post('adicionarFavorito', { token, csrf, tipo, id, titulo });
export const removerFavorito   = (token, csrf, id)           => _post('removerFavorito',   { token, csrf, id });

/* ── Utilizadores ────────────────────────────────────────────────── */
export const listarUtilizadores    = (token, csrf)                   => _post('listarUtilizadores',    { token, csrf });
export const criarUtilizador       = (token, csrf, dados)            => _post('criarUtilizador',       { token, csrf, dados });
export const alterarRoleUtilizador = (token, csrf, username, role, ativo) =>
  _post('alterarRoleUtilizador', { token, csrf, username, role, ativo });

/* ── Auditoria ───────────────────────────────────────────────────── */
export const obterAuditoria = (token, csrf, filtros = {}) => _post('obterAuditoria', { token, csrf, filtros });

/* ── Versões ─────────────────────────────────────────────────────── */
export const listarVersoes  = (token, csrf, tipo, id)     => _post('listarVersoes',  { token, csrf, tipo, id });
export const restaurarVersao = (token, csrf, tipo, versaoId) => _post('restaurarVersao', { token, csrf, tipo, versaoId });

/* ── PDF ─────────────────────────────────────────────────────────── */
export const exportarLeiPdf     = (id) => _post('exportarLeiPdf',     { id });
export const exportarAcordaoPdf = (id) => _post('exportarAcordaoPdf', { id });
