/**
 * js/modules/admin/articles/list.js
 * Admin: lista de artigos de uma lei com ações de gestão.
 */
import * as api from '../../../services/api.js';
import { h, formatarData } from '../../../utils/format.js';

export async function renderArtigosLista(estado) {
  const leis  = await api.listarLeis();
  const leiId = estado._leiId || (leis[0] ? leis[0].id : null);
  const lei   = leis.find((l) => l.id === leiId);
  const optLeis = leis.map((l) =>
    `<option value="${h(l.id)}"${l.id === leiId ? ' selected' : ''}>${h(l.numero)} — ${h(l.titulo)}</option>`
  ).join('');

  let artigos = [];
  if (leiId) {
    const resp = await api.obterLei(leiId);
    artigos = (resp && resp.artigos) ? resp.artigos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)) : [];
  }

  const rows = artigos.map((a) =>
    `<tr>
      <td><strong>${h(a.numero)}</strong></td>
      <td>${h(a.titulo || '—')}</td>
      <td class="art-text-preview">${h((a.texto || '').substring(0, 80))}${a.texto && a.texto.length > 80 ? '…' : ''}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm"
            onclick="STJ.estado._editId='${h(a.id)}';STJ.admin.nav('artigo-edit')">Editar</button>
          ${a.interpretacaoTexto
            ? `<button class="btn btn-purple btn-sm"
                onclick="STJ.estado._editId='${h(a.id)}';STJ.admin.nav('interp')">⚖ Interp.</button>`
            : `<button class="btn btn-outline btn-sm"
                onclick="STJ.estado._editId='${h(a.id)}';STJ.admin.nav('interp')">+ Interp.</button>`}
          <button class="btn btn-danger btn-sm"
            onclick="STJ.admin._delArtigo('${h(a.id)}','${h(a.numero)}')">Eliminar</button>
        </div>
      </td>
    </tr>`
  ).join('') || '<tr><td colspan="4"><div class="empty-state">Sem artigos. Use a importação ou adicione manualmente.</div></td></tr>';

  return `<div class="adm-panel">
    <div class="adm-hd">
      <span class="adm-title">Artigos</span>
      <div style="display:flex;gap:.5rem;align-items:center">
        <select id="art-lei-sel" onchange="STJ.estado._leiId=this.value;STJ.admin.nav('artigos')">${optLeis}</select>
        <button class="btn btn-red" onclick="STJ.admin.nav('artigo-new')">+ Novo Artigo</button>
        <button class="btn btn-outline btn-sm"
          onclick="STJ.estado._leiId='${h(leiId)}';STJ.estado.importStep=1;STJ.admin.nav('import')">📥 Importar</button>
        ${artigos.length ? `<button class="btn btn-danger btn-sm"
          onclick="STJ.admin._apagarTodosArtigos('${h(leiId)}')">🗑 Apagar todos</button>` : ''}
      </div>
    </div>
    ${lei ? `<div style="padding:.5rem 1rem;font-size:12px;color:var(--muted)">
      Lei: <strong>${h(lei.titulo)}</strong> · ${artigos.length} artigo(s)
    </div>` : ''}
    <div style="overflow-x:auto">
      <table class="manage-table">
        <thead><tr><th>Número</th><th>Título</th><th>Texto (excerto)</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

export async function handleDelArtigo(id, numero) {
  const ok = await STJ.modalConfirm({
    titulo: 'Eliminar Artigo',
    mensagem: `Eliminar o artigo ${numero}? Esta ação não pode ser desfeita.`,
    textoConfirmar: 'Eliminar'
  });
  if (!ok) return;
  await STJ.apiAuth('eliminarArtigo', { id });
  STJ.toast('Artigo eliminado.');
  STJ.admin.nav('artigos');
}

export async function handleApagarTodosArtigos(leiId) {
  const ok = await STJ.modalConfirm({
    titulo: 'Apagar todos os artigos',
    mensagem: 'Apagará TODOS os artigos desta lei. Esta ação não pode ser desfeita.',
    textoConfirmar: 'Apagar tudo'
  });
  if (!ok) return;
  await STJ.apiAuth('eliminarTodosArtigos', { leiId });
  STJ.toast('Todos os artigos eliminados.');
  STJ.admin.nav('artigos');
}

export function handleHistoricoArtigo(id) {
  STJ.abrirHistoricoVersoes({
    tipo: 'Artigo', id,
    campos: [
      { chave: 'numero', label: 'Número' },
      { chave: 'titulo', label: 'Epígrafe' },
      { chave: 'texto',  label: 'Texto' }
    ]
  });
}
