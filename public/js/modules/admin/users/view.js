/**
 * js/modules/admin/users/view.js
 * Admin: gestão de utilizadores (listar, criar, alterar role/estado).
 */
import * as api from '../../../services/api.js';
import { h, formatarDataHora, badgeRole } from '../../../utils/format.js';

export async function renderUtilizadores(estado) {
  const lista = await api.listarUtilizadores(estado.sessao.token, estado.sessao.csrf);

  const rows = lista.map((u) =>
    `<tr class="${u.ativo === false ? 'row-inativo' : ''}">
      <td><strong>${h(u.username)}</strong></td>
      <td>${h(u.nome || '—')}</td>
      <td>${badgeRole(u.role)}</td>
      <td><span class="badge ${u.ativo === false ? 'badge-cinza' : 'badge-verde'}">${u.ativo === false ? 'Inativo' : 'Ativo'}</span></td>
      <td>${formatarDataHora(u.ultimoLogin)}</td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap">
        <select id="role-${h(u.username)}" onchange="">
          <option value="admin"${u.role === 'admin' ? ' selected' : ''}>Admin</option>
          <option value="editor"${u.role === 'editor' ? ' selected' : ''}>Editor</option>
          <option value="leitor"${u.role === 'leitor' ? ' selected' : ''}>Leitor</option>
        </select>
        <button class="btn btn-outline btn-sm"
          onclick="STJ.admin._atualizarUser('${h(u.username)}')">Guardar</button>
        <button class="btn btn-${u.ativo === false ? 'red' : 'danger'} btn-sm"
          onclick="STJ.admin._atualizarUser('${h(u.username)}',${u.ativo !== false})">
          ${u.ativo === false ? 'Ativar' : 'Desativar'}</button>
      </div></td>
    </tr>`
  ).join('');

  return `<div class="adm-panel">
    <div class="adm-hd">
      <span class="adm-title">Gestão de Utilizadores</span>
      <button class="btn btn-red" onclick="STJ.admin._novoUserPrompt()">+ Novo Utilizador</button>
    </div>
    <div style="overflow-x:auto">
      <table class="manage-table">
        <thead><tr><th>Utilizador</th><th>Nome</th><th>Papel</th><th>Estado</th><th>Último login</th><th>Ações</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">Sem utilizadores.</td></tr>'}</tbody>
      </table>
    </div>
  </div>`;
}

export async function handleNovoUser() {
  const username = await STJ.modalInput({ titulo: 'Novo Utilizador', label: 'Nome de utilizador', placeholder: 'ex.: joao.silva', textoConfirmar: 'Criar' });
  if (!username) return;
  try {
    const res = await STJ.apiAuth('criarUtilizador', { dados: { username, role: 'leitor' } });
    if (res && res.passwordTemporaria) {
      await STJ.modalInfo({ titulo: 'Utilizador criado', mensagem: `Password temporária: <strong>${h(res.passwordTemporaria)}</strong><br><br>Comunique ao utilizador e peça que a altere no primeiro acesso.`, textoBotao: 'OK' });
    } else {
      STJ.toast('Utilizador criado.');
    }
    STJ.render();
  } catch (e) { STJ.toast(e.message); }
}

export async function handleAtualizarUser(username, ativo) {
  const role = (document.getElementById('role-' + username) || {}).value || undefined;
  try {
    await STJ.apiAuth('alterarRoleUtilizador', { username, role, ativo });
    STJ.toast('Utilizador atualizado.');
    STJ.render();
  } catch (e) { STJ.toast(e.message); }
}
