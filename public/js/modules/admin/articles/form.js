/**
 * js/modules/admin/articles/form.js
 * Admin: formulário de criação/edição de artigo.
 */
import * as api from '../../../services/api.js';
import { h } from '../../../utils/format.js';

export async function renderArtigoForm(estado, id) {
  const leis = await api.listarLeis();
  const leiId = estado._leiId || (leis[0] ? leis[0].id : null);

  let artigo = null;
  if (id) {
    const artigos = await api.listarLeis().then(() => {
      return fetch('/api', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'obterLei', payload: { id: leiId } })
      }).then((r) => r.json()).then((d) => d.dados && d.dados.artigos ? d.dados.artigos : []);
    });
    artigo = artigos.find((a) => a.id === id) || null;
  }

  const optLeis = leis.map((l) =>
    `<option value="${h(l.id)}"${l.id === (artigo ? artigo.leiId : leiId) ? ' selected' : ''}>${h(l.numero)} — ${h(l.titulo)}</option>`
  ).join('');

  return `<div class="adm-panel">
    <div class="adm-hd">
      <span class="adm-title">${artigo ? 'Editar Artigo' : 'Novo Artigo'}</span>
      <div style="display:flex;gap:.5rem">
        ${artigo ? `<button class="btn btn-outline btn-sm" onclick="STJ.admin.historicoArtigo('${h(id)}')">📜 Histórico</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="STJ.admin.nav('artigos')">‹ Voltar</button>
      </div>
    </div>
    <div class="adm-body">
      <div class="g2">
        <div class="f-row"><label for="a-lei">Lei *</label>
          <select id="a-lei">${optLeis}</select></div>
        <div class="f-row"><label for="a-num">Número do Artigo *</label>
          <input type="text" id="a-num" value="${h(artigo ? artigo.numero || '' : '')}" placeholder="Artigo 1.º"></div>
      </div>
      <div class="f-row"><label for="a-titulo">Epígrafe / Título</label>
        <input type="text" id="a-titulo" value="${h(artigo ? artigo.titulo || '' : '')}"
          placeholder="ex.: Âmbito de aplicação"></div>
      <div class="f-row"><label for="a-texto">Texto do Artigo *</label>
        <textarea id="a-texto" rows="14">${h(artigo ? artigo.texto || '' : '')}</textarea></div>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn-red btn-lg" onclick="STJ.admin._saveArtigo(${id ? `'${h(id)}'` : 'null'})">
          ${artigo ? 'Guardar' : 'Criar Artigo'}
        </button>
        <button class="btn btn-outline" onclick="STJ.admin.nav('artigos')">Cancelar</button>
      </div>
    </div>
  </div>`;
}

export async function handleSaveArtigo(id) {
  const leiId  = (document.getElementById('a-lei')    || {}).value || '';
  const numero = (document.getElementById('a-num')    || {}).value || '';
  const titulo = (document.getElementById('a-titulo') || {}).value || '';
  const texto  = (document.getElementById('a-texto')  || {}).value || '';
  if (!leiId || !numero || !texto) { STJ.toast('Preencha lei, número e texto.'); return; }
  const dados  = { leiId, numero, titulo, texto };
  try {
    if (id) { await STJ.apiAuth('atualizarArtigo', { id, dados }); STJ.toast('Artigo atualizado.'); }
    else     { await STJ.apiAuth('criarArtigo',    { dados });       STJ.toast('Artigo criado.'); }
    STJ.admin.nav('artigos');
  } catch (e) { STJ.toast(e.message); }
}
