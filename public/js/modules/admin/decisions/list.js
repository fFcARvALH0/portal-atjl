/**
 * js/modules/admin/decisions/list.js
 * Admin: lista e eliminação de acórdãos.
 */
import * as api from '../../../services/api.js';
import { h, formatarData, badgeEstadoLei } from '../../../utils/format.js';

export async function renderAcsList(estado) {
  const acs = await api.listarAcordaos();
  const fd  = formatarData;

  const rows = acs.map((a) =>
    `<tr>
      <td><strong>${h(a.numero)}</strong></td>
      <td>${h(a.titulo)}</td>
      <td>${fd(a.data)}</td>
      <td>${h(a.relator || '—')}</td>
      <td>${badgeEstadoLei(a.estado)}</td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm"
          onclick="STJ.estado._editId='${h(a.id)}';STJ.admin.nav('ac-edit')">Editar</button>
        <button class="btn btn-danger btn-sm"
          onclick="STJ.admin._delAc('${h(a.id)}','${h(a.titulo)}')">Eliminar</button>
      </div></td>
    </tr>`
  ).join('') || '<tr><td colspan="6"><div class="empty-state">Sem acórdãos.</div></td></tr>';

  return `<div class="adm-panel">
    <div class="adm-hd">
      <span class="adm-title">Acórdãos</span>
      <button class="btn btn-red" onclick="STJ.admin.nav('ac-new')">+ Novo Acórdão</button>
    </div>
    <div style="overflow-x:auto">
      <table class="manage-table">
        <thead><tr><th>Número</th><th>Título</th><th>Data</th><th>Relator</th><th>Estado</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

export async function handleDelAc(id, titulo) {
  const ok = await STJ.modalConfirm({
    titulo: 'Eliminar Acórdão',
    mensagem: `Eliminar "${titulo}"? Esta ação não pode ser desfeita.`,
    textoConfirmar: 'Eliminar'
  });
  if (!ok) return;
  await STJ.apiAuth('eliminarAcordao', { id });
  STJ.toast('Acórdão eliminado.');
  STJ.admin.nav('acs-list');
}

export function handleHistoricoAcordao(id) {
  STJ.abrirHistoricoVersoes({
    tipo: 'Acordao', id,
    campos: [
      { chave: 'numero',   label: 'Número' },
      { chave: 'titulo',   label: 'Título' },
      { chave: 'decisao',  label: 'Decisão' },
      { chave: 'estado',   label: 'Estado' }
    ]
  });
}
