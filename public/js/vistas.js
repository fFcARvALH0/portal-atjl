/* ════════════════════════════════════════════════════════════════════
   js/vistas.js  (equivalente a Cliente_Vistas.html)
   Todas as vistas públicas do portal (sem autenticação).
   Comunicam com o servidor via STJ.api() — chamadas adaptadas ao
   novo formato {action, payload} da Netlify Function "api".
   ════════════════════════════════════════════════════════════════════ */

/* ── HOME ─────────────────────────────────────────────────────────── */
STJ.vistas.home = async function () {
  // PERF-01: pedidos em paralelo em vez de sequenciais.
  var resultadosHome = await Promise.all([STJ.api('listarLeis'), STJ.api('listarAcordaos')]);
  var leis = resultadosHome[0], acs = resultadosHome[1];
  var h = STJ.h, sd = STJ.stBadge, fd = STJ.fmtDate;

  var listaLeis = (leis || []).slice(0, 5).map(function (l) {
    return '<div class="list-item" role="button" tabindex="0" onclick="STJ.navegar(\'lei-detalhe\',{currentLawId:\'' + h(l.id) + '\'})" onkeydown="if(event.key===\'Enter\')STJ.navegar(\'lei-detalhe\',{currentLawId:\'' + h(l.id) + '\'})">' +
      '<span class="badge b-red" style="flex-shrink:0;margin-top:2px">' + h(l.area || 'Lei') + '</span>' +
      '<div class="list-item-body"><div class="list-item-title">' + h(l.titulo) + '</div>' +
      '<div class="list-item-meta">' + h(l.numero) + ' · ' + fd(l.dataPublicacao) + ' · ' + sd(l.estado) + '</div></div>' +
      '<span class="list-arrow" aria-hidden="true">›</span></div>';
  }).join('') || '<div class="empty-state"><p>Nenhuma lei publicada ainda.</p></div>';

  var listaAcs = (acs || []).slice(0, 5).map(function (a) {
    return '<div class="list-item" role="button" tabindex="0" onclick="STJ.navegar(\'acordao-detalhe\',{currentAcId:\'' + h(a.id) + '\'})">' +
      '<span class="badge b-gray" style="flex-shrink:0;margin-top:2px">STJ</span>' +
      '<div class="list-item-body"><div class="list-item-title">' + h(a.titulo) + '</div>' +
      '<div class="list-item-meta">' + h(a.numero) + ' · ' + fd(a.data) + ' · ' + sd(a.estado) + '</div></div>' +
      '<span class="list-arrow" aria-hidden="true">›</span></div>';
  }).join('') || '<div class="empty-state"><p>Nenhum acórdão publicado ainda.</p></div>';

  return '<div class="search-form" role="search">' +
    '<label for="home-q" class="sr-only">Pesquisar no portal</label>' +
    '<input type="search" id="home-q" placeholder="Pesquise legislação, acórdãos, artigos, processos…" onkeydown="if(event.key===\'Enter\')STJ.vistas._homeSearch()" aria-label="Campo de pesquisa">' +
    '<button onclick="STJ.vistas._homeSearch()" aria-label="Pesquisar">Pesquisar</button></div>' +

    '<div class="stats-row" aria-label="Estatísticas do portal">' +
    '<div class="stat-box"><div class="stat-n">' + (leis || []).length + '</div><div class="stat-l">Leis publicadas</div></div>' +
    '<div class="stat-box"><div class="stat-n">' + (acs || []).length + '</div><div class="stat-l">Acórdãos</div></div>' +
    '<div class="stat-box"><div class="stat-n">—</div><div class="stat-l">Portal STJ</div></div>' +
    '<div class="stat-box"><div class="stat-n">' + ((leis || []).length + (acs || []).length) + '</div><div class="stat-l">Documentos</div></div></div>' +

    '<div class="two-col">' +
    '<div><div class="section-title">Últimas Leis</div><div class="panel">' + listaLeis + '</div>' +
    '<div style="margin-top:.75rem;text-align:right"><button class="btn btn-outline btn-sm" onclick="STJ.navegar(\'legislacao\')">Ver toda a legislação →</button></div></div>' +
    '<div><div class="section-title">Últimos Acórdãos</div><div class="panel">' + listaAcs + '</div>' +
    '<div style="margin-top:.75rem;text-align:right"><button class="btn btn-outline btn-sm" onclick="STJ.navegar(\'jurisprudencia\')">Ver toda a jurisprudência →</button></div></div>' +
    '</div>';
};
STJ.vistas._homeSearch = function () {
  STJ.estado.searchQuery = STJ.g('home-q');
  STJ.navegar('pesquisa');
};

/* ── LISTA LEGISLAÇÃO ────────────────────────────────────────────── */
STJ.vistas.legislacaoLista = async function () {
  var leis = await STJ.api('listarLeis');
  var h = STJ.h, sd = STJ.stBadge, fd = STJ.fmtDate;

  // Estado de UI (pesquisa/ordenação/filtro)
  var q    = (STJ.estado._legQ   || '').toLowerCase();
  var ord  = STJ.estado._legOrd  || 'data-desc';
  var fArea = STJ.estado._legArea || '';
  var fEst  = STJ.estado._legEst  || '';
  // Seleção para exportação em lote — mapa {id: true}.
  var sel = STJ.estado._legSel || (STJ.estado._legSel = {});

  // Áreas e estados únicos para os filtros
  var areas  = [...new Set((leis || []).map(function (l) { return l.area || ''; }).filter(Boolean))].sort();
  var estados = [...new Set((leis || []).map(function (l) { return l.estado || ''; }).filter(Boolean))].sort();

  // Filtrar
  var filtradas = (leis || []).filter(function (l) {
    if (fArea && (l.area || '') !== fArea) return false;
    if (fEst  && (l.estado || '') !== fEst)  return false;
    if (q) {
      var hay = [l.titulo, l.numero, l.autor, l.area, l.ementa].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Ordenar
  filtradas = filtradas.slice().sort(function (a, b) {
    switch (ord) {
      case 'titulo-asc':  return (a.titulo || '').localeCompare(b.titulo || '', 'pt');
      case 'titulo-desc': return (b.titulo || '').localeCompare(a.titulo || '', 'pt');
      case 'data-asc':    return (a.dataPublicacao || '') > (b.dataPublicacao || '') ? 1 : -1;
      case 'data-desc':   return (a.dataPublicacao || '') < (b.dataPublicacao || '') ? 1 : -1;
      case 'numero-asc':  return (a.numero || '').localeCompare(b.numero || '', 'pt');
      default: return 0;
    }
  });

  var optArea  = '<option value="">Todas as áreas</option>'  + areas.map(function (a) { return '<option value="' + h(a) + '"' + (fArea === a ? ' selected' : '') + '>' + h(a) + '</option>'; }).join('');
  var optEst   = '<option value="">Todos os estados</option>' + estados.map(function (e) { return '<option value="' + h(e) + '"' + (fEst === e ? ' selected' : '') + '>' + h(e) + '</option>'; }).join('');
  var optOrd   = [
    ['data-desc','Mais recentes'],['data-asc','Mais antigas'],
    ['titulo-asc','Título A→Z'],['titulo-desc','Título Z→A'],
    ['numero-asc','Número']
  ].map(function (o) { return '<option value="' + o[0] + '"' + (ord === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');

  var linhas = filtradas.map(function (l) {
    return '<div class="list-item" role="button" tabindex="0" onclick="STJ.navegar(\'lei-detalhe\',{currentLawId:\'' + h(l.id) + '\'})" onkeydown="if(event.key===\'Enter\')STJ.navegar(\'lei-detalhe\',{currentLawId:\'' + h(l.id) + '\'})">' +
      '<label class="list-item-check" onclick="event.stopPropagation()"><input type="checkbox" aria-label="Selecionar ' + h(l.numero) + ' para exportação"' + (sel[l.id] ? ' checked' : '') + ' onchange="STJ.vistas._legToggleSel(\'' + h(l.id) + '\', this.checked)"></label>' +
      '<span class="badge b-red" style="flex-shrink:0;margin-top:2px">' + h(l.area || 'Lei') + '</span>' +
      '<div class="list-item-body"><div class="list-item-title">' + h(l.titulo) + '</div>' +
      '<div class="list-item-meta">' + h(l.numero) + ' · ' + fd(l.dataPublicacao) + ' · ' + h(l.autor || '—') + ' · ' + sd(l.estado) + '</div></div>' +
      '<span class="list-arrow" aria-hidden="true">›</span></div>';
  }).join('') || '<div class="empty-state"><p>Nenhuma lei encontrada' + (q || fArea || fEst ? ' para os filtros aplicados' : '') + '.</p></div>';

  var idsVisiveis = filtradas.map(function (l) { return l.id; });
  var nSel = idsVisiveis.filter(function (id) { return sel[id]; }).length;
  var todosVisiveisSel = idsVisiveis.length > 0 && nSel === idsVisiveis.length;

  var toolbarLote = '<div class="batch-toolbar">' +
    '<label class="batch-toolbar-all"><input type="checkbox" data-ids="' + idsVisiveis.join(',') + '"' + (todosVisiveisSel ? ' checked' : '') + ' onchange="STJ.vistas._legToggleSelTodos(this.checked, this.dataset.ids ? this.dataset.ids.split(\',\') : [])" aria-label="Selecionar todas as leis visíveis"> Selecionar visíveis</label>' +
    '<span class="batch-toolbar-count">' + (nSel ? nSel + ' selecionada(s)' : 'Nenhuma selecionada') + '</span>' +
    '<button class="btn btn-outline btn-sm" ' + (nSel ? '' : 'disabled') + ' onclick="STJ.exportarPdfLote(\'lei\', Object.keys(STJ.estado._legSel || {}))">⬇ Exportar selecionadas (PDF)</button>' +
    (nSel ? '<button class="btn btn-outline btn-sm" onclick="STJ.estado._legSel={};STJ.render()">✕ Limpar seleção</button>' : '') +
    '</div>';

  return '<div class="section-title">Legislação <span style="font-size:13px;font-weight:400;color:var(--muted)">(' + filtradas.length + ' de ' + (leis || []).length + ')</span></div>' +
    '<div style="background:var(--white);border:1px solid var(--border);padding:1rem;margin-bottom:1rem;display:flex;gap:.6rem;flex-wrap:wrap;align-items:flex-end">' +
    '<div style="flex:1;min-width:180px"><label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Pesquisar</label>' +
    '<div class="search-form" style="margin:0"><input type="search" id="leg-q" value="' + h(STJ.estado._legQ || '') + '" placeholder="Título, número, autor…" onkeydown="if(event.key===\'Enter\')STJ.vistas._legFiltrar()" oninput="STJ.vistas._legFiltrar()" aria-label="Pesquisar legislação"><button onclick="STJ.vistas._legFiltrar()" aria-label="Pesquisar">›</button></div></div>' +
    '<div><label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Área jurídica</label><select id="leg-area" onchange="STJ.vistas._legFiltrar()" style="height:38px;border:1px solid var(--border);border-radius:4px;padding:0 .5rem;font-size:13px">' + optArea + '</select></div>' +
    '<div><label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Estado</label><select id="leg-est" onchange="STJ.vistas._legFiltrar()" style="height:38px;border:1px solid var(--border);border-radius:4px;padding:0 .5rem;font-size:13px">' + optEst + '</select></div>' +
    '<div><label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Ordenar por</label><select id="leg-ord" onchange="STJ.vistas._legFiltrar()" style="height:38px;border:1px solid var(--border);border-radius:4px;padding:0 .5rem;font-size:13px">' + optOrd + '</select></div>' +
    (q || fArea || fEst ? '<button class="btn btn-outline btn-sm" onclick="STJ.vistas._legLimpar()" style="align-self:flex-end">✕ Limpar</button>' : '') +
    '</div>' +
    toolbarLote +
    '<div class="panel">' + linhas + '</div>';
};

STJ.vistas._legToggleSel = function (id, checked) {
  var sel = STJ.estado._legSel || (STJ.estado._legSel = {});
  if (checked) sel[id] = true; else delete sel[id];
  STJ.render();
};
STJ.vistas._legToggleSelTodos = function (checked, ids) {
  var sel = STJ.estado._legSel || (STJ.estado._legSel = {});
  (ids || []).forEach(function (id) { if (!id) return; if (checked) sel[id] = true; else delete sel[id]; });
  STJ.render();
};

STJ.vistas._legFiltrar = function () {
  STJ.estado._legQ    = (document.getElementById('leg-q')    || {}).value || '';
  STJ.estado._legArea = (document.getElementById('leg-area') || {}).value || '';
  STJ.estado._legEst  = (document.getElementById('leg-est')  || {}).value || '';
  STJ.estado._legOrd  = (document.getElementById('leg-ord')  || {}).value || 'data-desc';
  STJ.render();
};
STJ.vistas._legLimpar = function () {
  STJ.estado._legQ = ''; STJ.estado._legArea = ''; STJ.estado._legEst = ''; STJ.estado._legOrd = 'data-desc';
  STJ.render();
};

/* ── DETALHE LEI ─────────────────────────────────────────────────── */
STJ.vistas.leiDetalhe = async function () {
  var resp = await STJ.api('obterLei', { id: STJ.estado.currentLawId });
  if (!resp) return '<p>Lei não encontrada.</p>';
  var lei = resp.lei, arts = (resp.artigos || []).sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
  var h = STJ.h, fd = STJ.fmtDate, sd = STJ.stBadge;

  var toc = '', lg = '', lc = '';
  arts.forEach(function (a, i) {
    var gk = (a.grupoTipo || '') + (a.grupoNum || '');
    var ck = a.capNum || '';
    if (gk && gk !== lg) {
      toc += '<div style="font-size:10px;color:var(--red);font-weight:700;text-transform:uppercase;padding:.5rem 1rem .3rem;letter-spacing:.07em">' +
        h((a.grupoTipo || '') + ' ' + (a.grupoNum || '') + (a.grupoTit ? ' — ' + a.grupoTit : '')) + '</div>';
      lg = gk; lc = '';
    }
    if (ck && ck !== lc) {
      toc += '<div style="font-size:10px;color:var(--muted);padding:.2rem 1rem .2rem 1.5rem;font-style:italic">Cap. ' + h(a.capNum || '') + (a.capTit ? ' — ' + h(a.capTit) : '') + '</div>';
      lc = ck;
    }
    var ativo = STJ.estado.openInterpArt === i;
    toc += '<div class="toc-art' + (ativo ? ' active' : '') + '" tabindex="0" role="button" onclick="document.getElementById(\'art-' + i + '\')?.scrollIntoView({behavior:\'smooth\',block:\'start\'})" onkeydown="if(event.key===\'Enter\')document.getElementById(\'art-' + i + '\')?.scrollIntoView({behavior:\'smooth\',block:\'start\'})">' +
      '<span class="toc-art-n">' + h((a.numero || '').replace('Artigo ', 'Art. ')) + '</span>' +
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + h(a.titulo || '') + '</span></div>';
  });

  var corpo = '', lg2 = '', lc2 = '', ls2 = '';
  arts.forEach(function (a, i) {
    var gk = (a.grupoTipo || '') + (a.grupoNum || '');
    var ck = a.capNum || '', sk = a.secNum || '';
    if (gk && gk !== lg2) {
      corpo += '<div class="banner-titulo"><div class="bt-tipo">' + h(a.grupoTipo || '') + ' ' + h(a.grupoNum || '') + '</div><div class="bt-name">' + h(a.grupoTit || '') + '</div></div>';
      lg2 = gk; lc2 = ''; ls2 = '';
    }
    if (ck && ck !== lc2) {
      corpo += '<div class="banner-cap"><div class="bc-tipo">Capítulo ' + h(a.capNum || '') + '</div><div class="bc-name">' + h(a.capTit || '') + '</div></div>';
      lc2 = ck; ls2 = '';
    }
    if (sk && sk !== ls2) {
      corpo += '<div class="banner-sec"><div class="bs-name">Secção ' + h(a.secNum || '') + (a.secTit ? ' — ' + h(a.secTit) : '') + '</div></div>';
      ls2 = sk;
    }
    var hi = !!a.interpretacaoTexto;
    var io = STJ.estado.openInterpArt === i;
    var interpHTML = '';
    if (hi && io) {
      interpHTML = '<div class="interp-panel" role="region" aria-label="Interpretação do STJ para ' + h(a.numero) + '">' +
        '<div class="interp-panel-hd">⚖ Interpretação Oficial do STJ</div>' +
        (a.interpretacaoTexto ? '<div class="i-sec"><div class="i-key">Texto interpretativo</div><div class="i-val">"' + h(a.interpretacaoTexto) + '"</div></div>' : '') +
        (a.principios ? '<div class="i-sec"><div class="i-key">Princípios</div><div class="i-val">' + h(a.principios) + '</div></div>' : '') +
        (a.ratio ? '<div class="i-sec"><div class="i-key">Ratio decidendi</div><div class="i-val">' + h(a.ratio) + '</div></div>' : '') +
        (a.enquadramento ? '<div class="i-sec"><div class="i-key">Enquadramento</div><div class="i-val">' + h(a.enquadramento) + '</div></div>' : '') +
        '</div>';
    } else if (hi) {
      interpHTML = '<div class="interp-hint">📌 Este artigo possui interpretação jurisprudencial do STJ</div>';
    }

    var citAberto = STJ.estado.openCitArt === i;
    var citCache = STJ.estado._citCache || {};
    var citEstado = citCache[a.id]; // undefined = ainda não pedido, 'loading', ou array
    var citHTML = '';
    if (citAberto) {
      if (citEstado === 'loading' || citEstado === undefined) {
        citHTML = '<div class="cit-panel"><div class="spinner-line">A procurar acórdãos que citam este artigo…</div></div>';
      } else if (!citEstado.length) {
        citHTML = '<div class="cit-panel"><div class="empty-state"><p>Nenhum acórdão cita este artigo, por enquanto.</p></div></div>';
      } else {
        citHTML = '<div class="cit-panel" role="region" aria-label="Acórdãos que citam ' + h(a.numero) + '">' +
          '<div class="cit-panel-hd">🔗 Acórdãos que citam este artigo (' + citEstado.length + ')</div>' +
          '<div class="cit-list">' + citEstado.map(function (ac) {
            return '<div class="cit-item" role="button" tabindex="0" onclick="STJ.navegar(\'acordao-detalhe\',{currentAcId:\'' + h(ac.id) + '\'})" onkeydown="if(event.key===\'Enter\')STJ.navegar(\'acordao-detalhe\',{currentAcId:\'' + h(ac.id) + '\'})">' +
              '<span class="cit-item-num">' + h(ac.numero) + '</span>' +
              '<span class="cit-item-tit">' + h(ac.titulo || '') + '</span>' +
              STJ.stBadge(ac.estado) +
              '</div>';
          }).join('') + '</div></div>';
      }
    }

    corpo += '<div class="art-block' + (hi ? ' has-interp' : '') + '" id="art-' + i + '">' +
      '<div class="art-block-hd"><div class="art-block-title">' + h(a.numero) + (a.titulo ? ' — ' + h(a.titulo) : '') + '</div>' +
      '<div class="art-block-actions">' +
      (hi ? '<button class="btn btn-outline btn-sm" onclick="STJ.vistas._toggleInterp(' + i + ')" aria-expanded="' + io + '" aria-controls="interp-' + i + '">' + (io ? '▲ Fechar' : '⚖ Ver Interpretação') + '</button>'
        : '<span style="font-size:11px;color:var(--muted)">Sem interpretação</span>') +
      '<button class="btn btn-outline btn-sm" onclick="STJ.vistas._toggleCitacoes(' + i + ',\'' + h(a.id) + '\')" aria-expanded="' + citAberto + '">' + (citAberto ? '▲ Fechar' : '🔗 Quem cita este artigo') + '</button>' +
      '</div></div>' +
      '<div class="art-block-body">' + STJ.nl2p(a.texto || '') + '</div>' +
      interpHTML + citHTML + '</div>';
  });
  if (!arts.length) corpo = '<div class="panel"><div class="empty-state"><p>Sem artigos. Use a importação em lote na Área Reservada.</p></div></div>';

  var authBar = (lei.promulgadoPor || lei.elaboradoPor || lei.revistoPor) ?
    '<div class="authorship-bar">' +
    (lei.promulgadoPor ? '<div class="auth-item"><div class="k">Promulgado por</div><div class="v">' + h(lei.promulgadoPor) + '</div></div>' : '') +
    (lei.elaboradoPor ? '<div class="auth-item"><div class="k">Elaborado por</div><div class="v">' + h(lei.elaboradoPor) + '</div></div>' : '') +
    (lei.revistoPor ? '<div class="auth-item"><div class="k">Revisto por</div><div class="v">' + h(lei.revistoPor) + '</div></div>' : '') +
    '</div>' : '';

  return '<button class="btn btn-outline btn-sm" onclick="STJ.navegar(\'legislacao\')" style="margin-bottom:1.25rem">‹ Legislação</button>' +
    '<div class="doc-card">' +
    '<div class="doc-ref">' + h(lei.numero) + '</div>' +
    '<div class="doc-title">' + h(lei.titulo) + '</div>' +
    authBar +
    '<div class="doc-meta">' +
    '<div class="doc-meta-item"><div class="k">Data de publicação</div><div class="v">' + fd(lei.dataPublicacao) + '</div></div>' +
    '<div class="doc-meta-item"><div class="k">Publicação oficial</div><div class="v">' + h(lei.publicacaoOficial || '—') + '</div></div>' +
    '<div class="doc-meta-item"><div class="k">Órgão emitente</div><div class="v">' + h(lei.autor || '—') + '</div></div>' +
    '<div class="doc-meta-item"><div class="k">Área jurídica</div><div class="v">' + h(lei.area || '—') + '</div></div>' +
    '<div class="doc-meta-item"><div class="k">Estado</div><div class="v">' + sd(lei.estado) + '</div></div>' +
    '<div class="doc-meta-item"><div class="k">Artigos</div><div class="v">' + arts.length + '</div></div>' +
    '</div>' +
    (lei.ementa ? '<div class="doc-ementa">' + h(lei.ementa) + '</div>' : '') +
    '<div class="doc-actions">' +
    '<button class="btn btn-outline btn-sm" onclick="STJ.exportarPdf(\'lei\',\'' + h(lei.id) + '\')">⬇ PDF</button>' +
    '<button class="btn btn-outline btn-sm" onclick="window.print()">Imprimir</button>' +
    '<button class="btn btn-outline btn-sm" onclick="STJ.copiarLigacao()">Copiar ligação</button>' +
    (STJ.estado.sessao ? '<button class="btn btn-outline btn-sm" onclick="STJ.apiAuth(\'adicionarFavorito\',{tipo:\'Lei\',id:\'' + h(lei.id) + '\'}).then(function(){STJ.toast(\'Adicionado aos favoritos.\')})">★ Favorito</button>' : '') +
    '</div></div>' +
    '<div class="law-layout">' +
    '<nav class="toc-panel" aria-label="Índice da lei">' +
    '<div class="toc-panel-hd">Índice</div>' +
    (toc || '<div style="padding:.75rem 1rem;font-size:12px;color:var(--muted)">Sem artigos</div>') +
    '</nav>' +
    '<div>' + corpo + '</div></div>';
};

STJ.vistas._toggleInterp = function (i) {
  STJ.estado.openInterpArt = STJ.estado.openInterpArt === i ? null : i;
  STJ.render().then(function () {
    if (STJ.estado.openInterpArt !== null) {
      var el = document.getElementById('art-' + i);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
};

/* Abre/fecha o painel "Quem cita este artigo" para o artigo no índice i
   da lei atual. Os resultados são pedidos uma única vez por artigo e
   guardados em STJ.estado._citCache (chave = id do artigo) para que
   reabrir o painel não dispare um novo pedido à API. */
STJ.vistas._toggleCitacoes = async function (i, artigoId) {
  if (STJ.estado.openCitArt === i) {
    STJ.estado.openCitArt = null;
    STJ.render();
    return;
  }
  STJ.estado.openCitArt = i;
  if (!STJ.estado._citCache) STJ.estado._citCache = {};
  if (!(artigoId in STJ.estado._citCache)) {
    STJ.estado._citCache[artigoId] = 'loading';
    STJ.render();
    var lista = [];
    try {
      lista = (await STJ.api('obterCitantesArtigo', { artigoId: artigoId })) || [];
    } catch (e) { lista = []; }
    STJ.estado._citCache[artigoId] = lista;
  }
  STJ.render().then(function () {
    var el = document.getElementById('art-' + i);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
};

/* ── LISTA JURISPRUDÊNCIA ────────────────────────────────────────── */
STJ.vistas.jurisprudenciaLista = async function () {
  var acs = await STJ.api('listarAcordaos');
  var h = STJ.h, sd = STJ.stBadge, fd = STJ.fmtDate;

  var q     = (STJ.estado._jurQ    || '').toLowerCase();
  var ord   = STJ.estado._jurOrd   || 'data-desc';
  var fTipo = STJ.estado._jurTipo  || '';
  var fEst  = STJ.estado._jurEst   || '';

  var tipos   = [...new Set((acs || []).map(function (a) { return a.tipo || ''; }).filter(Boolean))].sort();
  var estados = [...new Set((acs || []).map(function (a) { return a.estado || ''; }).filter(Boolean))].sort();

  var filtrados = (acs || []).filter(function (a) {
    if (fTipo && (a.tipo || '') !== fTipo) return false;
    if (fEst  && (a.estado || '') !== fEst)  return false;
    if (q) {
      var hay = [a.titulo, a.numero, a.relator, a.tipo, a.sumario].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filtrados = filtrados.slice().sort(function (a, b) {
    switch (ord) {
      case 'titulo-asc':  return (a.titulo || '').localeCompare(b.titulo || '', 'pt');
      case 'titulo-desc': return (b.titulo || '').localeCompare(a.titulo || '', 'pt');
      case 'data-asc':    return (a.data || '') > (b.data || '') ? 1 : -1;
      case 'data-desc':   return (a.data || '') < (b.data || '') ? 1 : -1;
      case 'numero-asc':  return (a.numero || '').localeCompare(b.numero || '', 'pt');
      case 'relator-asc': return (a.relator || '').localeCompare(b.relator || '', 'pt');
      default: return 0;
    }
  });

  var optTipo = '<option value="">Todos os tipos</option>'  + tipos.map(function (t) { return '<option value="' + h(t) + '"' + (fTipo === t ? ' selected' : '') + '>' + h(t) + '</option>'; }).join('');
  var optEst  = '<option value="">Todos os estados</option>' + estados.map(function (e) { return '<option value="' + h(e) + '"' + (fEst === e ? ' selected' : '') + '>' + h(e) + '</option>'; }).join('');
  var optOrd  = [
    ['data-desc','Mais recentes'],['data-asc','Mais antigos'],
    ['titulo-asc','Título A→Z'],['titulo-desc','Título Z→A'],
    ['numero-asc','Número'],['relator-asc','Relator A→Z']
  ].map(function (o) { return '<option value="' + o[0] + '"' + (ord === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');

  var linhas = filtrados.map(function (a) {
    return '<div class="list-item" role="button" tabindex="0" onclick="STJ.navegar(\'acordao-detalhe\',{currentAcId:\'' + h(a.id) + '\'})" onkeydown="if(event.key===\'Enter\')STJ.navegar(\'acordao-detalhe\',{currentAcId:\'' + h(a.id) + '\'})">' +
      '<span class="badge b-gray" style="flex-shrink:0;margin-top:2px">' + h(a.tipo || 'STJ') + '</span>' +
      '<div class="list-item-body"><div class="list-item-title">' + h(a.titulo) + '</div>' +
      '<div class="list-item-meta">' + h(a.numero) + ' · ' + fd(a.data) + ' · ' + h(a.relator || '—') + ' · ' + sd(a.estado) + '</div></div>' +
      '<span class="list-arrow" aria-hidden="true">›</span></div>';
  }).join('') || '<div class="empty-state"><p>Nenhum acórdão encontrado' + (q || fTipo || fEst ? ' para os filtros aplicados' : '') + '.</p></div>';

  return '<div class="section-title">Jurisprudência <span style="font-size:13px;font-weight:400;color:var(--muted)">(' + filtrados.length + ' de ' + (acs || []).length + ')</span></div>' +
    '<div style="background:var(--white);border:1px solid var(--border);padding:1rem;margin-bottom:1rem;display:flex;gap:.6rem;flex-wrap:wrap;align-items:flex-end">' +
    '<div style="flex:1;min-width:180px"><label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Pesquisar</label>' +
    '<div class="search-form" style="margin:0"><input type="search" id="jur-q" value="' + h(STJ.estado._jurQ || '') + '" placeholder="Título, número, relator…" onkeydown="if(event.key===\'Enter\')STJ.vistas._jurFiltrar()" oninput="STJ.vistas._jurFiltrar()" aria-label="Pesquisar jurisprudência"><button onclick="STJ.vistas._jurFiltrar()" aria-label="Pesquisar">›</button></div></div>' +
    '<div><label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Tipo de processo</label><select id="jur-tipo" onchange="STJ.vistas._jurFiltrar()" style="height:38px;border:1px solid var(--border);border-radius:4px;padding:0 .5rem;font-size:13px">' + optTipo + '</select></div>' +
    '<div><label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Estado</label><select id="jur-est" onchange="STJ.vistas._jurFiltrar()" style="height:38px;border:1px solid var(--border);border-radius:4px;padding:0 .5rem;font-size:13px">' + optEst + '</select></div>' +
    '<div><label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">Ordenar por</label><select id="jur-ord" onchange="STJ.vistas._jurFiltrar()" style="height:38px;border:1px solid var(--border);border-radius:4px;padding:0 .5rem;font-size:13px">' + optOrd + '</select></div>' +
    (q || fTipo || fEst ? '<button class="btn btn-outline btn-sm" onclick="STJ.vistas._jurLimpar()" style="align-self:flex-end">✕ Limpar</button>' : '') +
    '</div>' +
    '<div class="panel">' + linhas + '</div>';
};

STJ.vistas._jurFiltrar = function () {
  STJ.estado._jurQ    = (document.getElementById('jur-q')    || {}).value || '';
  STJ.estado._jurTipo = (document.getElementById('jur-tipo') || {}).value || '';
  STJ.estado._jurEst  = (document.getElementById('jur-est')  || {}).value || '';
  STJ.estado._jurOrd  = (document.getElementById('jur-ord')  || {}).value || 'data-desc';
  STJ.render();
};
STJ.vistas._jurLimpar = function () {
  STJ.estado._jurQ = ''; STJ.estado._jurTipo = ''; STJ.estado._jurEst = ''; STJ.estado._jurOrd = 'data-desc';
  STJ.render();
};

/* ── DETALHE ACÓRDÃO ─────────────────────────────────────────────── */
STJ.vistas.acordaoDetalhe = async function () {
  var ac = await STJ.api('obterAcordao', { id: STJ.estado.currentAcId });
  if (!ac) return '<p>Acórdão não encontrado.</p>';
  var h = STJ.h, sd = STJ.stBadge, fd = STJ.fmtDate, np = STJ.nl2p;

  var sec = function (titulo, txt) {
    if (!txt) return '';
    return '<div class="ac-sec"><div class="ac-sec-hd">' + titulo + '</div><div class="ac-sec-body">' + np(txt) + '</div></div>';
  };
  var artTags = ac.artigosAplicados
    ? '<div class="art-tags-row"><span style="font-size:11px;color:var(--muted);font-weight:600">Artigos aplicados:</span>' +
      String(ac.artigosAplicados).split(',').filter(Boolean).map(function (t) { return '<span class="art-chip">' + h(t.trim()) + '</span>'; }).join('') + '</div>'
    : '';
  var authBar = (ac.elaboradoPor || ac.revistoPor)
    ? '<div class="authorship-bar">' +
      (ac.elaboradoPor ? '<div class="auth-item"><div class="k">Elaborado por</div><div class="v">' + h(ac.elaboradoPor) + '</div></div>' : '') +
      (ac.revistoPor ? '<div class="auth-item"><div class="k">Revisto por</div><div class="v">' + h(ac.revistoPor) + '</div></div>' : '') +
      '</div>' : '';

  return '<button class="btn btn-outline btn-sm" onclick="STJ.navegar(\'jurisprudencia\')" style="margin-bottom:1.25rem">‹ Jurisprudência</button>' +
    '<div class="doc-card">' +
    '<div class="doc-ref">' + h(ac.numero) + '</div>' +
    '<div class="doc-title">' + h(ac.titulo) + '</div>' +
    authBar +
    '<div class="ac-meta">' +
    '<div class="doc-meta-item"><div class="k">Data</div><div class="v">' + fd(ac.data) + '</div></div>' +
    '<div class="doc-meta-item"><div class="k">Tipo de processo</div><div class="v">' + h(ac.tipo || '—') + '</div></div>' +
    '<div class="doc-meta-item"><div class="k">Estado</div><div class="v">' + sd(ac.estado) + '</div></div>' +
    '<div class="doc-meta-item"><div class="k">Relator</div><div class="v">' + h(ac.relator || '—') + '</div></div>' +
    '<div class="doc-meta-item"><div class="k">Juízes adjuntos</div><div class="v">' + h(ac.juizesAdjuntos || '—') + '</div></div>' +
    '<div class="doc-meta-item"><div class="k">Votação</div><div class="v">' + h(ac.votacao || '—') + '</div></div>' +
    '</div>' +
    '<div class="doc-actions">' +
    '<button class="btn btn-outline btn-sm" onclick="STJ.exportarPdf(\'acordao\',\'' + h(ac.id) + '\')">⬇ PDF</button>' +
    '<button class="btn btn-outline btn-sm" onclick="window.print()">Imprimir</button>' +
    '<button class="btn btn-outline btn-sm" onclick="STJ.copiarLigacao()">Copiar ligação</button>' +
    (STJ.estado.sessao ? '<button class="btn btn-outline btn-sm" onclick="STJ.apiAuth(\'adicionarFavorito\',{tipo:\'Acordao\',id:\'' + h(ac.id) + '\'}).then(function(){STJ.toast(\'Adicionado aos favoritos.\')})">★ Favorito</button>' : '') +
    '</div></div>' +
    sec('Sumário', ac.sumario) +
    sec('Factos Provados', ac.factos) +
    sec('Questões Jurídicas', ac.questoes) +
    sec('Fundamentação', ac.fundamentacao) +
    (ac.decisao ? '<div class="ac-sec"><div class="ac-sec-hd">Decisão</div><div class="ac-sec-body"><div class="decision-box">' + np(ac.decisao) + '</div>' + artTags + '</div></div>' : '');
};

/* ── PESQUISA ─────────────────────────────────────────────────────── */
STJ.vistas.pesquisa = async function () {
  var q = STJ.estado.searchQuery || '';
  var f = STJ.estado.searchFilters;
  // PERF-01: pedidos em paralelo em vez de sequenciais.
  var resultadosPesquisa = await Promise.all([
    q ? STJ.api('pesquisar', { query: q, filtros: f }) : Promise.resolve([]),
    STJ.estado.sessao ? STJ.apiAuth('listarPesquisasGuardadas') : Promise.resolve([])
  ]);
  var resultados = resultadosPesquisa[0] || [];
  var pesqGuardadas = resultadosPesquisa[1] || [];
  // BUG-02: cache a lista em STJ (em vez de embutir JSON.stringify(p)
  // num atributo onclick="" — isso quebra o HTML com aspas duplas
  // sempre que o nome/query/filtros da pesquisa guardada contiverem
  // aspas, comuns em contexto jurídico). Referenciamos por índice.
  STJ._pesqGuardadasCache = pesqGuardadas;
  var h = STJ.h, sd = STJ.stBadge;

  var cartoesPesq = pesqGuardadas.length
    ? '<div style="margin-bottom:1rem"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.5rem">As minhas pesquisas guardadas</div>' +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
      pesqGuardadas.map(function (p, i) { return '<button class="btn btn-outline btn-sm" onclick="STJ.vistas._carregarPesquisaGuardada(' + i + ')">' + h(p.nome) + '</button>'; }).join('') + '</div></div>'
    : '';

  var linhasResultados = resultados.map(function (r) {
    var fnClick = r.tipo === 'Lei' ? 'STJ.navegar(\'lei-detalhe\',{currentLawId:\'' + h(r.id) + '\'})' :
      r.tipo === 'Acórdão' ? 'STJ.navegar(\'acordao-detalhe\',{currentAcId:\'' + h(r.id) + '\'})' :
      r.leiId ? 'STJ.navegar(\'lei-detalhe\',{currentLawId:\'' + h(r.leiId) + '\'})' : '';
    return '<div class="result-card" role="button" tabindex="0" onclick="' + fnClick + '" onkeydown="if(event.key===\'Enter\'){' + fnClick + '}">' +
      '<div class="result-type">' + h(r.tipo) + '</div>' +
      '<div class="result-title">' + h(r.titulo) + '</div>' +
      '<div class="result-excerpt">' + h((r.excerto || '').substring(0, 220)) + '</div>' +
      '<div class="result-foot"><span>' + h(r.meta) + '</span><span>' + sd(r.estado) + '</span></div></div>';
  }).join('');

  return '<div class="section-title">Pesquisa Avançada</div>' +
    '<div style="background:var(--white);border:1px solid var(--border);padding:1.5rem;margin-bottom:1.5rem">' +
    cartoesPesq +
    '<div class="search-form" role="search" style="margin-bottom:.75rem">' +
    '<label for="sq" class="sr-only">Pesquisa</label>' +
    '<input type="search" id="sq" value="' + h(q) + '" placeholder="Pesquise legislação, acórdãos, interpretações…" onkeydown="if(event.key===\'Enter\')STJ.vistas._pesquisar()" aria-label="Campo de pesquisa avançada">' +
    '<button onclick="STJ.vistas._pesquisar()">Pesquisar</button></div>' +
    '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">' +
    '<div class="search-filters">' +
    '<select id="ft" onchange="STJ.vistas._pesquisar()" aria-label="Tipo de documento">' +
    '<option value="todos"' + (f.tipo === 'todos' ? ' selected' : '') + '>Todos os tipos</option>' +
    '<option value="leis"' + (f.tipo === 'leis' ? ' selected' : '') + '>Leis</option>' +
    '<option value="acordaos"' + (f.tipo === 'acordaos' ? ' selected' : '') + '>Acórdãos</option>' +
    '<option value="interp"' + (f.tipo === 'interp' ? ' selected' : '') + '>Interpretações STJ</option>' +
    '</select></div>' +
    (STJ.estado.sessao && q ? '<button class="btn btn-outline btn-sm" onclick="STJ.vistas._guardarPesquisa()">★ Guardar pesquisa</button>' : '') +
    '</div></div>' +
    (q ? '<div style="font-size:13px;color:var(--mid);margin-bottom:1rem"><strong style="color:var(--charcoal)">' + resultados.length + '</strong> resultado(s) para "<strong style="color:var(--charcoal)">' + h(q) + '</strong>"</div>' : '') +
    (resultados.length ? linhasResultados : q
      ? '<div class="empty-state" style="background:var(--white);border:1px solid var(--border);padding:2rem"><p>Sem resultados para "<strong>' + h(q) + '</strong>".</p></div>'
      : '<div class="empty-state" style="background:var(--white);border:1px solid var(--border);padding:2rem"><p>Introduza um termo de pesquisa.</p></div>');
};

STJ.vistas._pesquisar = function () {
  STJ.estado.searchQuery = STJ.g('sq');
  STJ.estado.searchFilters.tipo = STJ.gv('ft') || 'todos';
  STJ.atualizarUrl();
  STJ.render();
};

STJ.vistas._carregarPesquisaGuardada = function (indice) {
  var p = (STJ._pesqGuardadasCache || [])[indice];
  if (!p) { STJ.toast('Pesquisa guardada não encontrada.'); return; }
  STJ.estado.searchQuery = p.query;
  STJ.estado.searchFilters = p.filtros || { tipo: 'todos' };
  STJ.atualizarUrl();
  STJ.render();
};

STJ.vistas._guardarPesquisa = async function () {
  var nome = await STJ.modalInput({
    titulo: 'Guardar pesquisa',
    label: 'Nome para guardar esta pesquisa',
    placeholder: 'ex.: Arrendamento urbano — leis em vigor',
    textoConfirmar: 'Guardar'
  });
  if (!nome) return;
  await STJ.apiAuth('guardarPesquisa', { nome: nome, query: STJ.estado.searchQuery, filtros: STJ.estado.searchFilters });
  STJ.toast('Pesquisa guardada.');
  STJ.render();
};

/* ── PÁGINA PRIVACIDADE / RGPD ───────────────────────────────────── */
STJ.vistas.privacidade = function () {
  return '<div class="section-title">Política de Privacidade (RGPD)</div>' +
    '<div class="panel"><div style="padding:1.5rem;font-size:13.5px;line-height:1.9;color:var(--dark)">' +
    '<p><strong>Responsável pelo tratamento:</strong> Supremo Tribunal de Justiça.</p>' +
    '<p style="margin-top:.75rem"><strong>Dados recolhidos:</strong> nome de utilizador, nome e registo de atividade (logs de auditoria) de utilizadores autenticados. Visitantes anónimos não têm dados registados.</p>' +
    '<p style="margin-top:.75rem"><strong>Finalidade:</strong> controlo de acesso à área de administração e rastreabilidade das alterações efetuadas ao conteúdo publicado.</p>' +
    '<p style="margin-top:.75rem"><strong>Base legal:</strong> interesse legítimo da instituição (rastreabilidade e responsabilização) e consentimento do utilizador no momento do registo.</p>' +
    '<p style="margin-top:.75rem"><strong>Prazo de conservação:</strong> registos de auditoria conservados por 5 anos; dados de conta até revogação pelo utilizador.</p>' +
    '<p style="margin-top:.75rem"><strong>Direitos do titular:</strong> acesso, rectificação, apagamento e portabilidade. Para exercer os seus direitos, contacte o administrador do sistema ou utilize a opção "Eliminar conta" na sua área de utilizador.</p>' +
    (STJ.estado.sessao ? '<div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border-lt)">' +
      '<button class="btn btn-danger" onclick="STJ.vistas._pedirEliminarConta()">Eliminar / anonimizar a minha conta (RGPD)</button></div>' : '') +
    '</div></div>' +
    '<button class="btn btn-outline btn-sm" onclick="history.back()" style="margin-top:1rem">‹ Voltar</button>';
};

STJ.vistas._pedirEliminarConta = async function () {
  if (!confirm('Esta ação anonimizará permanentemente os seus dados pessoais. Os registos de auditoria (obrigação legal) serão mantidos sem identificação pessoal. Confirma?')) return;
  await STJ.apiAuth('eliminarDadosUtilizador');
  STJ.guardarSessao(null);
  STJ.toast('A sua conta foi anonimizada.');
  STJ.navegar('home');
};
