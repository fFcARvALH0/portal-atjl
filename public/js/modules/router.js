/**
 * js/modules/router.js
 * Router SPA: mapeia vistas para módulos e gere a navegação.
 * Substitui a lógica dispersa de STJ.navegar() em core.js.
 *
 * Uso:
 *   import { router } from './router.js';
 *   router.navegar('legislacao');
 *   router.navegar('lei-detalhe', { id: '123' });
 */

import { store } from '../state/store.js';
import { g } from '../utils/dom.js';
import { scrollTopo } from '../utils/dom.js';

/** Registo de handlers: { [vista]: async (params) => void } */
const _handlers = {};

/** Container principal das vistas. */
let _container = null;

export const router = {
  /** Regista um handler para uma vista. */
  registar(vista, handler) {
    _handlers[vista] = handler;
  },

  /** Regista múltiplos handlers de uma vez. */
  registarTodos(mapa) {
    Object.entries(mapa).forEach(([v, h]) => this.registar(v, h));
  },

  /**
   * Navega para uma vista.
   * @param {string} vista   - Nome da vista (ex: 'legislacao')
   * @param {object} [params] - Parâmetros opcionais (ex: { id: '...' })
   */
  async navegar(vista, params) {
    if (!vista) vista = 'home';
    const handler = _handlers[vista];

    store.set({ vistaAtiva: vista });
    _atualizarNavAtiva(vista);
    scrollTopo();

    if (!handler) {
      console.warn(`[router] Vista não registada: ${vista}`);
      return;
    }

    try {
      await handler(params || {});
    } catch (e) {
      console.error(`[router] Erro na vista "${vista}":`, e);
      _renderErro(vista, e);
    }
  },

  /** Vista atualmente ativa. */
  atual() { return store.get('vistaAtiva'); },

  /** Referência ao container principal. */
  container() {
    if (!_container) _container = g('conteudo-principal') || g('main') || document.body;
    return _container;
  }
};

/* ── Helpers internos ────────────────────────────────────────────── */

function _atualizarNavAtiva(vista) {
  // Remove classe ativa de todos os links de navegação
  document.querySelectorAll('[data-vista]').forEach((el) => {
    el.classList.toggle('ativo', el.dataset.vista === vista);
  });
}

function _renderErro(vista, erro) {
  const container = router.container();
  if (container) {
    container.innerHTML = `
      <div class="erro-pagina">
        <h2>Erro ao carregar a vista</h2>
        <p>${erro.message || 'Ocorreu um erro desconhecido.'}</p>
        <button class="btn btn-primario" onclick="router.navegar('home')">Voltar ao início</button>
      </div>
    `;
  }
}
