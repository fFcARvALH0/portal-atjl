/**
 * js/components/modal.js
 * Sistema de modais reutilizável.
 * Substitui os múltiplos divs modais dispersos no HTML e nas views
 * por um único componente com API programática.
 *
 * Uso:
 *   import { modal } from '../components/modal.js';
 *
 *   // Modal de confirmação
 *   const confirmou = await modal.confirmar('Eliminar esta lei?', 'Eliminar', 'Cancelar');
 *
 *   // Modal com conteúdo personalizado
 *   modal.abrir({ titulo: 'Editar Lei', corpo: '<form>...</form>', largura: '700px' });
 *   modal.fechar();
 */

let _sobreposicao = null;
let _resolveAtual = null;

function _criar() {
  if (_sobreposicao) return;

  _sobreposicao = document.createElement('div');
  _sobreposicao.id = 'modal-sobreposicao';
  _sobreposicao.className = 'modal-sobreposicao';
  _sobreposicao.setAttribute('role', 'dialog');
  _sobreposicao.setAttribute('aria-modal', 'true');
  _sobreposicao.innerHTML = `
    <div class="modal-caixa" id="modal-caixa">
      <div class="modal-cabecalho">
        <h2 class="modal-titulo" id="modal-titulo"></h2>
        <button class="modal-fechar-btn" id="modal-fechar-btn" aria-label="Fechar">&times;</button>
      </div>
      <div class="modal-corpo" id="modal-corpo"></div>
      <div class="modal-rodape" id="modal-rodape"></div>
    </div>
  `;
  document.body.appendChild(_sobreposicao);

  document.getElementById('modal-fechar-btn').addEventListener('click', () => modal.fechar(null));
  _sobreposicao.addEventListener('click', (e) => {
    if (e.target === _sobreposicao) modal.fechar(null);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _sobreposicao && _sobreposicao.style.display !== 'none') {
      modal.fechar(null);
    }
  });
}

export const modal = {
  /**
   * Abre um modal com conteúdo personalizado.
   * @param {object} opcoes
   * @param {string}  opcoes.titulo   - Título do modal
   * @param {string}  opcoes.corpo    - HTML do corpo
   * @param {string}  [opcoes.rodape] - HTML do rodapé (botões)
   * @param {string}  [opcoes.largura] - Largura CSS (ex: '700px')
   */
  abrir({ titulo, corpo, rodape, largura }) {
    _criar();
    document.getElementById('modal-titulo').textContent = titulo || '';
    document.getElementById('modal-corpo').innerHTML = corpo || '';
    document.getElementById('modal-rodape').innerHTML = rodape || '';
    if (largura) document.getElementById('modal-caixa').style.maxWidth = largura;
    else document.getElementById('modal-caixa').style.maxWidth = '';
    _sobreposicao.style.display = 'flex';
    requestAnimationFrame(() => _sobreposicao.classList.add('modal-visivel'));

    // Foco no primeiro elemento interativo
    const primeiroFoco = _sobreposicao.querySelector('button, input, select, textarea, [tabindex]');
    if (primeiroFoco) primeiroFoco.focus();
  },

  /** Fecha o modal ativo. */
  fechar(resultado) {
    if (!_sobreposicao) return;
    _sobreposicao.classList.remove('modal-visivel');
    setTimeout(() => { if (_sobreposicao) _sobreposicao.style.display = 'none'; }, 200);
    if (_resolveAtual) { _resolveAtual(resultado); _resolveAtual = null; }
  },

  /**
   * Apresenta um modal de confirmação.
   * @param {string} mensagem
   * @param {string} [txtConfirmar]
   * @param {string} [txtCancelar]
   * @returns {Promise<boolean>}
   */
  confirmar(mensagem, txtConfirmar, txtCancelar) {
    return new Promise((resolve) => {
      _resolveAtual = resolve;
      const rodape = `
        <button class="btn btn-secundario" id="modal-cancelar">${txtCancelar || 'Cancelar'}</button>
        <button class="btn btn-perigo"     id="modal-confirmar">${txtConfirmar || 'Confirmar'}</button>
      `;
      this.abrir({ titulo: 'Confirmação', corpo: `<p>${mensagem}</p>`, rodape });
      document.getElementById('modal-cancelar').addEventListener('click', () => this.fechar(false));
      document.getElementById('modal-confirmar').addEventListener('click', () => this.fechar(true));
    });
  },

  /** Alerta simples (OK). */
  alerta(titulo, mensagem) {
    return new Promise((resolve) => {
      _resolveAtual = resolve;
      this.abrir({
        titulo,
        corpo: `<p>${mensagem}</p>`,
        rodape: `<button class="btn btn-primario" id="modal-ok">OK</button>`
      });
      document.getElementById('modal-ok').addEventListener('click', () => this.fechar(true));
    });
  }
};
