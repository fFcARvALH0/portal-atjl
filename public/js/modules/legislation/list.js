/**
 * js/modules/legislation/list.js
 * Vista pública: lista de diplomas com filtros, ordenação e seleção múltipla.
 */

import * as api from '../../services/api.js';
import { h, formatarData, badgeEstadoLei } from '../../utils/format.js';

export async function renderLegislacaoLista(estado) {
  const leis = await api.listarLeis();
  const fd   = formatarData;
  const sd   = badgeEstadoLei;

  const q     = (estado._legQ    || '').toLowerCase();
  const ord   = estado._legOrd   || 'data-desc';
  const fArea = estado._legArea  || '';
  const fEst  = estado._legEst   || '';
  const sel   = estado._legSel || (estado._legSel = {});

  const areas   = [...new Set(leis.map((l) => l.area || '').filter(Boolean))].sort();
  const estados = [...new Set(leis.map((l) => l.estado || '').filter(Boolean))].sort();

  const filtradas = leis.filter((l) => {
    if (fArea && (l.area || '') !== fArea) return false;
    if (fEst  && (l.estado || '') !== fEst) return false;
    if (q) {
      const hay = [l.titulo, l.numero, l.autor, l.area, l.ementa].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    switch (ord) {
      case 'titulo-asc':  return (a.titulo || '').localeCompare(b.titulo || '', 'pt');
      case 'titulo-desc': return (b.titulo || '').localeCompare(a.titulo || '', 'pt');
      case 'data-asc':    return (a.dataPublicacao || '') > (b.dataPublicacao || '') ? 1 : -1;
      case 'numero-asc':  return (a.numero || '').localeCompare(b.numero || '', 'pt');
      default:            return (a.dataPublicacao || '') < (b.dataPublicacao || '') ? 1 : -1;
    }
  });

  const optA = '<option value="">Todas as áreas</option>' +
    areas.map((a) => `<option value="${h(a)}"${fArea === a ? ' selected' : ''}>${h(a)}</option>`).join('');
  const optE = '<option value="">Todos os estados</option>' +
    estados.map((e) => `<option value="${h(e)}"${fEst === e ? ' selected' : ''}>${h(e)}</option>`).join('');
  const optO = [
    ['data-desc', 'Mais recentes'], ['data-asc', 'Mais antigas'],
    ['titulo-asc', 'A→Z'], ['titulo-desc', 'Z→A'], ['numero-asc', 'Número']
  ].map(([v, l]) => `<option value="${v}"${ord === v ? ' selected' : ''}>${l}</option>`).join('');

  const idsVis = filtradas.map((l) => l.id);
  const nSel   = idsVis.filter((id) => sel[id]).length;

  const linhas = filtradas.map((l) => {
    const estadoK = l.estado || '';
    const dot = estadoK === 'vigor' || estadoK === 'vigente' ? 'dot-green'
      : estadoK === 'revogada' ? 'dot-red' : 'dot-orange';
    return `<div class="lei-row" role="button" tabindex="0"
        onclick="STJ.navegar('lei-detalhe',{currentLawId:'${h(l.id)}'})"
        onkeydown="if(event.key==='Enter')STJ.navegar('lei-detalhe',{currentLawId:'${h(l.id)}'})">
      <label class="lei-row-check" onclick="event.stopPropagation()">
        <input type="checkbox"${sel[l.id] ? ' checked' : ''}
          onchange="_legToggleSel('${h(l.id)}',this.checked)">
      </label>
      <span class="lei-row-area badge b-red">${h(l.area || 'Lei')}</span>
      <div class="lei-row-body">
        <div class="lei-row-title">${h(l.titulo)}</div>
        <div class="lei-row-meta">
          <span>${h(l.numero)}</span>
          <span>${fd(l.dataPublicacao)}</span>
          <span>${h(l.autor || '—')}</span>
        </div>
      </div>
      <span class="status-dot ${dot}" title="${h(l.estado || '—')}"></span>
    </div>`;
  }).join('') || `<div class="empty-state"><p>Nenhuma lei encontrada${q || fArea || fEst ? ' para os filtros aplicados' : ''}.</p></div>`;

  return `
    <div class="list-toolbar">
      <div class="section-title" style="margin:0">
        Legislação <span class="section-count">(${filtradas.length} de ${leis.length})</span>
      </div>
      <div class="list-filters">
        <div class="filter-search">
          <input type="search" id="leg-q" value="${h(estado._legQ || '')}"
            placeholder="Pesquisar…" oninput="_legFiltrar()"
            onkeydown="if(event.key==='Enter')_legFiltrar()">
          <span class="filter-search-icon">⌕</span>
        </div>
        <select id="leg-area" onchange="_legFiltrar()">${optA}</select>
        <select id="leg-est"  onchange="_legFiltrar()">${optE}</select>
        <select id="leg-ord"  onchange="_legFiltrar()">${optO}</select>
        ${q || fArea || fEst ? '<button class="btn btn-outline btn-sm" onclick="_legLimpar()">✕ Limpar</button>' : ''}
      </div>
    </div>
    <div class="batch-bar">
      <label>
        <input type="checkbox"${nSel === idsVis.length && idsVis.length > 0 ? ' checked' : ''}
          onchange="_legToggleSelTodos(this.checked,['${idsVis.join("','")}'])">
        Selecionar visíveis
      </label>
      <span>${nSel ? `${nSel} selecionada(s)` : ''}</span>
      <button class="btn btn-outline btn-sm"${nSel ? '' : ' disabled'}
        onclick="STJ.exportarPdfLote('lei',Object.keys(STJ.estado._legSel||{}))">
        ⬇ Exportar PDF
      </button>
      ${nSel ? '<button class="btn btn-outline btn-sm" onclick="STJ.estado._legSel={};STJ.render()">✕ Limpar</button>' : ''}
    </div>
    <div class="lei-list">${linhas}</div>`;
}

/* ── Handlers inline ─────────────────────────────────────────────── */
window._legToggleSel = (id, checked) => {
  const s = STJ.estado._legSel || (STJ.estado._legSel = {});
  if (checked) s[id] = true; else delete s[id];
  STJ.render();
};
window._legToggleSelTodos = (checked, ids) => {
  const s = STJ.estado._legSel || (STJ.estado._legSel = {});
  (ids || []).forEach((id) => { if (!id) return; if (checked) s[id] = true; else delete s[id]; });
  STJ.render();
};
window._legFiltrar = () => {
  STJ.estado._legQ    = (document.getElementById('leg-q')    || {}).value || '';
  STJ.estado._legArea = (document.getElementById('leg-area') || {}).value || '';
  STJ.estado._legEst  = (document.getElementById('leg-est')  || {}).value || '';
  STJ.estado._legOrd  = (document.getElementById('leg-ord')  || {}).value || 'data-desc';
  STJ.render();
};
window._legLimpar = () => {
  STJ.estado._legQ = ''; STJ.estado._legArea = '';
  STJ.estado._legEst = ''; STJ.estado._legOrd = 'data-desc';
  STJ.render();
};
