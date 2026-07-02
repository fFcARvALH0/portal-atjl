/**
 * js/modules/jurisprudence/list.js
 * Vista pública: lista de acórdãos com filtros e ordenação.
 */

import * as api from '../../services/api.js';
import { h, formatarData, badgeEstadoLei } from '../../utils/format.js';

export async function renderJurisprudenciaLista(estado) {
  const acs = await api.listarAcordaos();
  const fd  = formatarData;

  const q     = (estado._jurQ    || '').toLowerCase();
  const ord   = estado._jurOrd   || 'data-desc';
  const fTipo = estado._jurTipo  || '';
  const fEst  = estado._jurEst   || '';

  const tipos   = [...new Set(acs.map((a) => a.tipo || '').filter(Boolean))].sort();
  const estados = [...new Set(acs.map((a) => a.estado || '').filter(Boolean))].sort();

  const filtrados = acs.filter((a) => {
    if (fTipo && (a.tipo || '') !== fTipo) return false;
    if (fEst  && (a.estado || '') !== fEst) return false;
    if (q) {
      const hay = [a.titulo, a.numero, a.relator, a.tipo, a.sumario].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    switch (ord) {
      case 'titulo-asc':  return (a.titulo || '').localeCompare(b.titulo || '', 'pt');
      case 'titulo-desc': return (b.titulo || '').localeCompare(a.titulo || '', 'pt');
      case 'data-asc':    return (a.data || '') > (b.data || '') ? 1 : -1;
      case 'numero-asc':  return (a.numero || '').localeCompare(b.numero || '', 'pt');
      case 'relator-asc': return (a.relator || '').localeCompare(b.relator || '', 'pt');
      default:            return (a.data || '') < (b.data || '') ? 1 : -1;
    }
  });

  const optT = '<option value="">Todos os tipos</option>' +
    tipos.map((t) => `<option value="${h(t)}"${fTipo === t ? ' selected' : ''}>${h(t)}</option>`).join('');
  const optE = '<option value="">Todos os estados</option>' +
    estados.map((e) => `<option value="${h(e)}"${fEst === e ? ' selected' : ''}>${h(e)}</option>`).join('');
  const optO = [
    ['data-desc', 'Mais recentes'], ['data-asc', 'Mais antigos'],
    ['titulo-asc', 'A→Z'], ['numero-asc', 'Número'], ['relator-asc', 'Relator']
  ].map(([v, l]) => `<option value="${v}"${ord === v ? ' selected' : ''}>${l}</option>`).join('');

  const linhas = filtrados.map((a) => {
    const sumExc = (a.sumario || '').substring(0, 160).replace(/\n/g, ' ');
    return `<div class="ac-card" role="button" tabindex="0"
        onclick="STJ.navegar('acordao-detalhe',{currentAcId:'${h(a.id)}'})"
        onkeydown="if(event.key==='Enter')STJ.navegar('acordao-detalhe',{currentAcId:'${h(a.id)}'})">
      <div class="ac-card-top">
        <span class="badge b-gray">${h(a.tipo || 'STJ')}</span>
        <span class="ac-card-num">${h(a.numero)}</span>
        ${badgeEstadoLei(a.estado)}
      </div>
      <div class="ac-card-title">${h(a.titulo)}</div>
      ${sumExc ? `<div class="ac-card-sum">${h(sumExc)}${a.sumario && a.sumario.length > 160 ? '…' : ''}</div>` : ''}
      <div class="ac-card-meta">
        <span>${fd(a.data)}</span>
        <span>Rel. ${h(a.relator || '—')}</span>
      </div>
    </div>`;
  }).join('') || `<div class="empty-state"><p>Nenhum acórdão encontrado${q || fTipo || fEst ? ' para os filtros aplicados' : ''}.</p></div>`;

  return `
    <div class="list-toolbar">
      <div class="section-title" style="margin:0">
        Jurisprudência <span class="section-count">(${filtrados.length} de ${acs.length})</span>
      </div>
      <div class="list-filters">
        <div class="filter-search">
          <input type="search" id="jur-q" value="${h(estado._jurQ || '')}"
            placeholder="Pesquisar…" oninput="_jurFiltrar()"
            onkeydown="if(event.key==='Enter')_jurFiltrar()">
          <span class="filter-search-icon">⌕</span>
        </div>
        <select id="jur-tipo" onchange="_jurFiltrar()">${optT}</select>
        <select id="jur-est"  onchange="_jurFiltrar()">${optE}</select>
        <select id="jur-ord"  onchange="_jurFiltrar()">${optO}</select>
        ${q || fTipo || fEst ? '<button class="btn btn-outline btn-sm" onclick="_jurLimpar()">✕ Limpar</button>' : ''}
      </div>
    </div>
    <div class="ac-grid">${linhas}</div>`;
}

window._jurFiltrar = () => {
  STJ.estado._jurQ    = (document.getElementById('jur-q')    || {}).value || '';
  STJ.estado._jurTipo = (document.getElementById('jur-tipo') || {}).value || '';
  STJ.estado._jurEst  = (document.getElementById('jur-est')  || {}).value || '';
  STJ.estado._jurOrd  = (document.getElementById('jur-ord')  || {}).value || 'data-desc';
  STJ.render();
};
window._jurLimpar = () => {
  STJ.estado._jurQ = ''; STJ.estado._jurTipo = '';
  STJ.estado._jurEst = ''; STJ.estado._jurOrd = 'data-desc';
  STJ.render();
};
