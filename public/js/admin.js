/* ════════════════════════════════════════════════════════════════════
   js/admin.js  (equivalente a Cliente_Admin.html)
   Área reservada: login (utilizador + password, SEM 2FA), CRUD de
   leis, artigos, acórdãos, utilizadores, auditoria e favoritos.

   ALTERAÇÕES NESTA MIGRAÇÃO:
     1. Login passou de email+password para NOME DE UTILIZADOR +
        password. Ver STJ.admin.renderLogin / STJ.admin._login.
     2. O passo de verificação por código 2FA foi removido (decisão
        do cliente) — o login fica completo num único passo.
   ════════════════════════════════════════════════════════════════════ */

/* ── RENDER PRINCIPAL DA ÁREA ADMIN ─────────────────────────────── */
STJ.admin.render = async function () {
  if (!STJ.estado.sessao) return STJ.admin.renderLogin();
  var sidebar = STJ.admin.sidebar();
  var conteudo = '';
  switch (STJ.estado.adminTab) {
    case 'leis-list':    conteudo = await STJ.admin.leisList(); break;
    case 'lei-new':      conteudo = await STJ.admin.leiForm(null); break;
    case 'lei-edit':     conteudo = await STJ.admin.leiForm(STJ.estado._editId); break;
    case 'import':       conteudo = await STJ.admin.importar(); break;
    case 'artigos':      conteudo = await STJ.admin.artigosList(); break;
    case 'artigo-new':   conteudo = await STJ.admin.artigoForm(null); break;
    case 'artigo-edit':  conteudo = await STJ.admin.artigoForm(STJ.estado._editId); break;
    case 'interp':       conteudo = await STJ.admin.interpPanel(); break;
    case 'acs-list':     conteudo = await STJ.admin.acsList(); break;
    case 'ac-new':       conteudo = await STJ.admin.acForm(null); break;
    case 'ac-edit':      conteudo = await STJ.admin.acForm(STJ.estado._editId); break;
    case 'utilizadores': conteudo = await STJ.admin.utilizadores(); break;
    case 'auditoria':    conteudo = await STJ.admin.auditoria(); break;
    case 'favoritos':    conteudo = await STJ.admin.favoritos(); break;
    case 'alterar-pw':   conteudo = STJ.admin.alterarPwForm(); break;
    default:             conteudo = await STJ.admin.leisList();
  }
  return '<div class="section-title">Área Reservada</div><div class="admin-layout">' + sidebar + '<div>' + conteudo + '</div></div>';
};

STJ.admin.nav = function (tab) { STJ.estado.adminTab = tab; STJ.render(); };

STJ.admin.sidebar = function () {
  var s = STJ.estado.sessao;
  var role = s ? s.utilizador.role : '';
  var sb = function (tab, icon, label) {
    return '<button class="sb-item' + (STJ.estado.adminTab === tab ? ' active' : '') + '" onclick="STJ.admin.nav(\'' + tab + '\')">' +
      '<span style="font-size:14px" aria-hidden="true">' + icon + '</span>' + label + '</button>';
  };
  var perm = function (tabsHtml, role2) { return ['administrador', 'redator'].indexOf(role2) !== -1 ? tabsHtml : ''; };

  return '<nav class="admin-sidebar" aria-label="Menu de administração">' +
    '<div class="sb-section">Legislação</div>' +
    sb('leis-list', '📋', 'Gerir Leis') +
    perm(sb('lei-new', '➕', 'Nova Lei') + sb('import', '📥', 'Importar Documento'), role) +
    '<div class="sb-section">Artigos</div>' +
    sb('artigos', '📑', 'Gerir Artigos') +
    sb('interp', '⚖', 'Interpretações') +
    '<div class="sb-section">Jurisprudência</div>' +
    sb('acs-list', '🏛', 'Gerir Acórdãos') +
    perm(sb('ac-new', '➕', 'Novo Acórdão'), role) +
    '<div class="sb-section">Conta</div>' +
    sb('favoritos', '★', 'Meus Favoritos') +
    sb('alterar-pw', '🔑', 'Alterar Password') +
    (role === 'administrador' ? '<div class="sb-section">Administração</div>' + sb('utilizadores', '👥', 'Utilizadores') + sb('auditoria', '📊', 'Auditoria') : '') +
    '<div style="border-top:1px solid var(--border-lt);padding:.75rem 1rem;margin-top:.25rem">' +
    '<div style="font-size:11px;color:var(--muted);margin-bottom:.4rem">' + STJ.h(s ? s.utilizador.username : '') + '</div>' +
    '<button class="btn btn-outline btn-sm" onclick="STJ.admin._logout()" style="width:100%">🚪 Terminar sessão</button></div>' +
    '</nav>';
};

/* ── LOGIN (utilizador + password — sem 2FA) ──────────────────── */
STJ.admin.renderLogin = function () {
  return '<div id="login-screen"><div class="login-box">' +
    '<div class="logo-icon" style="margin:0 auto 1rem;width:60px;height:60px;font-size:22px" aria-hidden="true">⚖</div>' +
    '<h2>Área Reservada</h2>' +
    '<p>Magistrados e funcionários autorizados</p>' +
    '<div class="f-row"><label for="adm-user">Utilizador</label><input type="text" id="adm-user" autocomplete="username" autocapitalize="none" spellcheck="false" onkeydown="if(event.key===\'Enter\')STJ.admin._login()"></div>' +
    '<div class="f-row"><label for="adm-pw">Palavra-passe</label><input type="password" id="adm-pw" autocomplete="current-password" onkeydown="if(event.key===\'Enter\')STJ.admin._login()"></div>' +
    '<button class="btn btn-red" style="width:100%;justify-content:center" onclick="STJ.admin._login()">Entrar</button>' +
    '<div class="login-error" id="login-err"></div>' +
    '</div></div>';
};

STJ.admin._login = async function () {
  var username = STJ.g('adm-user'), pw = STJ.g('adm-pw');
  if (!username || !pw) { STJ.admin._loginErro('Preencha o utilizador e a palavra-passe.'); return; }
  var res = await STJ.api('login', { username: username, password: pw });
  if (res && res.ok === false) { STJ.admin._loginErro(res.erro); return; }
  STJ.guardarSessao(res);
  if (res.forcarMudancaPassword) { STJ.toast('Deve alterar a sua palavra-passe antes de continuar.'); STJ.admin.nav('alterar-pw'); return; }
  STJ.admin.nav('leis-list');
};

STJ.admin._loginErro = function (msg) {
  var el = document.getElementById('login-err');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
};

STJ.admin._logout = async function () {
  if (STJ.estado.sessao) await STJ.api('logout', { token: STJ.estado.sessao.token });
  STJ.guardarSessao(null);
  STJ.navegar('home');
};

/* ── ALTERAR PASSWORD ───────────────────────────────────────────── */
STJ.admin.alterarPwForm = function () {
  return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Alterar Palavra-Passe</span></div><div class="adm-body">' +
    '<div class="f-row"><label for="pw-atual">Palavra-passe atual</label><input type="password" id="pw-atual" autocomplete="current-password"></div>' +
    '<div class="f-row"><label for="pw-nova">Nova palavra-passe (mín. 10 caracteres)</label><input type="password" id="pw-nova" autocomplete="new-password"></div>' +
    '<div class="f-row"><label for="pw-conf">Confirmar nova palavra-passe</label><input type="password" id="pw-conf" autocomplete="new-password"></div>' +
    '<button class="btn btn-red" onclick="STJ.admin._alterarPw()">Guardar nova palavra-passe</button>' +
    '</div></div>';
};
STJ.admin._alterarPw = async function () {
  var atual = STJ.g('pw-atual'), nova = STJ.g('pw-nova'), conf = STJ.g('pw-conf');
  if (!atual || !nova) { STJ.toast('Preencha todos os campos.'); return; }
  if (nova !== conf) { STJ.toast('As passwords não coincidem.'); return; }
  var res = await STJ.apiAuth('alterarPassword', { atual: atual, nova: nova });
  if (res && res.ok === false) { STJ.toast(res.erro); return; }
  STJ.toast('Palavra-passe alterada com sucesso.');
  STJ.admin.nav('leis-list');
};

/* ── LEIS ─────────────────────────────────────────────────────────── */
STJ.admin.leisList = async function () {
  var leis = await STJ.api('listarLeis');
  var h = STJ.h, fd = STJ.fmtDate, sd = STJ.stBadge;
  var rows = (leis || []).map(function (l) {
    return '<tr><td><strong>' + h(l.numero) + '</strong></td><td>' + h(l.titulo) + '</td><td>' + h(l.area || '—') + '</td><td>' + fd(l.dataPublicacao) + '</td><td>' + sd(l.estado) + '</td>' +
      '<td><div style="display:flex;gap:4px;flex-wrap:wrap">' +
      '<button class="btn btn-outline btn-sm" onclick="STJ.estado._editId=\'' + h(l.id) + '\';STJ.admin.nav(\'lei-edit\')">Editar</button>' +
      '<button class="btn btn-purple btn-sm" onclick="STJ.estado._leiId=\'' + h(l.id) + '\';STJ.estado.importStep=1;STJ.estado.importParsed=null;STJ.admin.nav(\'import\')">📥 Importar</button>' +
      '<button class="btn btn-outline btn-sm" onclick="STJ.estado._leiId=\'' + h(l.id) + '\';STJ.admin.nav(\'artigos\')">Artigos</button>' +
      '<button class="btn btn-danger btn-sm" onclick="STJ.admin._delLei(\'' + h(l.id) + '\',\'' + h(l.titulo) + '\')">Eliminar</button>' +
      '</div></td></tr>';
  }).join('') || '<tr><td colspan="6"><div class="empty-state"><p>Nenhuma lei. Clique em "Nova Lei".</p></div></td></tr>';
  return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Leis Publicadas</span><button class="btn btn-red" onclick="STJ.admin.nav(\'lei-new\')">+ Nova Lei</button></div>' +
    '<div style="overflow-x:auto"><table class="manage-table"><thead><tr><th>Número</th><th>Título</th><th>Área</th><th>Data</th><th>Estado</th><th>Ações</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
};

STJ.admin.leiForm = async function (id) {
  var lei = null;
  if (id) { var leis = await STJ.api('listarLeis'); lei = (leis || []).find(function (l) { return l.id === id; }); }
  var h = STJ.h;
  var areas = ['Cível', 'Penal', 'Administrativo', 'Constitucional', 'Laboral', 'Fiscal', 'Outros'];
  var optAreas = areas.map(function (o) { return '<option' + (lei && lei.area === o ? ' selected' : '') + '>' + o + '</option>'; }).join('');
  return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">' + (lei ? 'Editar Lei' : 'Nova Lei') + '</span><div style="display:flex;gap:.5rem">' +
    (lei ? '<button class="btn btn-outline btn-sm" onclick="STJ.admin.historicoLei(\'' + h(lei.id) + '\')">📜 Histórico de Versões</button>' : '') +
    '<button class="btn btn-outline btn-sm" onclick="STJ.admin.nav(\'leis-list\')">‹ Voltar</button></div></div>' +
    '<div class="adm-body">' +
    '<div class="f-row"><label for="l-data">Data de Publicação</label><input type="date" id="l-data" value="' + h(lei ? lei.dataPublicacao : '') + '"></div>' +
    '<div class="f-row"><label for="l-titulo">Título Completo *</label><input type="text" id="l-titulo" value="' + h(lei ? lei.titulo : '') + '"></div>' +
    '<div class="g3">' +
    '<div class="f-row"><label for="l-area">Área Jurídica</label><select id="l-area">' + optAreas + '</select></div>' +
    '<div class="f-row"><label for="l-estado">Estado</label><select id="l-estado"><option value="vigor"' + (lei && lei.estado === 'vigor' ? ' selected' : '') + '>Em vigor</option><option value="alterada"' + (lei && lei.estado === 'alterada' ? ' selected' : '') + '>Alterada</option><option value="revogada"' + (lei && lei.estado === 'revogada' ? ' selected' : '') + '>Revogada</option><option value="consolidada"' + (lei && lei.estado === 'consolidada' ? ' selected' : '') + '>Consolidada</option></select></div>' +
    '<div class="f-row"><label for="l-pub">Publicação Oficial</label><input type="text" id="l-pub" value="' + h(lei ? lei.publicacaoOficial || '' : '') + '" placeholder="D.R. n.º 052/2026"></div></div>' +
    '<div class="f-row"><label for="l-autor">Órgão Emitente</label><input type="text" id="l-autor" value="' + h(lei ? lei.autor || '' : '') + '"></div>' +
    '<div class="f-row"><label for="l-ementa">Ementa</label><textarea id="l-ementa">' + h(lei ? lei.ementa || '' : '') + '</textarea></div>' +
    '<div class="authorship-section"><div class="as-title">Autoria e Responsabilidade</div><div class="g3">' +
    '<div class="f-row"><label for="l-promulg">Promulgado por</label><input type="text" id="l-promulg" value="' + h(lei ? lei.promulgadoPor || '' : '') + '"></div>' +
    '<div class="f-row"><label for="l-elabor">Elaborado por</label><input type="text" id="l-elabor" value="' + h(lei ? lei.elaboradoPor || '' : '') + '"></div>' +
    '<div class="f-row"><label for="l-revist">Revisto por</label><input type="text" id="l-revist" value="' + h(lei ? lei.revistoPor || '' : '') + '"></div>' +
    '</div></div>' +
    '<div style="display:flex;gap:.5rem"><button class="btn btn-red btn-lg" onclick="STJ.admin._saveLei(' + (id ? '\'' + h(id) + '\'' : 'null') + ')">' + (lei ? 'Guardar Alterações' : 'Publicar Lei') + '</button>' +
    '<button class="btn btn-outline" onclick="STJ.admin.nav(\'leis-list\')">Cancelar</button></div>' +
    '</div></div>';
};

STJ.admin._saveLei = async function (id) {
  var titulo = STJ.g('l-titulo');
  if (!titulo) { STJ.toast('Preencha o título.'); return; }
  var dados = { titulo: titulo, dataPublicacao: STJ.g('l-data'), area: STJ.gv('l-area'), estado: STJ.gv('l-estado'), publicacaoOficial: STJ.g('l-pub'), autor: STJ.g('l-autor'), ementa: STJ.g('l-ementa'), promulgadoPor: STJ.g('l-promulg'), elaboradoPor: STJ.g('l-elabor'), revistoPor: STJ.g('l-revist') };
  if (id) { await STJ.apiAuth('atualizarLei', { id: id, dados: dados }); STJ.toast('Lei atualizada.'); }
  else { await STJ.apiAuth('criarLei', { dados: dados }); STJ.toast('Lei publicada.'); }
  STJ.admin.nav('leis-list');
};

STJ.admin._delLei = async function (id, titulo) {
  if (!await STJ.modalConfirm({ titulo: 'Eliminar Lei', mensagem: 'Eliminar a lei "' + titulo + '" e todos os seus artigos? Esta ação não pode ser desfeita.', textoConfirmar: 'Eliminar' })) return;
  await STJ.apiAuth('eliminarLei', { id: id });
  STJ.toast('Lei eliminada.');
  STJ.admin.nav('leis-list');
};

/** Campos do snapshot de "Lei" relevantes para a comparação visual. */
STJ.admin.historicoLei = function (id) {
  STJ.abrirHistoricoVersoes({
    tipo: 'Lei',
    id: id,
    campos: [
      { chave: 'titulo', label: 'Título Completo' },
      { chave: 'area', label: 'Área Jurídica' },
      { chave: 'estado', label: 'Estado' },
      { chave: 'publicacaoOficial', label: 'Publicação Oficial' },
      { chave: 'autor', label: 'Órgão Emitente' },
      { chave: 'ementa', label: 'Ementa' }
    ]
  });
};

/* ── IMPORTAÇÃO ─────────────────────────────────────────────────── */
STJ.admin.importar = async function () {
  var leis = await STJ.api('listarLeis');
  var step = STJ.estado.importStep || 1;
  var leiId = STJ.estado.importLeiId || STJ.estado._leiId || (leis[0] ? leis[0].id : null);
  var h = STJ.h;
  var optLeis = (leis || []).map(function (l) { return '<option value="' + h(l.id) + '"' + (l.id === leiId ? ' selected' : '') + '>' + h(l.numero) + ' — ' + h(l.titulo) + '</option>'; }).join('');
  var wiz = function (s1, s2, s3) {
    return '<div class="wiz-steps"><div class="wiz-step ' + s1 + '"><div class="step-n">' + (s1 === 'done' ? '✓' : '1') + '</div>Origem</div>' +
      '<div class="wiz-step ' + s2 + '"><div class="step-n">' + (s2 === 'done' ? '✓' : '2') + '</div>Pré-visualização</div>' +
      '<div class="wiz-step ' + s3 + '"><div class="step-n">3</div>Confirmar</div></div>';
  };

  if (step === 1) {
    return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Importar Documento</span></div>' + wiz('active', '', '') +
      '<div class="adm-body">' +
      (!leis.length ? '<div style="background:var(--orange-bg);padding:.75rem;font-size:12.5px;color:var(--orange);border:1px solid rgba(191,54,12,.2);margin-bottom:1rem">⚠ Crie primeiro uma lei em "Nova Lei".</div>' : '') +
      '<div class="f-row"><label for="imp-lei">Lei de Destino *</label><select id="imp-lei" onchange="STJ.estado.importLeiId=this.value">' + optLeis + '</select></div>' +
      '<div class="drop-zone" id="drop-zone" role="button" tabindex="0" aria-label="Arraste um ficheiro ou clique para selecionar" onclick="document.getElementById(\'file-input\').click()" ondragover="event.preventDefault();this.classList.add(\'drag-over\')" ondragleave="this.classList.remove(\'drag-over\')" ondrop="STJ.admin._handleDrop(event)">' +
      '<div style="font-size:36px;margin-bottom:.6rem" aria-hidden="true">📄</div>' +
      '<p><strong>Arraste o ficheiro aqui</strong> ou clique para selecionar</p>' +
      '<small>Suporta: .docx · .txt · .md · .pdf — Máximo 10 MB</small></div>' +
      '<input type="file" id="file-input" accept=".docx,.txt,.md,.text,.pdf" onchange="STJ.admin._handleFileSelect(event)">' +
      '<div class="or-div">ou cole o texto diretamente</div>' +
      '<div class="f-row"><label for="imp-text">Texto do Documento</label><textarea id="imp-text" rows="12" placeholder="TÍTULO I — Das Disposições Gerais&#10;CAPÍTULO I — Âmbito&#10;Artigo 1.º&#10;Âmbito&#10;1. A presente lei..."></textarea></div>' +
      '<div style="display:flex;gap:.5rem"><button class="btn btn-red btn-lg" onclick="STJ.admin._importarPasso2()" ' + (!leis.length ? 'disabled' : '') + '>Analisar Documento →</button><button class="btn btn-outline" onclick="STJ.admin.nav(\'leis-list\')">Cancelar</button></div>' +
      '</div></div>';
  }

  if (step === 2) {
    var parseResult = STJ.estado.importParseResult || {};
    var parsed = parseResult.artigos || [];
    var avisos = parseResult.avisos || [];
    var stats = parseResult.estatisticas || {};
    var lei = (leis || []).find(function (l) { return l.id === leiId; });
    var h = STJ.h;

    // ── Painel de avisos (erros de validação heurística)
    var avisosHTML = '';
    if (avisos.length) {
      var erros = avisos.filter(function(a){return a.severidade==='erro';});
      var warns = avisos.filter(function(a){return a.severidade==='aviso';});
      var infos  = avisos.filter(function(a){return a.severidade==='info';});
      avisosHTML = '<div class="import-avisos">';
      erros.forEach(function(a){ avisosHTML += '<div class="aviso aviso-erro">❌ ' + h(a.mensagem) + '</div>'; });
      warns.forEach(function(a){ avisosHTML += '<div class="aviso aviso-warn">⚠ ' + h(a.mensagem) + '</div>'; });
      infos.forEach(function(a){  avisosHTML += '<div class="aviso aviso-info">ℹ ' + h(a.mensagem) + '</div>'; });
      avisosHTML += '</div>';
    }

    // ── Pré-visualização hierárquica dos artigos
    var grHTML = '';
    var ultiGr = null;
    parsed.forEach(function (a) {
      var grKey = (a.grupoTipo || '') + '|' + (a.grupoNum || '') + '|' + (a.capNum || '');
      if (grKey !== ultiGr) {
        if (ultiGr !== null) grHTML += '</div>';
        var lbl = a.grupoTipo
          ? ((a.grupoTipo || '') + ' ' + (a.grupoNum || '') + (a.grupoTit ? ' — ' + a.grupoTit : ''))
          : (a.capNum ? ('Capítulo ' + a.capNum + (a.capTit ? ' — ' + a.capTit : '')) : 'Artigos gerais');
        grHTML += '<div class="pp-group"><div class="pp-group-hd"><span style="font-size:12.5px;font-weight:700;color:var(--charcoal)">📂 ' + h(lbl) + '</span></div>';
        ultiGr = grKey;
      }
      var nTabs = a.tabelas ? a.tabelas.length : 0;
      var nNums = a.numeros ? a.numeros.length : 0;
      grHTML += '<div class="pp-art">' +
        '<span class="pp-art-n">' + h(a.numero) + '</span>' +
        '<div>' +
          '<div style="font-size:12px;color:var(--dark)">' + h(a.titulo || '(sem epígrafe)') + '</div>' +
          '<div style="font-size:11px;color:var(--muted)">' + h((a.texto || '').substring(0, 120)) + (a.texto && a.texto.length > 120 ? '…' : '') + '</div>' +
          (nNums ? '<span style="font-size:10px;background:var(--blue-bg,#eef2ff);color:var(--blue,#3b4cca);border-radius:3px;padding:1px 5px;margin-right:4px">' + nNums + ' n.º</span>' : '') +
          (nTabs ? '<span style="font-size:10px;background:#f0fdf4;color:#16a34a;border-radius:3px;padding:1px 5px">' + nTabs + ' tabela(s)</span>' : '') +
        '</div></div>';
    });
    if (ultiGr !== null) grHTML += '</div>';

    // ── Painel de anexos
    var anexosHTML = '';
    if ((parseResult.anexos || []).length) {
      anexosHTML = '<div style="margin:0 0 .75rem;padding:.6rem .8rem;background:var(--blue-bg,#eef2ff);border-radius:6px;font-size:12.5px">' +
        '📎 <strong>' + parseResult.anexos.length + ' Anexo(s)/Apêndice(s)</strong> detetado(s): ' +
        parseResult.anexos.map(function(an){ return h((an.tipo||'ANEXO') + (an.numero ? ' '+an.numero : '') + (an.titulo ? ' — '+an.titulo : '')); }).join(', ') + '</div>';
    }

    return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Importar Documento</span></div>' + wiz('done', 'active', '') +
      '<div class="parse-stats">' +
        '<span class="pstat">Lei: <strong>' + h(lei ? lei.titulo : '—') + '</strong></span>' +
        '<span class="pstat">Artigos: <strong>' + (stats.totalArtigos || 0) + '</strong></span>' +
        '<span class="pstat">Capítulos: <strong>' + (stats.totalCapitulos || 0) + '</strong></span>' +
        (stats.totalSeccoes ? '<span class="pstat">Secções: <strong>' + stats.totalSeccoes + '</strong></span>' : '') +
        (stats.totalAnexos ? '<span class="pstat">Anexos: <strong>' + stats.totalAnexos + '</strong></span>' : '') +
        (stats.totalTabelas ? '<span class="pstat">Tabelas: <strong>' + stats.totalTabelas + '</strong></span>' : '') +
        '<span class="pstat" style="color:var(--muted)">⏱ ' + (stats.tempoMs || 0) + 'ms</span>' +
      '</div>' +
      avisosHTML +
      (parsed.length
        ? anexosHTML + '<div class="parse-preview">' + grHTML + '</div>'
        : '<div style="padding:1.5rem;background:var(--orange-bg);color:var(--orange);font-size:13px">⚠ Nenhum artigo detetado. Verifique se o texto contém epígrafes como «Artigo 1.º».</div>') +
      '<div style="padding:1rem;display:flex;gap:.5rem">' +
        '<button class="btn btn-outline" onclick="STJ.estado.importStep=1;STJ.render()">‹ Voltar</button>' +
        (parsed.length ? '<button class="btn btn-red btn-lg" onclick="STJ.estado.importStep=3;STJ.render()">Confirmar Estrutura →</button>' : '') +
      '</div></div>';
  }

  if (step === 3) {
    var lei3 = (leis || []).find(function (l) { return l.id === leiId; });
    var totalArt3 = ((STJ.estado.importParseResult || {}).artigos || []).length;
    return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Importar Documento</span></div>' + wiz('done', 'done', 'active') +
      '<div class="adm-body">' +
      '<div style="background:#FAFAFA;border:1px solid var(--border);border-left:4px solid var(--red);padding:1.1rem;margin-bottom:1rem;font-size:13.5px;line-height:1.8">' +
      'Lei: <strong>' + h(lei3 ? lei3.titulo : '—') + '</strong><br>' +
      'Artigos a importar: <strong>' + totalArt3 + '</strong><br>' +
      '<span style="color:var(--orange)">⚠ Qualquer artigo existente nesta lei será <strong>substituído</strong>.</span></div>' +
      '<div style="display:flex;gap:.5rem"><button class="btn btn-outline btn-lg" onclick="STJ.estado.importStep=2;STJ.render()">‹ Rever</button>' +
      '<button class="btn btn-red btn-lg" onclick="STJ.admin._confirmarImport()">✅ Importar ' + totalArt3 + ' Artigos</button></div>' +
      '</div></div>';
  }
  return '';
};

STJ.admin._importarPasso2 = async function () {
  var leiId = STJ.gv('imp-lei') || STJ.estado.importLeiId;
  if (!leiId) { STJ.toast('Selecione uma lei de destino.'); return; }
  var txt = STJ.g('imp-text');
  if (!txt || !txt.trim()) { STJ.toast('Introduza o texto ou carregue um ficheiro.'); return; }
  STJ.estado.importLeiId = leiId;
  STJ.toast('A analisar documento…');
  var resultado = await STJ.api('analisarDocumento', { texto: txt });
  // O parser devolve agora { artigos, avisos, estatisticas, anexos, arvore }.
  // Guardamos o resultado completo para a pré-visualização e os artigos
  // separados para a chamada de importação.
  STJ.estado.importParseResult = resultado;
  STJ.estado.importParsed = resultado.artigos || [];
  STJ.estado.importStep = 2;
  STJ.render();
};

STJ.admin._confirmarImport = async function () {
  var leiId = STJ.estado.importLeiId;
  var artigos = STJ.estado.importParsed;
  if (!leiId || !artigos || !artigos.length) { STJ.toast('Dados em falta ou nenhum artigo para importar.'); return; }
  await STJ.apiAuth('importarArtigos', { leiId: leiId, listaArtigos: artigos });
  STJ.toast('✅ ' + artigos.length + ' artigos importados com sucesso.');
  STJ.estado.importStep = 1;
  STJ.estado.importParsed = null;
  STJ.estado.importParseResult = null;
  STJ.admin.nav('artigos');
};

STJ.admin._handleDrop = function (e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-over');
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) STJ.admin._processarFicheiro(f);
};
STJ.admin._handleFileSelect = function (e) {
  var f = e.target && e.target.files && e.target.files[0];
  if (f) STJ.admin._processarFicheiro(f);
};
STJ.admin._processarFicheiro = function (file) {
  var n = file.name.toLowerCase();
  if (n.endsWith('.docx')) {
    if (typeof mammoth === 'undefined') {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      s.onload = function () { STJ.admin._lerDocx(file); };
      document.head.appendChild(s);
    } else { STJ.admin._lerDocx(file); }
  } else if (n.endsWith('.pdf')) {
    if (typeof pdfjsLib === 'undefined') {
      var sp = document.createElement('script');
      sp.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      sp.onload = function () {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        STJ.admin._lerPdf(file);
      };
      document.head.appendChild(sp);
    } else { STJ.admin._lerPdf(file); }
  } else {
    var r = new FileReader();
    r.onload = function (ev) { var el = document.getElementById('imp-text'); if (el) el.value = ev.target.result; STJ.toast('Ficheiro lido.'); };
    r.readAsText(file, 'UTF-8');
  }
};
STJ.admin._lerDocx = function (file) {
  var r = new FileReader();
  r.onload = function (ev) {
    mammoth.extractRawText({ arrayBuffer: ev.target.result }).then(function (res) {
      var el = document.getElementById('imp-text');
      if (el) el.value = res.value;
      STJ.toast('Word lido. Reveja o texto antes de continuar.');
    }).catch(function (e) { STJ.toast('Erro ao ler .docx: ' + e.message); });
  };
  r.readAsArrayBuffer(file);
};
STJ.admin._lerPdf = function (file) {
  STJ.toast('A ler PDF…');
  var r = new FileReader();
  r.onload = function (ev) {
    var loadingTask = pdfjsLib.getDocument({ data: ev.target.result });
    loadingTask.promise.then(function (pdf) {
      var pagePromises = [];
      for (var i = 1; i <= pdf.numPages; i++) {
        pagePromises.push(pdf.getPage(i).then(function (page) {
          return page.getTextContent({ normalizeWhitespace: true }).then(function (tc) {
            // ── Agrupa itens por linha lógica (tolerância de 2px no eixo Y)
            var linhasMap = {};
            tc.items.forEach(function (item) {
              var y = Math.round(item.transform[5] / 2) * 2; // arredonda a 2px
              if (!linhasMap[y]) linhasMap[y] = [];
              linhasMap[y].push({ x: item.transform[4], str: item.str, w: item.width || 0 });
            });

            // ── Ordena eixo Y decrescente (topo → fundo) e itens por X crescente
            var ys = Object.keys(linhasMap).map(Number).sort(function (a, b) { return b - a; });
            var linhas = ys.map(function (y) {
              var itens = linhasMap[y].sort(function (a, b) { return a.x - b.x; });
              // Detecta lacuna horizontal grande (>1.5× espaço médio) = coluna separada
              var textos = [];
              var xAnt = -Infinity;
              itens.forEach(function (it) {
                if (xAnt > -Infinity && it.x - xAnt > 40) textos.push('\t');
                textos.push(it.str);
                xAnt = it.x + it.w;
              });
              return textos.join('').replace(/\s{2,}/g, ' ').trim();
            }).filter(function (l) { return l.length > 0; });

            // ── Junta palavras partidas por hífen de fim de linha
            var resultado = [];
            for (var j = 0; j < linhas.length; j++) {
              var atual = linhas[j];
              var prox = linhas[j + 1];
              if (prox && /[a-zA-ZÀ-ÿ]-$/.test(atual) && /^[a-záàãâéêíóôõúü]/i.test(prox)) {
                resultado.push(atual.slice(0, -1) + prox.split(/\s/)[0]);
                linhas[j + 1] = prox.replace(/^\S+\s*/, '');
                if (!linhas[j + 1]) j++;
              } else {
                resultado.push(atual);
              }
            }
            return resultado.join('\n');
          });
        }));
      }
      return Promise.all(pagePromises);
    }).then(function (paginas) {
      var el = document.getElementById('imp-text');
      if (el) el.value = paginas.join('\n\n');
      STJ.toast('PDF lido (' + paginas.length + ' página(s)). Reveja o texto antes de continuar.');
    }).catch(function (e) { STJ.toast('Erro ao ler PDF: ' + (e.message || e)); });
  };
  r.readAsArrayBuffer(file);
};

/* ── ARTIGOS ─────────────────────────────────────────────────────── */
STJ.admin.artigosList = async function () {
  var leis = await STJ.api('listarLeis');
  var leiId = STJ.estado._leiId || (leis[0] ? leis[0].id : null);
  var lei = leis.find(function (l) { return l.id === leiId; });
  var arts = leiId ? ((await STJ.api('obterLei', { id: leiId }) || {}).artigos || []).sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); }) : [];
  var h = STJ.h;
  var optLeis = leis.map(function (l) { return '<option value="' + h(l.id) + '"' + (l.id === leiId ? ' selected' : '') + '>' + h(l.numero) + ' — ' + h(l.titulo) + '</option>'; }).join('');
  var rows = arts.map(function (a) {
    return '<tr><td><strong>' + h(a.numero) + '</strong></td><td>' + h(a.titulo || '—') + '</td>' +
      '<td style="font-size:11px;color:var(--muted)">' + [a.capNum && ('Cap. ' + a.capNum), a.secNum && ('Sec. ' + a.secNum)].filter(Boolean).join(' › ') + '</td>' +
      '<td>' + (a.interpretacaoTexto ? '<span class="badge b-red" style="font-size:9px">Sim</span>' : '<span style="color:var(--muted);font-size:11px">—</span>') + '</td>' +
      '<td><div style="display:flex;gap:4px"><button class="btn btn-outline btn-sm" onclick="STJ.estado._editId=\'' + h(a.id) + '\';STJ.admin.nav(\'artigo-edit\')">Editar</button><button class="btn btn-danger btn-sm" onclick="STJ.admin._delArtigo(\'' + h(a.id) + '\')">Eliminar</button></div></td></tr>';
  }).join('') || '<tr><td colspan="5"><div class="empty-state"><p>Sem artigos. Use <strong>Importar em Lote</strong>.</p></div></td></tr>';

  return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Artigos</span><div style="display:flex;gap:.5rem">' +
    '<button class="btn btn-purple btn-sm" onclick="STJ.estado._leiId=\'' + h(leiId || '') + '\';STJ.estado.importStep=1;STJ.estado.importParsed=null;STJ.admin.nav(\'import\')">📥 Importar em Lote</button>' +
    '<button class="btn btn-red btn-sm" onclick="STJ.estado._leiId=\'' + h(leiId || '') + '\';STJ.admin.nav(\'artigo-new\')"' + (!leiId ? ' disabled' : '') + '>+ Artigo Individual</button>' +
    (arts.length ? '<button class="btn btn-danger btn-sm" onclick="STJ.admin._apagarTodosArtigos(\'' + h(leiId || '') + '\')">🗑 Apagar Todos</button>' : '') +
    '</div></div><div class="adm-body">' +
    '<div class="f-row" style="display:flex;gap:.5rem;align-items:flex-end"><div style="flex:1"><label for="sel-lei">Lei</label><select id="sel-lei" onchange="STJ.estado._leiId=this.value;STJ.render()">' + optLeis + '</select></div></div>' +
    (lei ? '<p style="font-size:12.5px;color:var(--muted);margin-bottom:.75rem">Lei: <strong style="color:var(--charcoal)">' + h(lei.titulo) + '</strong> — ' + arts.length + ' artigo(s)</p>' : '') +
    '<div style="overflow-x:auto"><table class="manage-table"><thead><tr><th>Nº</th><th>Título</th><th>Estrutura</th><th>Interpretação</th><th>Ações</th></tr></thead><tbody>' + rows + '</tbody></table></div></div></div>';
};

STJ.admin._apagarTodosArtigos = async function (leiId) {
  if (!leiId) { STJ.toast('Selecione uma lei primeiro.'); return; }
  var arts = STJ.g('artigos-tbody') ? STJ.g('artigos-tbody').querySelectorAll('tr').length : '?';
  if (!await STJ.modalConfirm({ titulo: 'Eliminar Artigos', mensagem: 'Tem a certeza que quer apagar TODOS os artigos desta lei? Esta ação é irreversível (mas pode restaurar via Histórico de Versões).', textoConfirmar: 'Eliminar Todos' })) return;
  var res = await STJ.apiAuth('eliminarTodosArtigos', { leiId: leiId });
  STJ.toast('🗑 ' + (res && res.eliminados != null ? res.eliminados : '?') + ' artigos eliminados.');
  STJ.render();
};

STJ.admin.artigoForm = async function (id) {
  // PERF-03: uma só chamada a listarLeis, reutilizada para o <select> e
  // para encontrar a lei do artigo em edição (antes havia duas chamadas
  // idênticas e sequenciais).
  var leis = await STJ.api('listarLeis');
  var artigo = null;
  var leiIdAtual = STJ.estado._leiId || (leis[0] ? leis[0].id : null);
  if (id) {
    var t2 = await STJ.api('obterLei', { id: leiIdAtual });
    if (t2) artigo = (t2.artigos || []).find(function (a) { return a.id === id; });
  }
  var leiId = (artigo && artigo.leiId) || leiIdAtual;
  var h = STJ.h;
  var optLeis = leis.map(function (l) { return '<option value="' + h(l.id) + '"' + (l.id === leiId ? ' selected' : '') + '>' + h(l.numero) + ' — ' + h(l.titulo) + '</option>'; }).join('');
  return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">' + (artigo ? 'Editar Artigo' : 'Novo Artigo') + '</span><div style="display:flex;gap:.5rem">' +
    (artigo ? '<button class="btn btn-outline btn-sm" onclick="STJ.admin.historicoArtigo(\'' + h(artigo.id) + '\')">📜 Histórico de Versões</button>' : '') +
    '<button class="btn btn-outline btn-sm" onclick="STJ.admin.nav(\'artigos\')">‹ Voltar</button></div></div>' +
    '<div class="adm-body">' +
    '<div class="f-row"><label for="fa-lei">Lei *</label><select id="fa-lei">' + optLeis + '</select></div>' +
    '<div class="g2"><div class="f-row"><label for="fa-num">Número *</label><input type="text" id="fa-num" value="' + h(artigo ? artigo.numero : '') + '" placeholder="Artigo 15.º"></div>' +
    '<div class="f-row"><label for="fa-tit">Epígrafe</label><input type="text" id="fa-tit" value="' + h(artigo ? artigo.titulo || '' : '') + '"></div></div>' +
    '<div class="g3"><div class="f-row"><label for="fa-cn">Capítulo nº</label><input type="text" id="fa-cn" value="' + h(artigo ? artigo.capNum || '' : '') + '"></div>' +
    '<div class="f-row"><label for="fa-ct">Nome do Capítulo</label><input type="text" id="fa-ct" value="' + h(artigo ? artigo.capTit || '' : '') + '"></div>' +
    '<div class="f-row"><label for="fa-sn">Secção nº</label><input type="text" id="fa-sn" value="' + h(artigo ? artigo.secNum || '' : '') + '"></div></div>' +
    '<div class="f-row"><label for="fa-txt">Texto do Artigo *</label><textarea id="fa-txt" rows="7">' + h(artigo ? artigo.texto || '' : '') + '</textarea></div>' +
    '<div class="divider"></div>' +
    '<div style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.75rem">⚖ Interpretação Jurisprudencial STJ <span style="font-weight:400;color:var(--muted)">(opcional)</span></div>' +
    '<div class="f-row"><label for="fa-interp">Texto Interpretativo</label><textarea id="fa-interp" rows="4">' + h(artigo ? artigo.interpretacaoTexto || '' : '') + '</textarea></div>' +
    '<div class="f-row"><label for="fa-princ">Princípios Aplicáveis</label><input type="text" id="fa-princ" value="' + h(artigo ? artigo.principios || '' : '') + '"></div>' +
    '<div class="f-row"><label for="fa-ratio">Ratio Decidendi</label><textarea id="fa-ratio" rows="3">' + h(artigo ? artigo.ratio || '' : '') + '</textarea></div>' +
    '<div class="f-row"><label for="fa-enquad">Enquadramento Sistemático</label><textarea id="fa-enquad" rows="2">' + h(artigo ? artigo.enquadramento || '' : '') + '</textarea></div>' +
    '<div style="display:flex;gap:.5rem"><button class="btn btn-red btn-lg" onclick="STJ.admin._saveArtigo(' + (id ? '\'' + h(id) + '\'' : 'null') + ')">' + (artigo ? 'Guardar Alterações' : 'Adicionar Artigo') + '</button><button class="btn btn-outline" onclick="STJ.admin.nav(\'artigos\')">Cancelar</button></div>' +
    '</div></div>';
};

STJ.admin._saveArtigo = async function (id) {
  var num = STJ.g('fa-num'), txt = STJ.g('fa-txt');
  if (!num || !txt) { STJ.toast('Preencha o número e o texto.'); return; }
  var dados = { leiId: STJ.gv('fa-lei'), numero: num, titulo: STJ.g('fa-tit'), texto: txt, capNum: STJ.g('fa-cn'), capTit: STJ.g('fa-ct'), secNum: STJ.g('fa-sn'), interpretacaoTexto: STJ.g('fa-interp'), principios: STJ.g('fa-princ'), ratio: STJ.g('fa-ratio'), enquadramento: STJ.g('fa-enquad') };
  if (id) { await STJ.apiAuth('atualizarArtigo', { id: id, dados: dados }); STJ.toast('Artigo atualizado.'); }
  else { await STJ.apiAuth('criarArtigo', { dados: dados }); STJ.toast('Artigo adicionado.'); }
  STJ.admin.nav('artigos');
};

STJ.admin._delArtigo = async function (id) {
  if (!await STJ.modalConfirm({ titulo: 'Eliminar Artigo', mensagem: 'Eliminar este artigo?', textoConfirmar: 'Eliminar' })) return;
  await STJ.apiAuth('eliminarArtigo', { id: id });
  STJ.toast('Artigo eliminado.');
  STJ.render();
};

/** Campos do snapshot de "Artigo" relevantes para a comparação visual. */
STJ.admin.historicoArtigo = function (id) {
  STJ.abrirHistoricoVersoes({
    tipo: 'Artigo',
    id: id,
    campos: [
      { chave: 'numero', label: 'Número' },
      { chave: 'titulo', label: 'Epígrafe' },
      { chave: 'texto', label: 'Texto do Artigo' },
      { chave: 'interpretacaoTexto', label: 'Texto Interpretativo' },
      { chave: 'principios', label: 'Princípios Aplicáveis' },
      { chave: 'ratio', label: 'Ratio Decidendi' },
      { chave: 'enquadramento', label: 'Enquadramento Sistemático' }
    ]
  });
};

/* ── INTERPRETAÇÕES ─────────────────────────────────────────────── */
STJ.admin.interpPanel = async function () {
  var leis = await STJ.api('listarLeis');
  // PERF-02: pedidos em paralelo em vez de N+1 sequenciais.
  var respostas = await Promise.all(leis.map(function (l) { return STJ.api('obterLei', { id: l.id }); }));
  var todos = [];
  respostas.forEach(function (resp, i) {
    if (resp && resp.artigos) {
      resp.artigos.filter(function (a) { return a.interpretacaoTexto; }).forEach(function (a) {
        a._leiNumero = leis[i].numero;
        a._leiId = leis[i].id; // BUG-03/08: necessário para o link "Editar" abaixo encontrar o artigo
        todos.push(a);
      });
    }
  });
  var h = STJ.h;
  var rows = todos.map(function (a) {
    return '<tr><td>' + h(a._leiNumero || '—') + '</td><td><strong>' + h(a.numero) + '</strong>' + (a.titulo ? ' — ' + h(a.titulo) : '') + '</td>' +
      '<td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-style:italic;color:var(--muted)">' + h(a.interpretacaoTexto) + '</td>' +
      '<td><button class="btn btn-outline btn-sm" onclick="STJ.estado._editId=\'' + h(a.id) + '\';STJ.estado._leiId=\'' + h(a._leiId) + '\';STJ.admin.nav(\'artigo-edit\')">Editar</button></td></tr>';
  }).join('') || '<tr><td colspan="4"><div class="empty-state"><p>Nenhuma interpretação registada.</p></div></td></tr>';
  return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Interpretações STJ</span></div>' +
    '<div style="overflow-x:auto"><table class="manage-table"><thead><tr><th>Lei</th><th>Artigo</th><th>Excerto</th><th>Ação</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
};

/* ── ACÓRDÃOS ─────────────────────────────────────────────────────── */
STJ.admin.acsList = async function () {
  var acs = await STJ.api('listarAcordaos');
  var h = STJ.h, fd = STJ.fmtDate, sd = STJ.stBadge;
  var rows = (acs || []).map(function (a) {
    return '<tr><td><strong>' + h(a.numero) + '</strong></td><td>' + h(a.titulo) + '</td><td>' + fd(a.data) + '</td><td>' + h(a.relator || '—') + '</td><td>' + sd(a.estado) + '</td>' +
      '<td><div style="display:flex;gap:4px"><button class="btn btn-outline btn-sm" onclick="STJ.estado._editId=\'' + h(a.id) + '\';STJ.admin.nav(\'ac-edit\')">Editar</button><button class="btn btn-danger btn-sm" onclick="STJ.admin._delAc(\'' + h(a.id) + '\',\'' + h(a.titulo) + '\')">Eliminar</button></div></td></tr>';
  }).join('') || '<tr><td colspan="6"><div class="empty-state"><p>Nenhum acórdão publicado.</p></div></td></tr>';
  return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Acórdãos</span><button class="btn btn-red" onclick="STJ.admin.nav(\'ac-new\')">+ Novo Acórdão</button></div>' +
    '<div style="overflow-x:auto"><table class="manage-table"><thead><tr><th>Processo</th><th>Título</th><th>Data</th><th>Relator</th><th>Estado</th><th>Ações</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
};

STJ.admin.acForm = async function (id) {
  var ac = null;
  if (id) { ac = await STJ.api('obterAcordao', { id: id }); }
  var h = STJ.h;
  var tipos = ['Penal', 'Cível', 'Administrativo', 'Constitucional', 'Laboral', 'Fiscal', 'Outros'];
  var optTipos = tipos.map(function (o) { return '<option' + (ac && ac.tipo === o ? ' selected' : '') + '>' + o + '</option>'; }).join('');
  return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">' + (ac ? 'Editar Acórdão' : 'Novo Acórdão') + '</span><div style="display:flex;gap:.5rem">' +
    (ac ? '<button class="btn btn-outline btn-sm" onclick="STJ.admin.historicoAcordao(\'' + h(ac.id) + '\')">📜 Histórico de Versões</button>' : '') +
    '<button class="btn btn-outline btn-sm" onclick="STJ.admin.nav(\'acs-list\')">‹ Voltar</button></div></div>' +
    '<div class="adm-body">' +
    '<div class="g2"><div class="f-row"><label for="ac-num">Número do Processo *</label><input type="text" id="ac-num" value="' + h(ac ? ac.numero : '') + '" placeholder="Proc. 154/2026-STJ"></div>' +
    '<div class="f-row"><label for="ac-data">Data *</label><input type="date" id="ac-data" value="' + h(ac ? ac.data : '') + '"></div></div>' +
    '<div class="f-row"><label for="ac-titulo">Título *</label><input type="text" id="ac-titulo" value="' + h(ac ? ac.titulo : '') + '"></div>' +
    '<div class="g3"><div class="f-row"><label for="ac-tipo">Tipo</label><select id="ac-tipo">' + optTipos + '</select></div>' +
    '<div class="f-row"><label for="ac-estado">Estado</label><select id="ac-estado"><option value="transitado"' + (ac && ac.estado === 'transitado' ? ' selected' : '') + '>Transitado em julgado</option><option value="nao-transitado"' + (ac && ac.estado === 'nao-transitado' ? ' selected' : '') + '>Não transitado</option></select></div>' +
    '<div class="f-row"><label for="ac-vot">Votação</label><input type="text" id="ac-vot" value="' + h(ac ? ac.votacao || '' : '') + '" placeholder="Unanimidade"></div></div>' +
    '<div class="g2"><div class="f-row"><label for="ac-rel">Relator</label><input type="text" id="ac-rel" value="' + h(ac ? ac.relator || '' : '') + '"></div>' +
    '<div class="f-row"><label for="ac-adj">Juízes Adjuntos</label><input type="text" id="ac-adj" value="' + h(ac ? ac.juizesAdjuntos || '' : '') + '"></div></div>' +
    '<div class="authorship-section"><div class="as-title">Autoria e Responsabilidade</div><div class="g2">' +
    '<div class="f-row"><label for="ac-elabor">Elaborado por</label><input type="text" id="ac-elabor" value="' + h(ac ? ac.elaboradoPor || '' : '') + '"></div>' +
    '<div class="f-row"><label for="ac-revist">Revisto por</label><input type="text" id="ac-revist" value="' + h(ac ? ac.revistoPor || '' : '') + '"></div>' +
    '</div></div><div class="divider"></div>' +
    '<div class="f-row"><label for="ac-sum">Sumário *</label><textarea id="ac-sum" rows="5">' + h(ac ? ac.sumario || '' : '') + '</textarea></div>' +
    '<div class="f-row"><label for="ac-fac">Factos Provados</label><textarea id="ac-fac" rows="4">' + h(ac ? ac.factos || '' : '') + '</textarea></div>' +
    '<div class="f-row"><label for="ac-que">Questões Jurídicas</label><textarea id="ac-que" rows="3">' + h(ac ? ac.questoes || '' : '') + '</textarea></div>' +
    '<div class="f-row"><label for="ac-fun">Fundamentação</label><textarea id="ac-fun" rows="5">' + h(ac ? ac.fundamentacao || '' : '') + '</textarea></div>' +
    '<div class="f-row"><label for="ac-dec">Decisão *</label><textarea id="ac-dec" rows="3">' + h(ac ? ac.decisao || '' : '') + '</textarea></div>' +
    '<div class="f-row"><label for="ac-art">Artigos Aplicados (separados por vírgula)</label><input type="text" id="ac-art" value="' + h(ac ? ac.artigosAplicados || '' : '') + '"></div>' +
    '<div style="display:flex;gap:.5rem"><button class="btn btn-red btn-lg" onclick="STJ.admin._saveAc(' + (id ? '\'' + h(id) + '\'' : 'null') + ')">' + (ac ? 'Guardar Alterações' : 'Publicar Acórdão') + '</button><button class="btn btn-outline" onclick="STJ.admin.nav(\'acs-list\')">Cancelar</button></div>' +
    '</div></div>';
};

STJ.admin._saveAc = async function (id) {
  var num = STJ.g('ac-num'), titulo = STJ.g('ac-titulo'), dec = STJ.g('ac-dec');
  if (!num || !titulo || !dec) { STJ.toast('Preencha número, título e decisão.'); return; }
  var dados = { numero: num, titulo: titulo, data: STJ.g('ac-data'), tipo: STJ.gv('ac-tipo'), estado: STJ.gv('ac-estado'), votacao: STJ.g('ac-vot'), relator: STJ.g('ac-rel'), juizesAdjuntos: STJ.g('ac-adj'), elaboradoPor: STJ.g('ac-elabor'), revistoPor: STJ.g('ac-revist'), sumario: STJ.g('ac-sum'), factos: STJ.g('ac-fac'), questoes: STJ.g('ac-que'), fundamentacao: STJ.g('ac-fun'), decisao: dec, artigosAplicados: STJ.g('ac-art') };
  if (id) { await STJ.apiAuth('atualizarAcordao', { id: id, dados: dados }); STJ.toast('Acórdão atualizado.'); }
  else { await STJ.apiAuth('criarAcordao', { dados: dados }); STJ.toast('Acórdão publicado.'); }
  STJ.admin.nav('acs-list');
};

STJ.admin._delAc = async function (id, titulo) {
  if (!await STJ.modalConfirm({ titulo: 'Eliminar Acórdão', mensagem: 'Eliminar o acórdão "' + titulo + '"?', textoConfirmar: 'Eliminar' })) return;
  await STJ.apiAuth('eliminarAcordao', { id: id });
  STJ.toast('Acórdão eliminado.');
  STJ.admin.nav('acs-list');
};

/** Campos do snapshot de "Acordao" relevantes para a comparação visual. */
STJ.admin.historicoAcordao = function (id) {
  STJ.abrirHistoricoVersoes({
    tipo: 'Acordao',
    id: id,
    campos: [
      { chave: 'titulo', label: 'Título' },
      { chave: 'estado', label: 'Estado' },
      { chave: 'relator', label: 'Relator' },
      { chave: 'sumario', label: 'Sumário' },
      { chave: 'factos', label: 'Factos Provados' },
      { chave: 'questoes', label: 'Questões Jurídicas' },
      { chave: 'fundamentacao', label: 'Fundamentação' },
      { chave: 'decisao', label: 'Decisão' },
      { chave: 'artigosAplicados', label: 'Artigos Aplicados' }
    ]
  });
};

/* ── UTILIZADORES (só administradores) — agora por USERNAME ──────── */
STJ.admin.utilizadores = async function () {
  var users = await STJ.apiAuth('listarUtilizadores');
  var h = STJ.h, fd = STJ.fmtDate;
  var rows = (users || []).map(function (u) {
    return '<tr><td><strong>' + h(u.username) + '</strong></td><td>' + h(u.nome) + '</td><td><span class="badge b-blue">' + h(u.role) + '</span></td>' +
      '<td>' + (u.ativo === true ? '<span class="badge b-green">Ativo</span>' : '<span class="badge b-red">Inativo</span>') + '</td>' +
      '<td>' + h(u.ultimoLogin ? fd(u.ultimoLogin) : '—') + '</td>' +
      '<td><div style="display:flex;gap:4px">' +
      '<select id="role-' + h(u.username) + '" style="font-size:11px;padding:2px 4px"><option value="administrador"' + (u.role === 'administrador' ? ' selected' : '') + '>Admin</option><option value="redator"' + (u.role === 'redator' ? ' selected' : '') + '>Redator</option><option value="revisor"' + (u.role === 'revisor' ? ' selected' : '') + '>Revisor</option><option value="leitor"' + (u.role === 'leitor' ? ' selected' : '') + '>Leitor</option></select>' +
      '<button class="btn btn-outline btn-sm" onclick="STJ.admin._atualizarUser(\'' + h(u.username) + '\')">Guardar</button>' +
      '</div></td></tr>';
  }).join('') || '<tr><td colspan="6"><div class="empty-state"><p>Sem utilizadores.</p></div></td></tr>';
  return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Utilizadores</span><button class="btn btn-red" onclick="STJ.admin._novoUserPrompt()">+ Novo Utilizador</button></div>' +
    '<div style="overflow-x:auto"><table class="manage-table"><thead><tr><th>Utilizador</th><th>Nome</th><th>Papel</th><th>Estado</th><th>Último acesso</th><th>Ações</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
};

STJ.admin._novoUserPrompt = async function () {
  var username = await STJ.modalInput({
    titulo: 'Novo Utilizador',
    label: 'Nome de utilizador (login)',
    placeholder: 'ex.: jsilva',
    textoConfirmar: 'Seguinte'
  });
  if (!username) return;
  var nome = await STJ.modalInput({
    titulo: 'Novo Utilizador',
    label: 'Nome completo',
    placeholder: 'ex.: João Silva',
    textoConfirmar: 'Seguinte'
  });
  if (!nome) return;
  var role = await STJ.modalInput({
    titulo: 'Novo Utilizador',
    label: 'Papel (administrador / redator / revisor / leitor)',
    placeholder: 'redator',
    textoConfirmar: 'Criar Utilizador'
  });
  if (!role) return;
  var res = await STJ.apiAuth('criarUtilizador', { dados: { username: username, nome: nome, role: role } });
  if (res && res.ok === false) { STJ.toast(res.erro); return; }
  if (res && res.passwordTemporaria) {
    await STJ.modalInfo({
      titulo: 'Utilizador criado',
      mensagem: 'Utilizador "' + username + '" criado.\n\nPassword temporária: ' + res.passwordTemporaria + '\n\nComunique esta password ao utilizador por um canal seguro. Será pedida a alteração no primeiro acesso.',
      textoBotao: 'Entendido'
    });
  }
  STJ.toast('Utilizador criado.');
  STJ.render();
};

STJ.admin._atualizarUser = async function (username) {
  var elSel = document.getElementById('role-' + username);
  var novoRole = elSel ? elSel.value : null;
  await STJ.apiAuth('alterarRoleUtilizador', { username: username, role: novoRole });
  STJ.toast('Utilizador atualizado.');
};

/* ── AUDITORIA ────────────────────────────────────────────────────── */
STJ.admin.auditoria = async function () {
  var registos = await STJ.apiAuth('obterAuditoria', { filtros: { limite: 150 } });
  var h = STJ.h;
  var rows = (registos || []).map(function (r) {
    return '<tr><td style="white-space:nowrap">' + h(r.timestamp ? new Date(r.timestamp).toLocaleString('pt-PT') : '—') + '</td>' +
      '<td>' + h(r.utilizador) + '</td>' +
      '<td><span class="badge b-gray">' + h(r.accao) + '</span></td>' +
      '<td>' + h(r.entidade) + '</td>' +
      '<td style="font-size:12px;color:var(--mid)">' + h(r.detalhes) + '</td></tr>';
  }).join('') || '<tr><td colspan="5"><div class="empty-state"><p>Sem registos de auditoria.</p></div></td></tr>';
  return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Registo de Auditoria</span><span style="font-size:12px;color:var(--muted)">Últimas 150 entradas</span></div>' +
    '<div style="overflow-x:auto"><table class="manage-table"><thead><tr><th>Data/Hora</th><th>Utilizador</th><th>Ação</th><th>Entidade</th><th>Detalhe</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
};

/* ── FAVORITOS ─────────────────────────────────────────────────────── */
STJ.admin.favoritos = async function () {
  var favs = await STJ.apiAuth('listarFavoritos');
  var h = STJ.h, fd = STJ.fmtDate;
  var rows = (favs || []).map(function (f) {
    var fn = f.tipo === 'Lei' ? 'STJ.navegar(\'lei-detalhe\',{currentLawId:\'' + h(f.entidadeId) + '\'})' : 'STJ.navegar(\'acordao-detalhe\',{currentAcId:\'' + h(f.entidadeId) + '\'})';
    return '<tr><td><span class="badge b-blue">' + h(f.tipo) + '</span></td>' +
      '<td>' + fd(f.criado) + '</td>' +
      '<td><div style="display:flex;gap:4px"><button class="btn btn-outline btn-sm" onclick="' + fn + '">Ver</button>' +
      '<button class="btn btn-danger btn-sm" onclick="STJ.admin._removerFav(\'' + h(f.tipo) + '\',\'' + h(f.entidadeId) + '\')">Remover</button></div></td></tr>';
  }).join('') || '<tr><td colspan="3"><div class="empty-state"><p>Nenhum favorito guardado.</p></div></td></tr>';
  return '<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Meus Favoritos</span></div>' +
    '<div style="overflow-x:auto"><table class="manage-table"><thead><tr><th>Tipo</th><th>Guardado em</th><th>Ações</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
};

STJ.admin._removerFav = async function (tipo, entidadeId) {
  await STJ.apiAuth('removerFavorito', { tipo: tipo, id: entidadeId });
  STJ.toast('Favorito removido.');
  STJ.render();
};
