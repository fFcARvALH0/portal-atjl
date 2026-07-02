/**
 * js/modules/admin/index.js
 * Orquestrador da área reservada: determina qual a sub-vista a renderizar.
 */

import { h } from '../../utils/format.js';
import { renderLogin, handleLogin, handleLogout, renderAlterarPw, handleAlterarPw } from './login.js';
import { renderSidebar } from './sidebar.js';
import { renderLeisLista } from './laws/list.js';
import { renderLeiForm }   from './laws/form.js';
import { renderImportar }  from './laws/import.js';
import { renderArtigosLista } from './articles/list.js';
import { renderArtigoForm }   from './articles/form.js';
import { renderInterpPanel }  from './articles/interpretation.js';
import { renderAcsList }  from './decisions/list.js';
import { renderAcForm }   from './decisions/form.js';
import { renderUtilizadores } from './users/view.js';
import { renderAuditoria }    from './audit/view.js';
import { renderFavoritos }    from './favorites/view.js';

export async function renderAdmin(estado) {
  if (!estado.sessao) return renderLogin();

  let conteudo = '';
  switch (estado.adminTab) {
    case 'leis-list':    conteudo = await renderLeisLista(estado);           break;
    case 'lei-new':      conteudo = await renderLeiForm(estado, null);       break;
    case 'lei-edit':     conteudo = await renderLeiForm(estado, estado._editId); break;
    case 'import':       conteudo = await renderImportar(estado);            break;
    case 'artigos':      conteudo = await renderArtigosLista(estado);        break;
    case 'artigo-new':   conteudo = await renderArtigoForm(estado, null);    break;
    case 'artigo-edit':  conteudo = await renderArtigoForm(estado, estado._editId); break;
    case 'interp':       conteudo = await renderInterpPanel(estado);         break;
    case 'acs-list':     conteudo = await renderAcsList(estado);             break;
    case 'ac-new':       conteudo = await renderAcForm(estado, null);        break;
    case 'ac-edit':      conteudo = await renderAcForm(estado, estado._editId);  break;
    case 'utilizadores': conteudo = await renderUtilizadores(estado);        break;
    case 'auditoria':    conteudo = await renderAuditoria(estado);           break;
    case 'favoritos':    conteudo = await renderFavoritos(estado);           break;
    case 'alterar-pw':   conteudo = renderAlterarPw();                       break;
    default:             conteudo = await renderLeisLista(estado);
  }

  return `<div class="section-title">Área Reservada</div>
    <div class="admin-layout">
      ${renderSidebar(estado)}
      <div>${conteudo}</div>
    </div>`;
}

// Expor funções de ação no STJ.admin para compatibilidade com handlers inline
import * as lawsActions    from './laws/list.js';
import * as formActions    from './laws/form.js';
import * as importActions  from './laws/import.js';
import * as artActions     from './articles/list.js';
import * as artFormActions from './articles/form.js';
import * as interpActions  from './articles/interpretation.js';
import * as acActions      from './decisions/list.js';
import * as acFormActions  from './decisions/form.js';
import * as userActions    from './users/view.js';
import * as favActions     from './favorites/view.js';

// Estas atribuições permitem que o código inline (onclick="STJ.admin._login()") continue a funcionar
Object.assign(STJ.admin, {
  renderLogin,   // exposto para compat
  renderAlterarPw,
  _login:     handleLogin,
  _logout:    handleLogout,
  _alterarPw: handleAlterarPw,

  _saveLei:    formActions.handleSaveLei,
  _delLei:     lawsActions.handleDelLei,
  historicoLei: lawsActions.handleHistoricoLei,

  _importarPasso2:   importActions.handleImportarPasso2,
  _confirmarImport:  importActions.handleConfirmarImport,
  _handleDrop:       importActions.handleDrop,
  _handleFileSelect: importActions.handleFileSelect,
  _processarFicheiro: importActions.processarFicheiro,
  _lerDocx:          importActions.lerDocx,
  _lerPdf:           importActions.lerPdf,

  _saveArtigo:     artFormActions.handleSaveArtigo,
  _delArtigo:      artActions.handleDelArtigo,
  _apagarTodosArtigos: artActions.handleApagarTodosArtigos,
  historicoArtigo: artActions.handleHistoricoArtigo,

  _saveAc:       acFormActions.handleSaveAc,
  _delAc:        acActions.handleDelAc,
  historicoAcordao: acActions.handleHistoricoAcordao,

  _novoUserPrompt:  userActions.handleNovoUser,
  _atualizarUser:   userActions.handleAtualizarUser,

  _removerFav: favActions.handleRemoverFav,
});
