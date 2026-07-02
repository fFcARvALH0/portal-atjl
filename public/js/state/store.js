/**
 * js/state/store.js
 * Gestão de estado centralizada (single source of truth).
 * Substitui o objeto STJ.estado disperso por um store reativo simples
 * com subscrições, persistência de sessão e proteção contra múltiplas
 * fontes de verdade.
 *
 * Uso:
 *   import { store, obterEstado, definirSessao, limparSessao } from '../state/store.js';
 *   store.subscribe('sessao', (s) => atualizarUI(s));
 */

const SESSAO_KEY = 'stj_sessao';

/** Estado inicial completo da aplicação. */
const _estado = {
  sessao:        null,   // { token, csrf, utilizador: { username, nome, role } }
  leis:          [],
  acordaos:      [],
  resultados:    [],
  vistaAtiva:    'home',
  leiAtiva:      null,
  acordaoAtivo:  null,
  carregando:    false,
  favoritos:     [],
};

/** Registo de subscritores por chave de estado. */
const _subscritores = {};

/**
 * Notifica todos os subscritores de uma chave de estado.
 * @param {string} chave
 */
function _notificar(chave) {
  const lista = _subscritores[chave] || [];
  const valor = _estado[chave];
  lista.forEach((fn) => { try { fn(valor); } catch (e) { console.error('[store] Subscritor', chave, e); } });
}

export const store = {
  /**
   * Subscreve alterações de uma ou mais chaves de estado.
   * @param {string|string[]} chaves
   * @param {Function}        callback - Chamado com o novo valor
   * @returns {Function}              - Função para cancelar subscrição
   */
  subscribe(chaves, callback) {
    const ks = Array.isArray(chaves) ? chaves : [chaves];
    ks.forEach((k) => {
      _subscritores[k] = _subscritores[k] || [];
      _subscritores[k].push(callback);
    });
    return () => {
      ks.forEach((k) => {
        _subscritores[k] = (_subscritores[k] || []).filter((f) => f !== callback);
      });
    };
  },

  /**
   * Atualiza uma ou mais chaves de estado e notifica subscritores.
   * @param {object} parcial - Objeto com as chaves a atualizar
   */
  set(parcial) {
    const chaves = Object.keys(parcial);
    chaves.forEach((k) => { _estado[k] = parcial[k]; });
    chaves.forEach((k) => _notificar(k));
  },

  /** Lê o valor atual de uma chave (sem subscrição). */
  get(chave) { return _estado[chave]; },

  /** Snapshot imutável do estado completo (apenas para debug). */
  snapshot() { return { ..._estado }; }
};

/* ── Sessão ──────────────────────────────────────────────────────── */

/** Carrega a sessão guardada no sessionStorage (ao iniciar). */
export function carregarSessao() {
  try {
    const raw = sessionStorage.getItem(SESSAO_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.token) return null;
    store.set({ sessao: s });
    return s;
  } catch { return null; }
}

/** Persiste uma nova sessão no store e no sessionStorage. */
export function definirSessao(sessao) {
  store.set({ sessao });
  try { sessionStorage.setItem(SESSAO_KEY, JSON.stringify(sessao)); } catch { /* privado/iOS */ }
}

/** Remove a sessão do store e do sessionStorage. */
export function limparSessao() {
  store.set({ sessao: null, favoritos: [] });
  try { sessionStorage.removeItem(SESSAO_KEY); } catch { /* privado/iOS */ }
}

/** Lê a sessão atual (atalho conveniente). */
export function obterEstado(chave) { return store.get(chave); }

/** Atalho: sessão atual. */
export function sessaoAtual() { return store.get('sessao'); }

/** Atalho: utilizador da sessão atual. */
export function utilizadorAtual() {
  const s = store.get('sessao');
  return s ? s.utilizador : null;
}
