/**
 * js/modules/admin/decisions/form.js
 * Admin: formulário de criação/edição de acórdão.
 */
import * as api from '../../../services/api.js';
import { h } from '../../../utils/format.js';

export async function renderAcForm(estado, id) {
  let ac = null;
  if (id) { const acs = await api.listarAcordaos(); ac = acs.find((a) => a.id === id) || null; }

  return `<div class="adm-panel">
    <div class="adm-hd">
      <span class="adm-title">${ac ? 'Editar Acórdão' : 'Novo Acórdão'}</span>
      <div style="display:flex;gap:.5rem">
        ${ac ? `<button class="btn btn-outline btn-sm" onclick="STJ.admin.historicoAcordao('${h(id)}')">📜 Histórico</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="STJ.admin.nav('acs-list')">‹ Voltar</button>
      </div>
    </div>
    <div class="adm-body">
      <div class="g3">
        <div class="f-row"><label for="ac-num">Número *</label>
          <input type="text" id="ac-num" value="${h(ac ? ac.numero || '' : '')}" placeholder="STJ-AC-0001/2024"></div>
        <div class="f-row"><label for="ac-data">Data</label>
          <input type="date" id="ac-data" value="${h(ac ? ac.data || '' : '')}"></div>
        <div class="f-row"><label for="ac-tipo">Tipo</label>
          <select id="ac-tipo">
            <option value="acordao"${ac && ac.tipo === 'acordao' ? ' selected' : ''}>Acórdão</option>
            <option value="despacho"${ac && ac.tipo === 'despacho' ? ' selected' : ''}>Despacho</option>
            <option value="sentenca"${ac && ac.tipo === 'sentenca' ? ' selected' : ''}>Sentença</option>
          </select></div>
      </div>
      <div class="f-row"><label for="ac-titulo">Título *</label>
        <input type="text" id="ac-titulo" value="${h(ac ? ac.titulo || '' : '')}"></div>
      <div class="g2">
        <div class="f-row"><label for="ac-relator">Relator</label>
          <input type="text" id="ac-relator" value="${h(ac ? ac.relator || '' : '')}"></div>
        <div class="f-row"><label for="ac-adj">Juízes Adjuntos</label>
          <input type="text" id="ac-adj" value="${h(ac ? ac.juizesAdjuntos || '' : '')}"></div>
      </div>
      <div class="g2">
        <div class="f-row"><label for="ac-vot">Votação</label>
          <input type="text" id="ac-vot" value="${h(ac ? ac.votacao || '' : '')}" placeholder="Unanimidade"></div>
        <div class="f-row"><label for="ac-estado">Estado</label>
          <select id="ac-estado">
            <option value="vigente"${ac && ac.estado === 'vigente' ? ' selected' : ''}>Vigente</option>
            <option value="revogada"${ac && ac.estado === 'revogada' ? ' selected' : ''}>Revogado</option>
          </select></div>
      </div>
      <div class="f-row"><label for="ac-arts">Artigos Aplicados</label>
        <input type="text" id="ac-arts" value="${h(ac ? ac.artigosAplicados || '' : '')}"
          placeholder="Artigo 1.º, Artigo 2.º, n.º 3"></div>
      <div class="f-row"><label for="ac-sumario">Sumário</label>
        <textarea id="ac-sumario" rows="5">${h(ac ? ac.sumario || '' : '')}</textarea></div>
      <div class="f-row"><label for="ac-factos">Factos Provados</label>
        <textarea id="ac-factos" rows="5">${h(ac ? ac.factos || '' : '')}</textarea></div>
      <div class="f-row"><label for="ac-quest">Questões Jurídicas</label>
        <textarea id="ac-quest" rows="5">${h(ac ? ac.questoes || '' : '')}</textarea></div>
      <div class="f-row"><label for="ac-fund">Fundamentação</label>
        <textarea id="ac-fund" rows="8">${h(ac ? ac.fundamentacao || '' : '')}</textarea></div>
      <div class="f-row"><label for="ac-dec">Decisão *</label>
        <textarea id="ac-dec" rows="5">${h(ac ? ac.decisao || '' : '')}</textarea></div>
      <div class="authorship-section"><div class="as-title">Autoria</div>
        <div class="g2">
          <div class="f-row"><label for="ac-elab">Elaborado por</label>
            <input type="text" id="ac-elab" value="${h(ac ? ac.elaboradoPor || '' : '')}"></div>
          <div class="f-row"><label for="ac-rev">Revisto por</label>
            <input type="text" id="ac-rev" value="${h(ac ? ac.revistoPor || '' : '')}"></div>
        </div>
      </div>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn-red btn-lg" onclick="STJ.admin._saveAc(${id ? `'${h(id)}'` : 'null'})">
          ${ac ? 'Guardar Alterações' : 'Publicar Acórdão'}
        </button>
        <button class="btn btn-outline" onclick="STJ.admin.nav('acs-list')">Cancelar</button>
      </div>
    </div>
  </div>`;
}

export async function handleSaveAc(id) {
  const numero = (document.getElementById('ac-num')    || {}).value || '';
  const titulo = (document.getElementById('ac-titulo') || {}).value || '';
  const decisao = (document.getElementById('ac-dec')   || {}).value || '';
  if (!numero || !titulo) { STJ.toast('Preencha o número e o título.'); return; }
  const dados = {
    numero, titulo, decisao,
    data:             (document.getElementById('ac-data')    || {}).value || '',
    tipo:             (document.getElementById('ac-tipo')    || {}).value || 'acordao',
    relator:          (document.getElementById('ac-relator') || {}).value || '',
    juizesAdjuntos:   (document.getElementById('ac-adj')     || {}).value || '',
    votacao:          (document.getElementById('ac-vot')     || {}).value || '',
    estado:           (document.getElementById('ac-estado')  || {}).value || 'vigente',
    artigosAplicados: (document.getElementById('ac-arts')    || {}).value || '',
    sumario:          (document.getElementById('ac-sumario') || {}).value || '',
    factos:           (document.getElementById('ac-factos')  || {}).value || '',
    questoes:         (document.getElementById('ac-quest')   || {}).value || '',
    fundamentacao:    (document.getElementById('ac-fund')    || {}).value || '',
    elaboradoPor:     (document.getElementById('ac-elab')    || {}).value || '',
    revistoPor:       (document.getElementById('ac-rev')     || {}).value || ''
  };
  try {
    if (id) { await STJ.apiAuth('atualizarAcordao', { id, dados }); STJ.toast('Acórdão atualizado.'); }
    else     { await STJ.apiAuth('criarAcordao',    { dados });       STJ.toast('Acórdão publicado.'); }
    STJ.admin.nav('acs-list');
  } catch (e) { STJ.toast(e.message); }
}
