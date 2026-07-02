/**
 * js/components/spinner.js
 * Indicadores de carregamento reutilizáveis.
 */

import { store } from '../state/store.js';

/**
 * HTML de um spinner inline (para inserir em qualquer container).
 * @param {string} [texto]
 */
export function htmlSpinner(texto) {
  return `<div class="spinner-container">
    <div class="spinner" aria-label="A carregar…" role="status"></div>
    ${texto ? `<p class="spinner-texto">${texto}</p>` : ''}
  </div>`;
}

/**
 * Spinner de página inteira (sobreposição).
 * Ativado/desativado via store.carregando.
 */
export function iniciarSpinnerGlobal() {
  let overlay = document.getElementById('spinner-global');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'spinner-global';
    overlay.className = 'spinner-global';
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `<div class="spinner spinner-grande" role="status" aria-label="A carregar"></div>`;
    document.body.appendChild(overlay);
  }

  store.subscribe('carregando', (activo) => {
    overlay.style.display = activo ? 'flex' : 'none';
  });
}

/** Ativa o spinner global. */
export function mostrarSpinner()  { store.set({ carregando: true }); }

/** Desativa o spinner global. */
export function ocultarSpinner()  { store.set({ carregando: false }); }

/**
 * Executa uma promessa exibindo o spinner global enquanto aguarda.
 * Garante que o spinner é sempre desativado (mesmo em caso de erro).
 * @template T
 * @param {Promise<T>} promessa
 * @returns {Promise<T>}
 */
export async function comSpinner(promessa) {
  mostrarSpinner();
  try { return await promessa; }
  finally { ocultarSpinner(); }
}
