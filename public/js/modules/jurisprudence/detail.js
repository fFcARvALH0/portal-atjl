/**
 * js/modules/jurisprudence/detail.js
 * Vista pública: detalhe completo de um acórdão.
 */

import * as api from '../../services/api.js';
import { h, formatarData, badgeEstadoLei, nl2br } from '../../utils/format.js';

export async function renderAcordaoDetalhe(estado) {
  const ac = await api.obterAcordao(estado.currentAcId);
  if (!ac) return '<p class="erro-pagina">Acórdão não encontrado.</p>';

  const fd = formatarData;

  function np(str) {
    return (str || '').split(/\n{2,}/).filter(Boolean)
      .map((p) => `<p>${nl2br(p.trim())}</p>`).join('');
  }

  function sec(id, titulo, txt, destaque) {
    if (!txt) return '';
    return `<div class="ac-sec${destaque ? ' ac-sec-destaque' : ''}">
      <div class="ac-sec-hd"><span>${titulo}</span></div>
      <div class="ac-sec-body" id="${id}">${np(txt)}</div>
    </div>`;
  }

  const artTags = ac.artigosAplicados
    ? `<div class="art-tags-row">
        <span class="art-tags-label">Artigos aplicados:</span>
        ${String(ac.artigosAplicados).split(',').filter(Boolean)
          .map((t) => `<span class="art-chip">${h(t.trim())}</span>`).join('')}
      </div>` : '';

  const authBar = (ac.elaboradoPor || ac.revistoPor)
    ? `<div class="authorship-bar">
        ${ac.elaboradoPor ? `<div class="auth-item"><div class="k">Elaborado por</div><div class="v">${h(ac.elaboradoPor)}</div></div>` : ''}
        ${ac.revistoPor   ? `<div class="auth-item"><div class="k">Revisto por</div><div class="v">${h(ac.revistoPor)}</div></div>` : ''}
      </div>` : '';

  return `
    <nav class="breadcrumb" aria-label="Localização">
      <button class="bc-item" onclick="STJ.navegar('jurisprudencia')">Jurisprudência</button>
      <span class="bc-sep">›</span>
      <span class="bc-item bc-cur">${h(ac.titulo || ac.numero)}</span>
    </nav>

    <div class="doc-card ac-doc-card">
      <div class="ac-header">
        <div>
          <div class="doc-ref">${h(ac.numero)}</div>
          <div class="doc-title">${h(ac.titulo)}</div>
          ${authBar}
        </div>
        <div class="ac-meta-grid">
          <div class="ac-meta-item"><div class="k">Data</div><div class="v">${fd(ac.data)}</div></div>
          <div class="ac-meta-item"><div class="k">Tribunal</div><div class="v">${h(ac.tipo || 'STJ')}</div></div>
          <div class="ac-meta-item"><div class="k">Estado</div><div class="v">${badgeEstadoLei(ac.estado)}</div></div>
          <div class="ac-meta-item"><div class="k">Relator</div><div class="v">${h(ac.relator || '—')}</div></div>
          <div class="ac-meta-item"><div class="k">Juízes adjuntos</div><div class="v">${h(ac.juizesAdjuntos || '—')}</div></div>
          <div class="ac-meta-item"><div class="k">Votação</div><div class="v">${h(ac.votacao || '—')}</div></div>
        </div>
      </div>
      <div class="doc-actions">
        <button class="btn btn-outline btn-sm" onclick="STJ.exportarPdf('acordao','${h(ac.id)}')">⬇ PDF</button>
        <button class="btn btn-outline btn-sm" onclick="window.print()">🖨 Imprimir</button>
        <button class="btn btn-outline btn-sm" onclick="STJ.copiarLigacao()">🔗 Copiar ligação</button>
        ${estado.sessao ? `<button class="btn btn-outline btn-sm"
          onclick="STJ.apiAuth('adicionarFavorito',{tipo:'Acordao',id:'${h(ac.id)}'}).then(()=>STJ.toast('Adicionado aos favoritos.'))">
          ★ Favorito</button>` : ''}
      </div>
    </div>

    ${sec('ac-sumario', '📋 Sumário', ac.sumario, true)}
    ${sec('ac-factos',  'Factos Provados', ac.factos, false)}
    ${sec('ac-questoes','Questões Jurídicas', ac.questoes, false)}
    ${sec('ac-fund',    'Fundamentação', ac.fundamentacao, false)}
    ${ac.decisao ? `<div class="ac-sec">
      <div class="ac-sec-hd"><span>Decisão</span></div>
      <div class="ac-sec-body">
        <div class="decision-box">${np(ac.decisao)}</div>
        ${artTags}
      </div>
    </div>` : ''}`;
}
