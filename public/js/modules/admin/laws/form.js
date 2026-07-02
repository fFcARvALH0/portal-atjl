/**
 * js/modules/admin/laws/form.js
 * Admin: formulário de criação/edição de lei.
 */
import * as api from '../../../services/api.js';
import { h } from '../../../utils/format.js';

export async function renderLeiForm(estado, id) {
  let lei = null;
  if (id) { const leis = await api.listarLeis(); lei = leis.find((l) => l.id === id) || null; }
  const areas = ['Cível', 'Penal', 'Administrativo', 'Constitucional', 'Laboral', 'Fiscal', 'Outros'];
  const optAreas = areas.map((o) => `<option${lei && lei.area === o ? ' selected' : ''}>${o}</option>`).join('');

  return `<div class="adm-panel">
    <div class="adm-hd">
      <span class="adm-title">${lei ? 'Editar Lei' : 'Nova Lei'}</span>
      <div style="display:flex;gap:.5rem">
        ${lei ? `<button class="btn btn-outline btn-sm" onclick="STJ.admin.historicoLei('${h(lei.id)}')">📜 Histórico de Versões</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="STJ.admin.nav('leis-list')">‹ Voltar</button>
      </div>
    </div>
    <div class="adm-body">
      <div class="f-row"><label for="l-data">Data de Publicação</label>
        <input type="date" id="l-data" value="${h(lei ? lei.dataPublicacao || '' : '')}"></div>
      <div class="f-row"><label for="l-titulo">Título Completo *</label>
        <input type="text" id="l-titulo" value="${h(lei ? lei.titulo || '' : '')}"></div>
      <div class="g3">
        <div class="f-row"><label for="l-area">Área Jurídica</label>
          <select id="l-area">${optAreas}</select></div>
        <div class="f-row"><label for="l-estado">Estado</label>
          <select id="l-estado">
            <option value="vigor"${lei && lei.estado === 'vigor' ? ' selected' : ''}>Em vigor</option>
            <option value="alterada"${lei && lei.estado === 'alterada' ? ' selected' : ''}>Alterada</option>
            <option value="revogada"${lei && lei.estado === 'revogada' ? ' selected' : ''}>Revogada</option>
            <option value="consolidada"${lei && lei.estado === 'consolidada' ? ' selected' : ''}>Consolidada</option>
          </select></div>
        <div class="f-row"><label for="l-pub">Publicação Oficial</label>
          <input type="text" id="l-pub" value="${h(lei ? lei.publicacaoOficial || '' : '')}" placeholder="D.R. n.º 052/2026"></div>
      </div>
      <div class="f-row"><label for="l-autor">Órgão Emitente</label>
        <input type="text" id="l-autor" value="${h(lei ? lei.autor || '' : '')}"></div>
      <div class="f-row"><label for="l-ementa">Ementa</label>
        <textarea id="l-ementa">${h(lei ? lei.ementa || '' : '')}</textarea></div>
      <div class="authorship-section"><div class="as-title">Autoria e Responsabilidade</div>
        <div class="g3">
          <div class="f-row"><label for="l-promulg">Promulgado por</label>
            <input type="text" id="l-promulg" value="${h(lei ? lei.promulgadoPor || '' : '')}"></div>
          <div class="f-row"><label for="l-elabor">Elaborado por</label>
            <input type="text" id="l-elabor" value="${h(lei ? lei.elaboradoPor || '' : '')}"></div>
          <div class="f-row"><label for="l-revist">Revisto por</label>
            <input type="text" id="l-revist" value="${h(lei ? lei.revistoPor || '' : '')}"></div>
        </div>
      </div>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn-red btn-lg" onclick="STJ.admin._saveLei(${id ? `'${h(id)}'` : 'null'})">
          ${lei ? 'Guardar Alterações' : 'Publicar Lei'}
        </button>
        <button class="btn btn-outline" onclick="STJ.admin.nav('leis-list')">Cancelar</button>
      </div>
    </div>
  </div>`;
}

export async function handleSaveLei(id) {
  const titulo = (document.getElementById('l-titulo') || {}).value || '';
  if (!titulo) { STJ.toast('Preencha o título.'); return; }
  const dados = {
    titulo,
    dataPublicacao:  (document.getElementById('l-data')    || {}).value || '',
    area:            (document.getElementById('l-area')    || {}).value || '',
    estado:          (document.getElementById('l-estado')  || {}).value || '',
    publicacaoOficial: (document.getElementById('l-pub')   || {}).value || '',
    autor:           (document.getElementById('l-autor')   || {}).value || '',
    ementa:          (document.getElementById('l-ementa')  || {}).value || '',
    promulgadoPor:   (document.getElementById('l-promulg') || {}).value || '',
    elaboradoPor:    (document.getElementById('l-elabor')  || {}).value || '',
    revistoPor:      (document.getElementById('l-revist')  || {}).value || ''
  };
  try {
    if (id) { await STJ.apiAuth('atualizarLei', { id, dados }); STJ.toast('Lei atualizada.'); }
    else     { await STJ.apiAuth('criarLei',    { dados });       STJ.toast('Lei publicada.'); }
    STJ.admin.nav('leis-list');
  } catch (e) { STJ.toast(e.message); }
}
