/**
 * js/modules/admin/audit/view.js
 * Admin: visualização do registo de auditoria.
 */
import * as api from '../../../services/api.js';
import { h, formatarDataHora } from '../../../utils/format.js';

export async function renderAuditoria(estado) {
  const logs = await api.obterAuditoria(estado.sessao.token, estado.sessao.csrf, {});

  const iconePorAccao = {
    criar: '➕', editar: '✏️', eliminar: '🗑', importar: '📥',
    login_sucesso: '🔐', logout: '🚪', login_bloqueado: '🔒',
    alterar_password: '🔑', restaurar_versao: '↩', rgpd_anonimizar: '🛡'
  };

  const rows = logs.map((l) =>
    `<tr>
      <td style="white-space:nowrap;font-size:11px">${formatarDataHora(l.timestamp)}</td>
      <td>${h(l.utilizador)}</td>
      <td>${iconePorAccao[l.accao] || '•'} ${h(l.accao)}</td>
      <td>${h(l.entidade || '—')}</td>
      <td style="font-size:12px;color:var(--muted)">${h(l.detalhes || '—')}</td>
    </tr>`
  ).join('') || '<tr><td colspan="5"><div class="empty-state">Sem registos.</div></td></tr>';

  return `<div class="adm-panel">
    <div class="adm-hd">
      <span class="adm-title">Auditoria</span>
      <span style="font-size:12px;color:var(--muted)">${logs.length} entradas</span>
    </div>
    <div style="overflow-x:auto">
      <table class="manage-table">
        <thead><tr><th>Data/Hora</th><th>Utilizador</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}
