/**
 * js/main.js  ← <script type="module" src="/js/main.js">
 * ════════════════════════════════════════════════════════════════════
 * Ponto de entrada do frontend modular.
 *
 * PADRÃO DE MIGRAÇÃO:
 *   • Internamente usa ES Modules com imports explícitos.
 *   • Expõe window.STJ para compatibilidade com handlers inline nos
 *     templates HTML (ex: onclick="STJ.navegar('legislacao')").
 *   • Todo o estado é centralizado em state/store.js — sem variáveis
 *     globais além do objeto STJ de interface pública.
 * ════════════════════════════════════════════════════════════════════
 */

import * as api       from './services/api.js';
import { store, carregarSessao, definirSessao, limparSessao, sessaoAtual } from './state/store.js';
import { g, q, setHtml, valorInput, debounce, scrollTopo } from './utils/dom.js';
import { h, nl2br, formatarData, formatarDataHora, badgeEstadoLei } from './utils/format.js';
import { toast }       from './components/toast.js';
import { modal }       from './components/modal.js';
import { iniciarSpinnerGlobal, comSpinner } from './components/spinner.js';
import { router }      from './modules/router.js';

// ── Vistas públicas ─────────────────────────────────────────────
import { renderHome }               from './modules/home/view.js';
import { renderLegislacaoLista }    from './modules/legislation/list.js';
import { renderLeiDetalhe }         from './modules/legislation/detail.js';
import { renderJurisprudenciaLista }from './modules/jurisprudence/list.js';
import { renderAcordaoDetalhe }     from './modules/jurisprudence/detail.js';
import { renderPesquisa }           from './modules/search/view.js';
import { renderPrivacidade }        from './modules/privacy/view.js';

// ── Admin ────────────────────────────────────────────────────────
import { renderAdmin }              from './modules/admin/index.js';

/* ══════════════════════════════════════════════════════════════════
   INTERFACE PÚBLICA window.STJ
   ══════════════════════════════════════════════════════════════════
   Mantida para compatibilidade com os handlers inline dos templates.
   Novos módulos devem importar diretamente os serviços em vez de
   usar STJ.* — este objeto é a "cola" da migração progressiva. */

window.STJ = {

  /* ── Estado (proxy sobre o store) ────────────────────────────── */
  get estado() { return _estado; },

  /* ── Navegação ─────────────────────────────────────────────────── */
  navegar(vista, params) {
    if (params) Object.assign(_estado, params);
    router.navegar(vista, params);
  },

  /* ── API helpers (preservam a assinatura original) ─────────────── */
  async api(action, payload) {
    try {
      return await _callApi(action, payload);
    } catch (e) {
      toast.erro(e.message || 'Erro de comunicação.');
      return null;
    }
  },

  async apiAuth(action, payload) {
    const s = sessaoAtual();
    if (!s) { toast.erro('Sessão inválida. Por favor inicie sessão.'); return null; }
    try {
      return await _callApi(action, { ...payload, token: s.token, csrf: s.csrf });
    } catch (e) {
      toast.erro(e.message || 'Erro de comunicação.');
      return null;
    }
  },

  /* ── Sessão ────────────────────────────────────────────────────── */
  guardarSessao(sessao) {
    if (sessao) definirSessao(sessao);
    else limparSessao();
    this.render();
  },

  /* ── Rendering ─────────────────────────────────────────────────── */
  async render() {
    return _render();
  },

  /* ── Utilidades preservadas (usadas nos templates inline) ──────── */
  h,
  fmtDate:  formatarData,
  fmtDateHora: formatarDataHora,
  nl2p(str) {
    return (str || '').split(/\n{2,}/)
      .filter(Boolean)
      .map((p) => `<p>${nl2br(p.trim())}</p>`)
      .join('');
  },
  stBadge: badgeEstadoLei,
  g(id)    { return valorInput(id); },
  gv(id)   { const el = document.getElementById(id); return el ? el.value : ''; },

  /* ── Toast ─────────────────────────────────────────────────────── */
  toast: (msg) => toast.ok(msg),

  /* ── Modais ────────────────────────────────────────────────────── */
  async modalConfirm({ titulo, mensagem, textoConfirmar }) {
    return modal.confirmar(mensagem, textoConfirmar, 'Cancelar');
  },
  async modalInfo({ titulo, mensagem, textoBotao }) {
    return modal.alerta(titulo, mensagem);
  },
  async modalInput({ titulo, label, placeholder, textoConfirmar }) {
    return new Promise((resolve) => {
      modal.abrir({
        titulo,
        corpo: `<div class="f-row"><label>${h(label)}</label>
          <input type="text" id="modal-input-field" placeholder="${h(placeholder || '')}" style="margin-top:.4rem"></div>`,
        rodape: `<button class="btn btn-secundario" id="modal-inp-cancelar">Cancelar</button>
          <button class="btn btn-primario"   id="modal-inp-confirmar">${h(textoConfirmar || 'OK')}</button>`
      });
      const confirmar = () => {
        const v = (document.getElementById('modal-input-field') || {}).value || '';
        modal.fechar(v || null);
        resolve(v || null);
      };
      document.getElementById('modal-inp-cancelar').addEventListener('click', () => { modal.fechar(null); resolve(null); });
      document.getElementById('modal-inp-confirmar').addEventListener('click', confirmar);
      document.getElementById('modal-input-field').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmar(); });
      setTimeout(() => { const f = document.getElementById('modal-input-field'); if (f) f.focus(); }, 100);
    });
  },

  /* ── Exportação PDF ────────────────────────────────────────────── */
  async exportarPdf(tipo, id) {
    toast.info('A gerar PDF…');
    try {
      const buf = tipo === 'lei'
        ? await api.exportarLeiPdf(id)
        : await api.exportarAcordaoPdf(id);
      if (buf) _downloadBuffer(buf, `${tipo}-${id}.pdf`);
    } catch (e) { toast.erro(e.message); }
  },
  async exportarPdfLote(tipo, ids) {
    toast.info('A gerar PDF em lote…');
    try {
      const buf = await api.exportarAcordaoPdf(ids[0]);
      if (buf) _downloadBuffer(buf, `${tipo}-lote.pdf`);
    } catch (e) { toast.erro(e.message); }
  },

  /* ── Histórico de Versões ──────────────────────────────────────── */
  async abrirHistoricoVersoes({ tipo, id, campos }) {
    const s = sessaoAtual();
    if (!s) return;
    try {
      const versoes = await api.listarVersoes(s.token, s.csrf, tipo, id);
      if (!versoes || !versoes.length) { modal.alerta('Histórico', 'Sem versões anteriores registadas.'); return; }
      const linhas = versoes.map((v) => `
        <div style="border-bottom:1px solid var(--border-lt);padding:.6rem 0">
          <div style="font-size:11px;color:var(--muted)">${formatarDataHora(v.timestamp)} — ${h(v.utilizador)}</div>
          ${campos.map((c) => {
            const val = v.snapshot ? v.snapshot[c.chave] : '';
            return val ? `<div style="font-size:12px;margin-top:3px"><strong>${h(c.label)}:</strong> ${h(String(val).substring(0, 200))}</div>` : '';
          }).join('')}
          <button class="btn btn-outline btn-sm" style="margin-top:.4rem"
            onclick="STJ._restaurar('${h(tipo)}','${h(v.id)}')">↩ Restaurar esta versão</button>
        </div>`).join('');
      modal.abrir({ titulo: `Histórico — ${tipo}`, corpo: `<div style="max-height:400px;overflow-y:auto">${linhas}</div>`, largura: '700px' });
    } catch (e) { toast.erro(e.message); }
  },

  async _restaurar(tipo, versaoId) {
    const ok = await modal.confirmar('Restaurar esta versão? A versão atual será guardada no histórico.', 'Restaurar', 'Cancelar');
    if (!ok) return;
    const s = sessaoAtual();
    if (!s) return;
    try {
      await api.restaurarVersao(s.token, s.csrf, tipo, versaoId);
      toast.ok('Versão restaurada.');
      modal.fechar(true);
      _render();
    } catch (e) { toast.erro(e.message); }
  },

  /* ── Utilitário: copiar URL ────────────────────────────────────── */
  copiarLigacao() {
    navigator.clipboard && navigator.clipboard.writeText(window.location.href)
      .then(() => toast.ok('Ligação copiada.'))
      .catch(() => toast.erro('Não foi possível copiar.'));
  },

  /* ── Referência ao namespace de vistas e admin (compatibilidade) ── */
  vistas: {},
  admin:  {}
};

/* ── Estado mutável interno (compatibilidade com templates inline) ── */
const _estado = {
  sessao: null,
  vistaAtiva: 'home',
  adminTab: 'leis-list',
  currentLawId: null,
  currentAcId: null,
  searchQuery: '',
  searchFilters: { tipo: 'todos' },
  _leiId: null,
  _editId: null,
  importStep: 1,
  importLeiId: null,
  importParsed: null,
  importParseResult: null,
  openInterpArt: null,
  openCitArt: null,
  _citCache: {},
  _docColapsado: {},
  _legQ: '', _legArea: '', _legEst: '', _legOrd: 'data-desc', _legSel: {},
  _jurQ: '', _jurTipo: '', _jurEst: '', _jurOrd: 'data-desc',
  _posRenderFn: null
};

/* ── Sincronizar sessão do store com _estado ──────────────────────── */
store.subscribe('sessao', (s) => { _estado.sessao = s; });

/* ══════════════════════════════════════════════════════════════════
   RENDER principal
   ══════════════════════════════════════════════════════════════════ */
const _container = () => document.getElementById('main-content') || document.getElementById('conteudo-principal') || document.body;

async function _render() {
  const vista = _estado.vistaAtiva;
  let html = '';
  try {
    switch (vista) {
      case 'home':            html = await renderHome(_estado); break;
      case 'legislacao':      html = await renderLegislacaoLista(_estado); break;
      case 'lei-detalhe':     html = await renderLeiDetalhe(_estado); break;
      case 'jurisprudencia':  html = await renderJurisprudenciaLista(_estado); break;
      case 'acordao-detalhe': html = await renderAcordaoDetalhe(_estado); break;
      case 'pesquisa':        html = await renderPesquisa(_estado); break;
      case 'privacidade':     html = renderPrivacidade(_estado); break;
      default:
        if (vista.startsWith('admin') || vista === 'alterar-pw')
          html = await renderAdmin(_estado);
        else
          html = await renderHome(_estado);
    }
  } catch (e) {
    console.error('[main] Render error', e);
    html = `<div class="erro-pagina"><h2>Erro ao carregar</h2><p>${h(e.message)}</p></div>`;
  }

  const el = _container();
  el.innerHTML = html;

  // Executa callback pós-render (ex: inicializar IntersectionObserver do TOC)
  if (_estado._posRenderFn) {
    const fn = _estado._posRenderFn;
    _estado._posRenderFn = null;
    try { fn(); } catch (e) { console.warn('[main] posRenderFn error', e); }
  }

  scrollTopo();
}

/* ══════════════════════════════════════════════════════════════════
   API call helper
   ══════════════════════════════════════════════════════════════════ */
async function _callApi(action, payload) {
  const resp = await fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload: payload || {} })
  });
  const json = await resp.json();
  if (!json.ok) throw new Error(json.erro || 'Erro desconhecido.');
  return json.dados;
}

/* ══════════════════════════════════════════════════════════════════
   PDF download helper
   ══════════════════════════════════════════════════════════════════ */
function _downloadBuffer(data, filename) {
  const blob = new Blob([data], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

/* ══════════════════════════════════════════════════════════════════
   NAVEGAÇÃO: interceta clicks em [data-vista] e ligações internas
   ══════════════════════════════════════════════════════════════════ */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-vista]');
  if (el) {
    e.preventDefault();
    const vista  = el.dataset.vista;
    const params = el.dataset.params ? JSON.parse(el.dataset.params) : {};
    STJ.navegar(vista, params);
  }
});

/* ══════════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
   ══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // Iniciar spinner global
  iniciarSpinnerGlobal();

  // Restaurar sessão guardada
  const sessao = carregarSessao();
  if (sessao) _estado.sessao = sessao;

  // Registar vistas no router
  router.registarTodos({
    'home':             (p) => { Object.assign(_estado, p, { vistaAtiva: 'home' });            return _render(); },
    'legislacao':       (p) => { Object.assign(_estado, p, { vistaAtiva: 'legislacao' });       return _render(); },
    'lei-detalhe':      (p) => { Object.assign(_estado, p, { vistaAtiva: 'lei-detalhe' });      return _render(); },
    'jurisprudencia':   (p) => { Object.assign(_estado, p, { vistaAtiva: 'jurisprudencia' });   return _render(); },
    'acordao-detalhe':  (p) => { Object.assign(_estado, p, { vistaAtiva: 'acordao-detalhe' });  return _render(); },
    'pesquisa':         (p) => { Object.assign(_estado, p, { vistaAtiva: 'pesquisa' });         return _render(); },
    'privacidade':      (p) => { Object.assign(_estado, p, { vistaAtiva: 'privacidade' });      return _render(); },
    'admin-login':      (p) => { Object.assign(_estado, p, { vistaAtiva: 'admin-login' });      return _render(); },
    'admin-leis':       (p) => { Object.assign(_estado, p, { vistaAtiva: 'admin-leis', adminTab: 'leis-list' });  return _render(); },
    'admin-artigos':    (p) => { Object.assign(_estado, p, { vistaAtiva: 'admin-artigos', adminTab: 'artigos' }); return _render(); },
    'admin-acordaos':   (p) => { Object.assign(_estado, p, { vistaAtiva: 'admin-acordaos', adminTab: 'acs-list' }); return _render(); },
  });

  // Compatibilidade: STJ.admin.nav e STJ.admin.render  
  STJ.admin.nav    = (tab) => { _estado.adminTab = tab; _render(); };
  STJ.admin.render = () => _render();

  // Render inicial
  await _render();
});
