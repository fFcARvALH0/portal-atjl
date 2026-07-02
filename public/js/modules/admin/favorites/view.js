/**
 * js/modules/admin/favorites/view.js
 * Admin: lista e gestão dos favoritos do utilizador autenticado.
 */
import * as api from '../../../services/api.js';
import { h, formatarData } from '../../../utils/format.js';

export async function renderFavoritos(estado) {
  const favs = await api.listarFavoritos(estado.sessao.token, estado.sessao.csrf);
  const fd   = formatarData;

  const iconTipo = { Lei: '📋', Artigo: '📑', Acordao: '🏛' };

  const items = favs.map((f) =>
    `<div class="fav-item">
      <span class="fav-icone" aria-hidden="true">${iconTipo[f.tipo] || '★'}</span>
      <div class="fav-body">
        <div class="fav-titulo">${h(f.titulo || f.entidadeId)}</div>
        <div class="fav-meta">${h(f.tipo)} · Adicionado ${fd(f.criado)}</div>
      </div>
      <div class="fav-actions">
        <button class="btn btn-outline btn-sm"
          onclick="${f.tipo === 'Lei' ? `STJ.navegar('lei-detalhe',{currentLawId:'${h(f.entidadeId)}'})` :
                    f.tipo === 'Acordao' ? `STJ.navegar('acordao-detalhe',{currentAcId:'${h(f.entidadeId)}'})` :
                    `STJ.navegar('legislacao')`}">Ver</button>
        <button class="btn btn-danger btn-sm"
          onclick="STJ.admin._removerFav('${h(f.entidadeId)}')">✕</button>
      </div>
    </div>`
  ).join('') || '<div class="empty-state"><p>Sem favoritos. Adicione leis ou acórdãos à sua lista.</p></div>';

  return `<div class="adm-panel">
    <div class="adm-hd">
      <span class="adm-title">Meus Favoritos</span>
      <span style="font-size:12px;color:var(--muted)">${favs.length} favorito(s)</span>
    </div>
    <div style="padding:1rem">${items}</div>
  </div>`;
}

export async function handleRemoverFav(entidadeId) {
  await STJ.apiAuth('removerFavorito', { id: entidadeId });
  STJ.toast('Removido dos favoritos.');
  STJ.render();
}
