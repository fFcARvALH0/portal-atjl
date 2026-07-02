/**
 * js/modules/admin/login.js
 * Formulários e handlers de autenticação da área reservada.
 */
import * as api from '../../services/api.js';
import { h } from '../../utils/format.js';

export function renderLogin() {
  return `<div id="login-screen"><div class="login-box">
    <div class="logo-icon" style="margin:0 auto 1rem;width:60px;height:60px;font-size:22px" aria-hidden="true">⚖</div>
    <h2>Área Reservada</h2>
    <p>Magistrados e funcionários autorizados</p>
    <div class="f-row">
      <label for="adm-user">Utilizador</label>
      <input type="text" id="adm-user" autocomplete="username" autocapitalize="none" spellcheck="false"
        onkeydown="if(event.key==='Enter')STJ.admin._login()">
    </div>
    <div class="f-row">
      <label for="adm-pw">Palavra-passe</label>
      <input type="password" id="adm-pw" autocomplete="current-password"
        onkeydown="if(event.key==='Enter')STJ.admin._login()">
    </div>
    <button class="btn btn-red" style="width:100%;justify-content:center" onclick="STJ.admin._login()">
      Entrar
    </button>
    <div class="login-error" id="login-err"></div>
  </div></div>`;
}

export async function handleLogin() {
  const username = (document.getElementById('adm-user') || {}).value || '';
  const pw       = (document.getElementById('adm-pw')   || {}).value || '';
  if (!username || !pw) { _loginErro('Preencha o utilizador e a palavra-passe.'); return; }
  try {
    const res = await api.login(username, pw);
    STJ.guardarSessao(res);
    if (res.forcarMudancaPassword) {
      STJ.toast('Deve alterar a sua palavra-passe antes de continuar.');
      STJ.admin.nav('alterar-pw');
      return;
    }
    STJ.admin.nav('leis-list');
  } catch (e) { _loginErro(e.message || 'Credenciais inválidas.'); }
}

function _loginErro(msg) {
  const el = document.getElementById('login-err');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

export async function handleLogout() {
  const s = STJ.estado.sessao;
  if (s) { try { await api.logout(s.token); } catch { /* ignorar */ } }
  STJ.guardarSessao(null);
  STJ.navegar('home');
}

export function renderAlterarPw() {
  return `<div class="adm-panel"><div class="adm-hd">
    <span class="adm-title">Alterar Palavra-Passe</span>
  </div><div class="adm-body">
    <div class="f-row"><label for="pw-atual">Palavra-passe atual</label>
      <input type="password" id="pw-atual" autocomplete="current-password"></div>
    <div class="f-row"><label for="pw-nova">Nova palavra-passe (mín. 10 caracteres)</label>
      <input type="password" id="pw-nova" autocomplete="new-password"></div>
    <div class="f-row"><label for="pw-conf">Confirmar nova palavra-passe</label>
      <input type="password" id="pw-conf" autocomplete="new-password"></div>
    <button class="btn btn-red" onclick="STJ.admin._alterarPw()">Guardar nova palavra-passe</button>
  </div></div>`;
}

export async function handleAlterarPw() {
  const atual = (document.getElementById('pw-atual') || {}).value || '';
  const nova  = (document.getElementById('pw-nova')  || {}).value || '';
  const conf  = (document.getElementById('pw-conf')  || {}).value || '';
  if (!atual || !nova) { STJ.toast('Preencha todos os campos.'); return; }
  if (nova !== conf) { STJ.toast('As passwords não coincidem.'); return; }
  try {
    await STJ.apiAuth('alterarPassword', { atual, nova });
    STJ.toast('Palavra-passe alterada com sucesso.');
    STJ.admin.nav('leis-list');
  } catch (e) { STJ.toast(e.message); }
}
