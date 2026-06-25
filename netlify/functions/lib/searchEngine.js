'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/searchEngine.js  (equivalente a SearchEngine.gs)
 * ════════════════════════════════════════════════════════════════════
 * Pesquisa por relevância com expansão de sinónimos jurídicos,
 * pontuação por campo e filtros combináveis.
 *
 * CORREÇÃO (SEC-05):
 *   `listarPesquisasGuardadas` devolvia `JSON.parse(p.filtrosJSON)`
 *   diretamente ao cliente, sem validar a estrutura — um registo
 *   manipulado diretamente via API podia conter campos arbitrários.
 *   `_sanitizarFiltros` aplica uma whitelist (só `tipo` — de um
 *   conjunto fechado de valores — e `area`, como texto curto) tanto ao
 *   guardar como ao listar, e o parse fica protegido com try/catch
 *   para não rebentar com JSON inválido.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('./db');
const { STORES } = require('./config');
const { sanitizarTexto } = require('./security');
const { LIMITES_TEXTO } = require('./config');
const entities = require('./entities');
const auth = require('./auth');

async function _expandirTermos(query) {
  const termos = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const sinonimos = await db.listarTudo(STORES.SINONIMOS);
  const expandido = new Set(termos);
  termos.forEach((t) => {
    sinonimos.forEach((s) => {
      const chave = String(s.termo || '').toLowerCase();
      const lista = String(s.sinonimos || '').toLowerCase().split(',').map((x) => x.trim());
      if (chave === t) lista.forEach((l) => { if (l) expandido.add(l); });
      if (lista.indexOf(t) !== -1) expandido.add(chave);
    });
  });
  return Array.from(expandido);
}

function _pontuarTexto(texto, termos) {
  if (!texto) return 0;
  const baixo = String(texto).toLowerCase();
  let pontos = 0;
  termos.forEach((t) => { pontos += baixo.split(t).length - 1; });
  return pontos;
}

async function pesquisarPortal(query, filtros) {
  filtros = filtros || {};
  const termos = await _expandirTermos(query);
  if (!termos.length) return [];
  const resultados = [];

  if (!filtros.tipo || filtros.tipo === 'todos' || filtros.tipo === 'leis') {
    (await entities.listarLeis()).forEach((l) => {
      if (filtros.area && l.area !== filtros.area) return;
      const pontos = _pontuarTexto(l.titulo, termos) * 3 + _pontuarTexto(l.ementa, termos) + _pontuarTexto(l.numero, termos) * 2;
      if (pontos > 0) resultados.push({ tipo: 'Lei', id: l.id, titulo: l.titulo, meta: l.numero + ' · ' + (l.dataPublicacao || ''), excerto: l.ementa || l.titulo, estado: l.estado, pontos });
    });
  }
  if (!filtros.tipo || filtros.tipo === 'todos' || filtros.tipo === 'acordaos') {
    (await entities.listarAcordaos()).forEach((a) => {
      const pontos = _pontuarTexto(a.titulo, termos) * 3 + _pontuarTexto(a.sumario, termos) * 2 + _pontuarTexto(a.decisao, termos) + _pontuarTexto(a.numero, termos) * 2;
      if (pontos > 0) resultados.push({ tipo: 'Acórdão', id: a.id, titulo: a.titulo, meta: a.numero + ' · ' + (a.data || '') + ' · ' + (a.relator || ''), excerto: a.sumario || a.titulo, estado: a.estado, pontos });
    });
  }
  if (!filtros.tipo || filtros.tipo === 'todos' || filtros.tipo === 'interp') {
    const todosArtigos = await entities.listarTodosArtigos();
    for (const a of todosArtigos.filter((x) => x.interpretacaoTexto)) {
      const pontos = _pontuarTexto(a.interpretacaoTexto, termos) * 2 + _pontuarTexto(a.principios, termos);
      if (pontos > 0) {
        const lei = await entities.obterLei(a.leiId);
        resultados.push({ tipo: 'Interpretação', id: a.id, leiId: a.leiId, titulo: a.numero + (a.titulo ? ' — ' + a.titulo : '') + (lei ? ' (' + lei.numero + ')' : ''), meta: lei ? lei.numero : '', excerto: a.interpretacaoTexto, estado: 'vigor', pontos });
      }
    }
  }

  resultados.sort((a, b) => b.pontos - a.pontos);
  return resultados.slice(0, 100);
}

/* ── Pesquisas guardadas ──────────────────────────────────────── */

const _TIPOS_FILTRO_VALIDOS = ['todos', 'leis', 'acordaos', 'interp'];

/** Whitelist de estrutura — só os campos que pesquisarPortal realmente usa. */
function _sanitizarFiltros(filtros) {
  const f = filtros || {};
  return {
    tipo: _TIPOS_FILTRO_VALIDOS.indexOf(f.tipo) !== -1 ? f.tipo : 'todos',
    area: typeof f.area === 'string' ? sanitizarTexto(f.area, LIMITES_TEXTO.curto) : ''
  };
}

async function guardarPesquisa(token, csrf, nome, query, filtros) {
  const sessao = await auth.requerPermissao(token, csrf, null);
  await db.inserir(STORES.PESQUISAS_GUARDADAS, {
    id: db.gerarId(), utilizador: sessao.username,
    nome: sanitizarTexto(nome, LIMITES_TEXTO.curto), query: sanitizarTexto(query, LIMITES_TEXTO.curto),
    filtrosJSON: JSON.stringify(_sanitizarFiltros(filtros)), criado: new Date().toISOString()
  });
  return { ok: true };
}

async function listarPesquisasGuardadas(token, csrf) {
  const sessao = await auth.requerPermissao(token, csrf, null);
  return (await db.listarTudo(STORES.PESQUISAS_GUARDADAS))
    .filter((p) => p.utilizador === sessao.username)
    .map((p) => {
      let filtrosBrutos = {};
      try { filtrosBrutos = JSON.parse(p.filtrosJSON || '{}'); } catch (e) { filtrosBrutos = {}; }
      return { id: p.id, nome: p.nome, query: p.query, filtros: _sanitizarFiltros(filtrosBrutos) };
    });
}

async function eliminarPesquisaGuardada(token, csrf, id) {
  const sessao = await auth.requerPermissao(token, csrf, null);
  const todas = await db.listarTudo(STORES.PESQUISAS_GUARDADAS);
  const p = todas.find((x) => x.id === id && x.utilizador === sessao.username);
  if (p) await db.remover(STORES.PESQUISAS_GUARDADAS, 'id', id);
  return { ok: true };
}

module.exports = { pesquisarPortal, guardarPesquisa, listarPesquisasGuardadas, eliminarPesquisaGuardada };
