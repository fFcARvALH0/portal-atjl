/**
 * js/modules/admin/laws/list.js
 * Admin: lista de leis, eliminação e histórico de versões.
 */
import * as api from '../../../services/api.js';
import { h, formatarData, badgeEstadoLei } from '../../../utils/format.js';

export async function renderLeisLista(estado) {
  const leis = await api.listarLeis();
  const fd = formatarData;

  const rows = leis.map((l) =>
    `<tr>
      <td><strong>${h(l.numero)}</strong></td>
      <td>${h(l.titulo)}</td>
      <td>${h(l.area || '—')}</td>
      <td>${fd(l.dataPublicacao)}</td>
      <td>${badgeEstadoLei(l.estado)}</td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm"
          onclick="STJ.estado._editId='${h(l.id)}';STJ.admin.nav('lei-edit')">Editar</button>
        <button class="btn btn-purple btn-sm"
          onclick="STJ.estado._leiId='${h(l.id)}';STJ.estado.importStep=1;STJ.estado.importParsed=null;STJ.admin.nav('import')">📥 Importar</button>
        <button class="btn btn-outline btn-sm"
          onclick="STJ.estado._leiId='${h(l.id)}';STJ.admin.nav('artigos')">Artigos</button>
        <button class="btn btn-danger btn-sm"
          onclick="STJ.admin._delLei('${h(l.id)}','${h(l.titulo)}')">Eliminar</button>
      </div></td>
    </tr>`
  ).join('') || '<tr><td colspan="6"><div class="empty-state"><p>Nenhuma lei. Clique em "Nova Lei".</p></div></td></tr>';

  return `<div class="adm-panel">
    <div class="adm-hd">
      <span class="adm-title">Leis Publicadas</span>
      <button class="btn btn-red" onclick="STJ.admin.nav('lei-new')">+ Nova Lei</button>
    </div>
    <div style="overflow-x:auto">
      <table class="manage-table">
        <thead><tr><th>Número</th><th>Título</th><th>Área</th><th>Data</th><th>Estado</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

export async function handleDelLei(id, titulo) {
  const ok = await STJ.modalConfirm({
    titulo: 'Eliminar Lei',
    mensagem: `Eliminar a lei "${titulo}" e todos os seus artigos? Esta ação não pode ser desfeita.`,
    textoConfirmar: 'Eliminar'
  });
  if (!ok) return;
  await STJ.apiAuth('eliminarLei', { id });
  STJ.toast('Lei eliminada.');
  STJ.admin.nav('leis-list');
}

export function handleHistoricoLei(id) {
  STJ.abrirHistoricoVersoes({
    tipo: 'Lei', id,
    campos: [
      { chave: 'titulo',            label: 'Título Completo' },
      { chave: 'area',              label: 'Área Jurídica' },
      { chave: 'estado',            label: 'Estado' },
      { chave: 'publicacaoOficial', label: 'Publicação Oficial' },
      { chave: 'autor',             label: 'Órgão Emitente' },
      { chave: 'ementa',            label: 'Ementa' }
    ]
  });
}
