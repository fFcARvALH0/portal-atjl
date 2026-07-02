/**
 * js/modules/home/view.js
 * Vista pública: página inicial com estatísticas, últimas leis e acórdãos.
 */

import * as api from '../../services/api.js';
import { h, formatarData, badgeEstadoLei } from '../../utils/format.js';

export async function renderHome(estado) {
  const [leis, acs] = await Promise.all([api.listarLeis(), api.listarAcordaos()]);
  const fd = formatarData;

  const cardLei = (l) =>
    `<div class="home-card" role="button" tabindex="0"
        onclick="STJ.navegar('lei-detalhe',{currentLawId:'${h(l.id)}'})"
        onkeydown="if(event.key==='Enter')STJ.navegar('lei-detalhe',{currentLawId:'${h(l.id)}'})">
      <div class="home-card-top">
        <span class="badge b-red">${h(l.area || 'Lei')}</span>
        ${badgeEstadoLei(l.estado)}
      </div>
      <div class="home-card-title">${h(l.titulo)}</div>
      <div class="home-card-meta">${h(l.numero)} · ${fd(l.dataPublicacao)}</div>
    </div>`;

  const itemAcordao = (a) =>
    `<div class="list-item" role="button" tabindex="0"
        onclick="STJ.navegar('acordao-detalhe',{currentAcId:'${h(a.id)}'})"
        onkeydown="if(event.key==='Enter')STJ.navegar('acordao-detalhe',{currentAcId:'${h(a.id)}'})">
      <span class="badge b-gray" style="flex-shrink:0;margin-top:2px">${h(a.tipo || 'STJ')}</span>
      <div class="list-item-body">
        <div class="list-item-title">${h(a.titulo)}</div>
        <div class="list-item-meta">${h(a.numero)} · ${fd(a.data)} · ${h(a.relator || '—')}</div>
      </div>
      <span class="list-arrow">›</span>
    </div>`;

  const vigentes = leis.filter((l) => l.estado === 'vigente' || l.estado === 'vigor').length;

  return `
    <div class="home-search-wrap">
      <div class="home-search-label">Pesquise legislação, acórdãos, artigos…</div>
      <div class="search-form home-search-form" role="search">
        <input type="search" id="home-q"
          placeholder="ex.: Código Civil, arrendamento, Acórdão 123/2024…"
          onkeydown="if(event.key==='Enter')_homeSearch()"
          aria-label="Campo de pesquisa">
        <button onclick="_homeSearch()">Pesquisar</button>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-box"><div class="stat-n">${leis.length}</div><div class="stat-l">Diplomas</div></div>
      <div class="stat-box"><div class="stat-n">${acs.length}</div><div class="stat-l">Acórdãos</div></div>
      <div class="stat-box"><div class="stat-n">${vigentes}</div><div class="stat-l">Em vigor</div></div>
      <div class="stat-box"><div class="stat-n">${leis.length + acs.length}</div><div class="stat-l">Documentos</div></div>
    </div>

    <div class="two-col">
      <div>
        <div class="section-title">Últimas Leis</div>
        <div class="home-cards">
          ${leis.slice(0, 6).map(cardLei).join('') ||
            '<div class="empty-state"><p>Nenhuma lei publicada.</p></div>'}
        </div>
        <div style="margin-top:.75rem;text-align:right">
          <button class="btn btn-outline btn-sm" onclick="STJ.navegar('legislacao')">
            Ver toda a legislação →
          </button>
        </div>
      </div>
      <div>
        <div class="section-title">Últimos Acórdãos</div>
        <div class="panel">
          ${acs.slice(0, 5).map(itemAcordao).join('') ||
            '<div class="empty-state"><p>Nenhum acórdão publicado.</p></div>'}
        </div>
        <div style="margin-top:.75rem;text-align:right">
          <button class="btn btn-outline btn-sm" onclick="STJ.navegar('jurisprudencia')">
            Ver jurisprudência →
          </button>
        </div>
      </div>
    </div>`;
}

// handler inline (chamado pelo template acima)
window._homeSearch = function () {
  STJ.estado.searchQuery = (document.getElementById('home-q') || {}).value || '';
  STJ.navegar('pesquisa');
};
