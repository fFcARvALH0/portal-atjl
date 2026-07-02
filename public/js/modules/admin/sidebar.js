/**
 * js/modules/admin/sidebar.js
 * Sidebar de navegação da área reservada.
 */
import { h } from '../../utils/format.js';

export function renderSidebar(estado) {
  const s    = estado.sessao;
  const role = s ? s.utilizador.role : '';
  const tab  = estado.adminTab || 'leis-list';

  const sb = (t, icon, label) =>
    `<button class="sb-item${tab === t ? ' active' : ''}" onclick="STJ.admin.nav('${t}')">
      <span style="font-size:14px" aria-hidden="true">${icon}</span>${label}
    </button>`;

  const isPower = role === 'admin' || role === 'administrador' || role === 'editor' || role === 'redator';
  const isAdmin = role === 'admin' || role === 'administrador';

  return `<nav class="admin-sidebar" aria-label="Menu de administração">
    <div class="sb-section">Legislação</div>
    ${sb('leis-list', '📋', 'Gerir Leis')}
    ${isPower ? sb('lei-new', '➕', 'Nova Lei') + sb('import', '📥', 'Importar Documento') : ''}
    <div class="sb-section">Artigos</div>
    ${sb('artigos', '📑', 'Gerir Artigos')}
    ${sb('interp',  '⚖',  'Interpretações')}
    <div class="sb-section">Jurisprudência</div>
    ${sb('acs-list', '🏛', 'Gerir Acórdãos')}
    ${isPower ? sb('ac-new', '➕', 'Novo Acórdão') : ''}
    <div class="sb-section">Conta</div>
    ${sb('favoritos',  '★',  'Meus Favoritos')}
    ${sb('alterar-pw', '🔑', 'Alterar Password')}
    ${isAdmin ? `
      <div class="sb-section">Administração</div>
      ${sb('utilizadores', '👥', 'Utilizadores')}
      ${sb('auditoria',    '📊', 'Auditoria')}` : ''}
    <div style="border-top:1px solid var(--border-lt);padding:.75rem 1rem;margin-top:.25rem">
      <div style="font-size:11px;color:var(--muted);margin-bottom:.4rem">
        ${h(s ? s.utilizador.username : '')}
      </div>
      <button class="btn btn-outline btn-sm" onclick="STJ.admin._logout()" style="width:100%">
        🚪 Terminar sessão
      </button>
    </div>
  </nav>`;
}
