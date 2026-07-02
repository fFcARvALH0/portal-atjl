/**
 * js/components/toast.js
 * Sistema de notificações toast (topo da página).
 * Componente autónomo — não depende de estado global.
 *
 * Uso:
 *   import { toast } from '../components/toast.js';
 *   toast.ok('Lei guardada com sucesso.');
 *   toast.erro('Erro ao gravar. Tente novamente.');
 *   toast.aviso('Sessão prestes a expirar.');
 */

import { TOAST_DURACAO } from '../config/constants.js';

let _container = null;

function _obterContainer() {
  if (_container && document.body.contains(_container)) return _container;
  _container = document.getElementById('toast-container');
  if (!_container) {
    _container = document.createElement('div');
    _container.id = 'toast-container';
    _container.setAttribute('role', 'status');
    _container.setAttribute('aria-live', 'polite');
    document.body.appendChild(_container);
  }
  return _container;
}

/**
 * Cria e apresenta um toast.
 * @param {string} msg      - Mensagem
 * @param {'ok'|'erro'|'aviso'|'info'} tipo
 * @param {number} duracao  - Millisegundos (0 = não fecha automaticamente)
 */
function _mostrar(msg, tipo, duracao) {
  const icones = { ok: '✔', erro: '✖', aviso: '⚠', info: 'ℹ' };
  const container = _obterContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  toast.innerHTML = `
    <span class="toast-icone" aria-hidden="true">${icones[tipo] || 'ℹ'}</span>
    <span class="toast-msg">${String(msg)}</span>
    <button class="toast-fechar" aria-label="Fechar notificação">&times;</button>
  `;

  const fechar = () => {
    toast.classList.add('toast-saindo');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  };

  toast.querySelector('.toast-fechar').addEventListener('click', fechar);
  container.appendChild(toast);

  // Animar entrada
  requestAnimationFrame(() => toast.classList.add('toast-visivel'));

  if (duracao !== 0) {
    const d = duracao || TOAST_DURACAO.NORMAL;
    setTimeout(fechar, d);
  }

  return fechar; // permite fechar programaticamente
}

export const toast = {
  ok:     (msg, duracao) => _mostrar(msg, 'ok',    duracao),
  erro:   (msg, duracao) => _mostrar(msg, 'erro',  duracao || TOAST_DURACAO.LONGO),
  aviso:  (msg, duracao) => _mostrar(msg, 'aviso', duracao),
  info:   (msg, duracao) => _mostrar(msg, 'info',  duracao),
};
