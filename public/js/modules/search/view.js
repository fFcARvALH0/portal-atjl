/**
 * js/modules/search/view.js
 * Vista pública: pesquisa avançada multi-entidade.
 */

import * as api from '../../services/api.js';
import { h, badgeEstadoLei } from '../../utils/format.js';

export async function renderPesquisa(estado) {
  const q = estado.searchQuery || '';
  const f = estado.searchFilters || { tipo: 'todos' };

  const [resultados] = await Promise.all([
    q ? api.pesquisar(q, f) : Promise.resolve([])
  ]);
  const lista = (resultados && resultados.resultados) ? resultados.resultados : (resultados || []);

  const linhas = lista.map((r) => {
    const fn = r.tipo === 'Lei'    ? `STJ.navegar('lei-detalhe',{currentLawId:'${h(r.id)}'})`
      : r.tipo === 'Acordao'       ? `STJ.navegar('acordao-detalhe',{currentAcId:'${h(r.id)}'})`
      : r.leiId                    ? `STJ.navegar('lei-detalhe',{currentLawId:'${h(r.leiId)}'})` : '';
    return `<div class="result-card" role="button" tabindex="0"
        onclick="${fn}" onkeydown="if(event.key==='Enter'){${fn}}">
      <div class="result-type">${h(r.tipo)}</div>
      <div class="result-title">${h(r.titulo || r.numero || '')}</div>
      <div class="result-excerpt">${h((r.excerto || r.texto || '').substring(0, 220))}</div>
      <div class="result-foot">
        <span>${h(r.numero || r.meta || '')}</span>
        ${badgeEstadoLei(r.estado)}
      </div>
    </div>`;
  }).join('');

  return `
    <div class="section-title">Pesquisa Avançada</div>
    <div class="pesq-panel">
      <div class="search-form" role="search">
        <input type="search" id="sq" value="${h(q)}"
          placeholder="Pesquise legislação, acórdãos, artigos, texto…"
          onkeydown="if(event.key==='Enter')_pesquisar()"
          aria-label="Pesquisa avançada">
        <button onclick="_pesquisar()">Pesquisar</button>
      </div>
      <div class="pesq-filtros">
        <select id="ft" onchange="_pesquisar()">
          <option value="tudo"${f.tipo === 'tudo'   ? ' selected' : ''}>Todos</option>
          <option value="leis"${f.tipo === 'leis'   ? ' selected' : ''}>Leis</option>
          <option value="artigos"${f.tipo === 'artigos' ? ' selected' : ''}>Artigos</option>
          <option value="acordaos"${f.tipo === 'acordaos' ? ' selected' : ''}>Acórdãos</option>
        </select>
      </div>
    </div>
    ${q ? `<div class="pesq-info"><strong>${lista.length}</strong> resultado(s) para «<strong>${h(q)}</strong>»</div>` : ''}
    ${lista.length ? linhas
      : q ? '<div class="empty-state panel" style="padding:2rem"><p>Sem resultados.</p></div>'
          : '<div class="empty-state panel" style="padding:2rem"><p>Introduza um termo de pesquisa.</p></div>'}`;
}

window._pesquisar = function () {
  STJ.estado.searchQuery = (document.getElementById('sq') || {}).value || '';
  STJ.estado.searchFilters = { tipo: (document.getElementById('ft') || {}).value || 'tudo' };
  STJ.render();
};
