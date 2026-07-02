/**
 * js/modules/admin/articles/interpretation.js
 * Admin: painel de interpretação jurídica de um artigo.
 */
import * as api from '../../../services/api.js';
import { h } from '../../../utils/format.js';

export async function renderInterpPanel(estado) {
  const leiId = estado._leiId || '';
  const id    = estado._editId || '';
  let artigo  = null;
  if (leiId) {
    const resp = await api.obterLei(leiId);
    artigo = resp && resp.artigos ? resp.artigos.find((a) => a.id === id) : null;
  }
  if (!artigo) return '<div class="empty-state"><p>Selecione um artigo primeiro.</p></div>';

  return `<div class="adm-panel">
    <div class="adm-hd">
      <span class="adm-title">Interpretação — ${h(artigo.numero)}</span>
      <button class="btn btn-outline btn-sm" onclick="STJ.admin.nav('artigos')">‹ Voltar</button>
    </div>
    <div class="adm-body">
      <div class="panel" style="margin-bottom:1rem;padding:.75rem 1rem;font-size:12.5px">
        <strong>${h(artigo.numero)}${artigo.titulo ? ' — ' + h(artigo.titulo) : ''}</strong><br>
        <span style="color:var(--muted)">${h((artigo.texto || '').substring(0, 200))}…</span>
      </div>
      <div class="f-row"><label for="it-texto">Texto Interpretativo</label>
        <textarea id="it-texto" rows="6">${h(artigo.interpretacaoTexto || '')}</textarea></div>
      <div class="g2">
        <div class="f-row"><label for="it-princ">Princípios Aplicáveis</label>
          <textarea id="it-princ" rows="3">${h(artigo.principios || '')}</textarea></div>
        <div class="f-row"><label for="it-ratio">Ratio Decidendi</label>
          <textarea id="it-ratio" rows="3">${h(artigo.ratio || '')}</textarea></div>
      </div>
      <div class="f-row"><label for="it-enq">Enquadramento Jurídico</label>
        <textarea id="it-enq" rows="3">${h(artigo.enquadramento || '')}</textarea></div>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn-red btn-lg" onclick="_saveInterp('${h(id)}')">Guardar Interpretação</button>
        <button class="btn btn-outline" onclick="STJ.admin.nav('artigos')">Cancelar</button>
      </div>
    </div>
  </div>`;
}

window._saveInterp = async function (id) {
  const dados = {
    interpretacaoTexto: (document.getElementById('it-texto') || {}).value || '',
    principios:         (document.getElementById('it-princ') || {}).value || '',
    ratio:              (document.getElementById('it-ratio') || {}).value || '',
    enquadramento:      (document.getElementById('it-enq')   || {}).value || ''
  };
  try {
    await STJ.apiAuth('atualizarArtigo', { id, dados });
    STJ.toast('Interpretação guardada.');
    STJ.admin.nav('artigos');
  } catch (e) { STJ.toast(e.message); }
};
