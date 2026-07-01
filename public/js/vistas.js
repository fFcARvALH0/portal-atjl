/* ════════════════════════════════════════════════════════════════════
   js/vistas.js  — Interface reformulada v2
   Vistas públicas: Legislação, Jurisprudência, Pesquisa, Home.
   Novas funcionalidades:
     • TOC lateral com destaque automático por IntersectionObserver
     • Pesquisa dentro do documento (highlight + navegação)
     • Referências cruzadas entre artigos (hiperligação automática)
     • Recolher/expandir capítulos e secções
     • Navegação anterior/seguinte/primeiro/último artigo
     • Barra de ferramentas com modo leitura
     • Breadcrumb contextual
     • Acórdão com sumário destacado e layout de metadados melhorado
   ════════════════════════════════════════════════════════════════════ */

/* ── Helpers internos ─────────────────────────────────────────────── */

/** Transforma referências a artigos do mesmo diploma em ligações clicáveis. */
STJ.vistas._hiperrefs = function (texto, artigosPorNumero) {
  if (!texto || !artigosPorNumero) return texto;
  // Padrão: "Artigo 25.º", "n.º 2 do Artigo 35.º", "artigo 7.º-A"
  return texto.replace(
    /\b(n\.º\s+\d+\s+do\s+)?[Aa]rtigo\s+(\d+\.?[ºo]?(?:-[A-Z])?|[IVXLCDM]+\.?[ºo]?|[ÚU]nico)/g,
    function (match) {
      var limpo = match.trim().replace(/^n\.º\s+\d+\s+do\s+/i, '').trim();
      var idx = artigosPorNumero[limpo.toLowerCase().replace(/\s+/g, ' ')];
      if (idx === undefined) return STJ.h(match);
      return '<a class="art-ref-link" href="#art-' + idx + '" onclick="STJ.vistas._irParaArtigo(' + idx + ');return false">' + STJ.h(match) + '</a>';
    }
  );
};

STJ.vistas._irParaArtigo = function (idx) {
  STJ.estado._docFocusArt = idx;
  var el = document.getElementById('art-' + idx);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.remove('art-flash'); void el.offsetWidth;
  el.classList.add('art-flash');
};

/** Constrói mapa número-normalizado → índice para hiperligações. */
STJ.vistas._buildArtMap = function (arts) {
  var m = {};
  arts.forEach(function (a, i) {
    var n = (a.numero || '').toLowerCase().replace(/\s+/g, ' ').trim();
    m[n] = i;
    // variante curta: "art. 5.º" → mesmo artigo
    var curta = n.replace(/^artigo\s+/, 'art. ');
    if (curta !== n) m[curta] = i;
  });
  return m;
};

/** Inicializa o IntersectionObserver do TOC na vista de lei. */
STJ.vistas._initTocObserver = function () {
  if (!('IntersectionObserver' in window)) return;
  var tocItems = document.querySelectorAll('.toc-art[data-idx]');
  if (!tocItems.length) return;
  var artBlocks = document.querySelectorAll('.art-block[id^="art-"]');
  if (!artBlocks.length) return;

  var ativo = null;
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var idx = e.target.id.replace('art-', '');
      if (ativo === idx) return;
      ativo = idx;
      tocItems.forEach(function (t) {
        var a = t.getAttribute('data-idx') === idx;
        t.classList.toggle('active', a);
        if (a) t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
  }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

  artBlocks.forEach(function (el) { obs.observe(el); });
  STJ._tocObserver = obs;
};

/** Pesquisa dentro do documento aberto. */
STJ.vistas._docSearch = {
  query: '', hits: [], cur: -1,

  run: function (q) {
    this.query = (q || '').trim();
    this.hits = [];
    this.cur = -1;
    // Limpa destaques anteriores
    document.querySelectorAll('mark.doc-hit').forEach(function (m) {
      m.outerHTML = m.textContent;
    });
    if (!this.query) { this._updateInfo(); return; }
    var re = new RegExp(this.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    var scope = document.getElementById('doc-body');
    if (!scope) return;
    // Percorre nós de texto e substitui por <mark>
    var walk = function (node) {
      if (node.nodeType === 3) {
        var val = node.textContent;
        if (!re.test(val)) return;
        re.lastIndex = 0;
        var frag = document.createDocumentFragment();
        var last = 0, m;
        while ((m = re.exec(val)) !== null) {
          frag.appendChild(document.createTextNode(val.slice(last, m.index)));
          var mk = document.createElement('mark');
          mk.className = 'doc-hit';
          mk.textContent = m[0];
          frag.appendChild(mk);
          last = re.lastIndex;
        }
        frag.appendChild(document.createTextNode(val.slice(last)));
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === 1 && !['SCRIPT','STYLE','BUTTON','INPUT'].includes(node.tagName)) {
        Array.from(node.childNodes).forEach(walk);
      }
    };
    walk(scope);
    this.hits = Array.from(scope.querySelectorAll('mark.doc-hit'));
    if (this.hits.length) { this.cur = 0; this._goto(0); }
    this._updateInfo();
  },

  next: function () { if (!this.hits.length) return; this.cur = (this.cur + 1) % this.hits.length; this._goto(this.cur); this._updateInfo(); },
  prev: function () { if (!this.hits.length) return; this.cur = (this.cur - 1 + this.hits.length) % this.hits.length; this._goto(this.cur); this._updateInfo(); },

  _goto: function (i) {
    this.hits.forEach(function (m, j) { m.classList.toggle('doc-hit-cur', j === i); });
    var el = this.hits[i];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  _updateInfo: function () {
    var el = document.getElementById('doc-search-info');
    if (!el) return;
    if (!this.query) { el.textContent = ''; return; }
    el.textContent = this.hits.length ? (this.cur + 1) + ' / ' + this.hits.length : 'Sem resultados';
  }
};

/* ── Breadcrumb ─────────────────────────────────────────────────── */
STJ.vistas._breadcrumb = function (lei) {
  var h = STJ.h;
  return '<nav class="breadcrumb" aria-label="Localização">' +
    '<button class="bc-item" onclick="STJ.navegar(\'legislacao\')">Legislação</button>' +
    '<span class="bc-sep">›</span>' +
    '<span class="bc-item bc-cur">' + h(lei.titulo) + '</span>' +
    '</nav>';
};

STJ.vistas._breadcrumbAc = function (ac) {
  var h = STJ.h;
  return '<nav class="breadcrumb" aria-label="Localização">' +
    '<button class="bc-item" onclick="STJ.navegar(\'jurisprudencia\')">Jurisprudência</button>' +
    '<span class="bc-sep">›</span>' +
    '<span class="bc-item bc-cur">' + h(ac.titulo || ac.numero) + '</span>' +
    '</nav>';
};

/* ── HOME ─────────────────────────────────────────────────────────── */
STJ.vistas.home = async function () {
  var res = await Promise.all([STJ.api('listarLeis'), STJ.api('listarAcordaos')]);
  var leis = res[0] || [], acs = res[1] || [];
  var h = STJ.h, sd = STJ.stBadge, fd = STJ.fmtDate;

  var mkLei = function (l) {
    return '<div class="home-card" role="button" tabindex="0" onclick="STJ.navegar(\'lei-detalhe\',{currentLawId:\'' + h(l.id) + '\'})" onkeydown="if(event.key===\'Enter\')STJ.navegar(\'lei-detalhe\',{currentLawId:\'' + h(l.id) + '\'})">' +
      '<div class="home-card-top"><span class="badge b-red">' + h(l.area || 'Lei') + '</span>' + sd(l.estado) + '</div>' +
      '<div class="home-card-title">' + h(l.titulo) + '</div>' +
      '<div class="home-card-meta">' + h(l.numero) + ' · ' + fd(l.dataPublicacao) + '</div>' +
      '</div>';
  };
  var mkAc = function (a) {
    return '<div class="list-item" role="button" tabindex="0" onclick="STJ.navegar(\'acordao-detalhe\',{currentAcId:\'' + h(a.id) + '\'})" onkeydown="if(event.key===\'Enter\')STJ.navegar(\'acordao-detalhe\',{currentAcId:\'' + h(a.id) + '\'})">' +
      '<span class="badge b-gray" style="flex-shrink:0;margin-top:2px">' + h(a.tipo || 'STJ') + '</span>' +
      '<div class="list-item-body"><div class="list-item-title">' + h(a.titulo) + '</div>' +
      '<div class="list-item-meta">' + h(a.numero) + ' · ' + fd(a.data) + ' · ' + h(a.relator || '—') + '</div></div>' +
      '<span class="list-arrow">›</span></div>';
  };

  return '<div class="home-search-wrap">' +
    '<div class="home-search-label">Pesquise legislação, acórdãos, artigos…</div>' +
    '<div class="search-form home-search-form" role="search">' +
    '<input type="search" id="home-q" placeholder="ex.: Código Civil, arrendamento, Acórdão 123/2024…" onkeydown="if(event.key===\'Enter\')STJ.vistas._homeSearch()" aria-label="Campo de pesquisa">' +
    '<button onclick="STJ.vistas._homeSearch()">Pesquisar</button></div></div>' +

    '<div class="stats-row"><div class="stat-box"><div class="stat-n">' + leis.length + '</div><div class="stat-l">Diplomas</div></div>' +
    '<div class="stat-box"><div class="stat-n">' + acs.length + '</div><div class="stat-l">Acórdãos</div></div>' +
    '<div class="stat-box"><div class="stat-n">' + (leis.filter(function(l){return l.estado==='vigor';}).length) + '</div><div class="stat-l">Em vigor</div></div>' +
    '<div class="stat-box"><div class="stat-n">' + (leis.length + acs.length) + '</div><div class="stat-l">Documentos</div></div></div>' +

    '<div class="two-col">' +
    '<div><div class="section-title">Últimas Leis</div>' +
    '<div class="home-cards">' + (leis.slice(0,6).map(mkLei).join('') || '<div class="empty-state"><p>Nenhuma lei publicada.</p></div>') + '</div>' +
    '<div style="margin-top:.75rem;text-align:right"><button class="btn btn-outline btn-sm" onclick="STJ.navegar(\'legislacao\')">Ver toda a legislação →</button></div></div>' +
    '<div><div class="section-title">Últimos Acórdãos</div>' +
    '<div class="panel">' + (acs.slice(0,5).map(mkAc).join('') || '<div class="empty-state"><p>Nenhum acórdão publicado.</p></div>') + '</div>' +
    '<div style="margin-top:.75rem;text-align:right"><button class="btn btn-outline btn-sm" onclick="STJ.navegar(\'jurisprudencia\')">Ver jurisprudência →</button></div></div>' +
    '</div>';
};
STJ.vistas._homeSearch = function () {
  STJ.estado.searchQuery = (document.getElementById('home-q') || {}).value || '';
  STJ.navegar('pesquisa');
};

/* ── LISTA LEGISLAÇÃO ────────────────────────────────────────────── */
STJ.vistas.legislacaoLista = async function () {
  var leis = await STJ.api('listarLeis');
  var h = STJ.h, sd = STJ.stBadge, fd = STJ.fmtDate;
  var q    = (STJ.estado._legQ   || '').toLowerCase();
  var ord  = STJ.estado._legOrd  || 'data-desc';
  var fArea = STJ.estado._legArea || '';
  var fEst  = STJ.estado._legEst  || '';
  var sel   = STJ.estado._legSel || (STJ.estado._legSel = {});

  var areas   = [...new Set((leis||[]).map(function(l){return l.area||'';}).filter(Boolean))].sort();
  var estados = [...new Set((leis||[]).map(function(l){return l.estado||'';}).filter(Boolean))].sort();

  var filtradas = (leis||[]).filter(function(l){
    if (fArea && (l.area||'')!==fArea) return false;
    if (fEst  && (l.estado||'')!==fEst)  return false;
    if (q) { var hay=[l.titulo,l.numero,l.autor,l.area,l.ementa].join(' ').toLowerCase(); if(!hay.includes(q)) return false; }
    return true;
  }).sort(function(a,b){
    switch(ord){
      case 'titulo-asc':  return (a.titulo||'').localeCompare(b.titulo||'','pt');
      case 'titulo-desc': return (b.titulo||'').localeCompare(a.titulo||'','pt');
      case 'data-asc':    return (a.dataPublicacao||'')>(b.dataPublicacao||'')?1:-1;
      case 'data-desc':   return (a.dataPublicacao||'')<(b.dataPublicacao||'')?1:-1;
      case 'numero-asc':  return (a.numero||'').localeCompare(b.numero||'','pt');
      default: return 0;
    }
  });

  var optA = '<option value="">Todas as áreas</option>' + areas.map(function(a){return '<option value="'+h(a)+'"'+(fArea===a?' selected':'')+'>'+h(a)+'</option>';}).join('');
  var optE = '<option value="">Todos os estados</option>' + estados.map(function(e){return '<option value="'+h(e)+'"'+(fEst===e?' selected':'')+'>'+h(e)+'</option>';}).join('');
  var optO = [['data-desc','Mais recentes'],['data-asc','Mais antigas'],['titulo-asc','A→Z'],['titulo-desc','Z→A'],['numero-asc','Número']].map(function(o){return '<option value="'+o[0]+'"'+(ord===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('');

  var idsVis = filtradas.map(function(l){return l.id;});
  var nSel = idsVis.filter(function(id){return sel[id];}).length;

  var linhas = filtradas.map(function(l){
    var estadoK = l.estado || '';
    var dot = estadoK==='vigor'?'dot-green':estadoK==='revogada'?'dot-red':'dot-orange';
    return '<div class="lei-row" role="button" tabindex="0" onclick="STJ.navegar(\'lei-detalhe\',{currentLawId:\''+h(l.id)+'\'})" onkeydown="if(event.key===\'Enter\')STJ.navegar(\'lei-detalhe\',{currentLawId:\''+h(l.id)+'\'})">' +
      '<label class="lei-row-check" onclick="event.stopPropagation()"><input type="checkbox"'+(sel[l.id]?' checked':'')+' onchange="STJ.vistas._legToggleSel(\''+h(l.id)+'\',this.checked)"></label>' +
      '<span class="lei-row-area badge b-red">'+h(l.area||'Lei')+'</span>' +
      '<div class="lei-row-body">' +
        '<div class="lei-row-title">'+h(l.titulo)+'</div>' +
        '<div class="lei-row-meta"><span>'+h(l.numero)+'</span><span>'+fd(l.dataPublicacao)+'</span><span>'+h(l.autor||'—')+'</span></div>' +
      '</div>' +
      '<span class="status-dot '+dot+'" title="'+h(l.estado||'—')+'"></span>' +
      '</div>';
  }).join('') || '<div class="empty-state"><p>Nenhuma lei encontrada'+(q||fArea||fEst?' para os filtros aplicados':'')+'.</p></div>';

  return '<div class="list-toolbar">' +
    '<div class="section-title" style="margin:0">Legislação <span class="section-count">('+filtradas.length+' de '+(leis||[]).length+')</span></div>' +
    '<div class="list-filters">' +
      '<div class="filter-search"><input type="search" id="leg-q" value="'+h(STJ.estado._legQ||'')+'" placeholder="Pesquisar…" oninput="STJ.vistas._legFiltrar()" onkeydown="if(event.key===\'Enter\')STJ.vistas._legFiltrar()"><span class="filter-search-icon">⌕</span></div>' +
      '<select id="leg-area" onchange="STJ.vistas._legFiltrar()">'+optA+'</select>' +
      '<select id="leg-est" onchange="STJ.vistas._legFiltrar()">'+optE+'</select>' +
      '<select id="leg-ord" onchange="STJ.vistas._legFiltrar()">'+optO+'</select>' +
      (q||fArea||fEst?'<button class="btn btn-outline btn-sm" onclick="STJ.vistas._legLimpar()">✕ Limpar</button>':'') +
    '</div></div>' +
    '<div class="batch-bar">' +
      '<label><input type="checkbox"'+(nSel===idsVis.length&&idsVis.length>0?' checked':'')+' onchange="STJ.vistas._legToggleSelTodos(this.checked,[\''+idsVis.join("','")+'\'])"> Selecionar visíveis</label>' +
      '<span>'+(nSel?nSel+' selecionada(s)':'')+'</span>' +
      '<button class="btn btn-outline btn-sm"'+(nSel?'':' disabled')+' onclick="STJ.exportarPdfLote(\'lei\',Object.keys(STJ.estado._legSel||{}))">⬇ Exportar PDF</button>' +
      (nSel?'<button class="btn btn-outline btn-sm" onclick="STJ.estado._legSel={};STJ.render()">✕ Limpar</button>':'') +
    '</div>' +
    '<div class="lei-list">' + linhas + '</div>';
};
STJ.vistas._legToggleSel = function(id,checked){ var s=STJ.estado._legSel||(STJ.estado._legSel={}); if(checked)s[id]=true;else delete s[id]; STJ.render(); };
STJ.vistas._legToggleSelTodos = function(checked,ids){ var s=STJ.estado._legSel||(STJ.estado._legSel={}); (ids||[]).forEach(function(id){if(!id)return;if(checked)s[id]=true;else delete s[id];}); STJ.render(); };
STJ.vistas._legFiltrar = function(){ STJ.estado._legQ=(document.getElementById('leg-q')||{}).value||''; STJ.estado._legArea=(document.getElementById('leg-area')||{}).value||''; STJ.estado._legEst=(document.getElementById('leg-est')||{}).value||''; STJ.estado._legOrd=(document.getElementById('leg-ord')||{}).value||'data-desc'; STJ.render(); };
STJ.vistas._legLimpar = function(){ STJ.estado._legQ=''; STJ.estado._legArea=''; STJ.estado._legEst=''; STJ.estado._legOrd='data-desc'; STJ.render(); };

/* ── DETALHE LEI ─────────────────────────────────────────────────── */
STJ.vistas.leiDetalhe = async function () {
  var resp = await STJ.api('obterLei', { id: STJ.estado.currentLawId });
  if (!resp) return '<p>Lei não encontrada.</p>';
  var lei = resp.lei;
  var arts = (resp.artigos||[]).sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
  var h = STJ.h, fd = STJ.fmtDate, sd = STJ.stBadge;
  var artMap = STJ.vistas._buildArtMap(arts);

  // Estado de recolhimento (mapa grupoKey→bool)
  var colapsado = STJ.estado._docColapsado || (STJ.estado._docColapsado = {});

  /* ── TOC ─────────────────────────────────────────────────────── */
  var toc = '<div class="toc-search-wrap"><input class="toc-search" type="search" placeholder="Filtrar artigos…" oninput="STJ.vistas._tocFiltrar(this.value)" aria-label="Filtrar índice"></div>';
  var lgT='', lcT='', lsT='';
  arts.forEach(function(a,i){
    var gk=(a.grupoTipo||'')+(a.grupoNum||'');
    var ck=a.capNum||'', sk=a.secNum||'';
    if(gk&&gk!==lgT){ toc+='<div class="toc-nivel toc-nivel-grupo">'+h((a.grupoTipo||'')+' '+(a.grupoNum||'')+(a.grupoTit?' — '+a.grupoTit:''))+'</div>'; lgT=gk; lcT=''; lsT=''; }
    if(ck&&ck!==lcT){ toc+='<div class="toc-nivel toc-nivel-cap">Cap. '+h(a.capNum||'')+(a.capTit?' — '+h(a.capTit):'')+'</div>'; lcT=ck; lsT=''; }
    if(sk&&sk!==lsT){ toc+='<div class="toc-nivel toc-nivel-sec">Sec. '+h(a.secNum||'')+(a.secTit?' — '+h(a.secTit):'')+'</div>'; lsT=sk; }
    toc+='<div class="toc-art" data-idx="'+i+'" tabindex="0" role="button" onclick="STJ.vistas._irParaArtigo('+i+')" onkeydown="if(event.key===\'Enter\')STJ.vistas._irParaArtigo('+i+')">'+
      '<span class="toc-art-n">'+h((a.numero||'').replace(/^Artigo\s+/,'Art. '))+'</span>'+
      '<span class="toc-art-t">'+h(a.titulo||'')+'</span></div>';
  });
  if(!arts.length) toc+='<div style="padding:.75rem 1rem;font-size:12px;color:var(--muted)">Sem artigos</div>';

  /* ── Barra de ferramentas ─────────────────────────────────────── */
  var toolbar = '<div class="doc-toolbar" id="doc-toolbar">' +
    '<div class="doc-toolbar-left">' +
      '<div class="doc-search-wrap">' +
        '<input class="doc-search-input" id="doc-search-q" type="search" placeholder="Pesquisar no documento…" oninput="STJ.vistas._docSearch.run(this.value)" aria-label="Pesquisar no documento">' +
        '<button class="doc-toolbar-btn icon-btn" onclick="STJ.vistas._docSearch.prev()" title="Resultado anterior">↑</button>' +
        '<button class="doc-toolbar-btn icon-btn" onclick="STJ.vistas._docSearch.next()" title="Resultado seguinte">↓</button>' +
        '<span id="doc-search-info" class="doc-search-info"></span>' +
      '</div>' +
      '<div class="doc-goto-wrap">' +
        '<select id="doc-goto-sel" onchange="STJ.vistas._irParaArtigo(Number(this.value));this.value=\'\'" aria-label="Ir para artigo">' +
        '<option value="">Ir para artigo…</option>' +
        arts.map(function(a,i){ return '<option value="'+i+'">'+h(a.numero+(a.titulo?' — '+a.titulo:''))+'</option>'; }).join('') +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div class="doc-toolbar-right">' +
      '<button class="doc-toolbar-btn" onclick="STJ.vistas._expandirTudo(true)" title="Expandir tudo">⊞ Expandir</button>' +
      '<button class="doc-toolbar-btn" onclick="STJ.vistas._expandirTudo(false)" title="Recolher tudo">⊟ Recolher</button>' +
      '<button class="doc-toolbar-btn" onclick="STJ.vistas._modoLeitura()" id="btn-modo-leitura" title="Modo de leitura">◎ Leitura</button>' +
      '<button class="doc-toolbar-btn" onclick="STJ.copiarLigacao()" title="Copiar ligação">🔗</button>' +
      '<button class="doc-toolbar-btn" onclick="window.print()" title="Imprimir">🖨</button>' +
      '<button class="doc-toolbar-btn" onclick="STJ.exportarPdf(\'lei\',\''+h(lei.id)+'\')" title="Exportar PDF">⬇ PDF</button>' +
    '</div></div>';

  /* ── Metadados do diploma ─────────────────────────────────────── */
  var infoLateral = '<div class="doc-info-card">' +
    '<div class="dic-estado">' + sd(lei.estado) + '</div>' +
    '<div class="dic-title">' + h(lei.titulo) + '</div>' +
    '<div class="dic-ref">' + h(lei.numero||'') + '</div>' +
    '<dl class="dic-meta">' +
      (lei.dataPublicacao?'<dt>Data</dt><dd>'+fd(lei.dataPublicacao)+'</dd>':'') +
      (lei.publicacaoOficial?'<dt>Publicação</dt><dd>'+h(lei.publicacaoOficial)+'</dd>':'') +
      (lei.autor?'<dt>Órgão</dt><dd>'+h(lei.autor)+'</dd>':'') +
      (lei.area?'<dt>Área</dt><dd>'+h(lei.area)+'</dd>':'') +
      '<dt>Artigos</dt><dd>'+arts.length+'</dd>' +
    '</dl>' +
    (lei.ementa?'<div class="dic-ementa">'+h(lei.ementa)+'</div>':'') +
    '<div class="dic-actions">' +
      (STJ.estado.sessao?'<button class="btn btn-outline btn-sm" onclick="STJ.apiAuth(\'adicionarFavorito\',{tipo:\'Lei\',id:\''+h(lei.id)+'\'}).then(function(){STJ.toast(\'Adicionado aos favoritos.\')})">★ Favorito</button>':'') +
    '</div></div>';

  /* ── Corpo dos artigos ────────────────────────────────────────── */
  var corpo = '';
  var lgC='', lcC='', lsC='', lssC='';
  arts.forEach(function(a,i){
    var gk=(a.grupoTipo||'')+(a.grupoNum||'');
    var ck=a.capNum||'', sk=a.secNum||'', ssk=a.subSecNum||'';
    var gkKey='g_'+gk, ckKey='c_'+ck, skKey='s_'+sk;

    if(gk&&gk!==lgC){
      corpo+='<div class="banner-nivel banner-grupo" id="sec-'+h(gkKey)+'">' +
        '<div class="bn-toggle" onclick="STJ.vistas._toggleSec(\''+gkKey+'\')" title="Recolher/expandir">'+(colapsado[gkKey]?'▶':'▼')+'</div>' +
        '<div class="bn-content"><div class="bn-tipo">'+h(a.grupoTipo||'')+'</div><div class="bn-num">'+h(a.grupoNum||'')+'</div><div class="bn-tit">'+h(a.grupoTit||'')+'</div></div></div>';
      lgC=gk; lcC=''; lsC=''; lssC='';
    }
    if(ck&&ck!==lcC){
      corpo+='<div class="banner-nivel banner-cap" id="sec-'+h(ckKey)+'">' +
        '<div class="bn-toggle" onclick="STJ.vistas._toggleSec(\''+ckKey+'\')" title="Recolher/expandir">'+(colapsado[ckKey]?'▶':'▼')+'</div>' +
        '<div class="bn-content"><div class="bn-tipo">Capítulo</div><div class="bn-num">'+h(a.capNum||'')+'</div><div class="bn-tit">'+h(a.capTit||'')+'</div></div></div>';
      lcC=ck; lsC=''; lssC='';
    }
    if(sk&&sk!==lsC){
      corpo+='<div class="banner-nivel banner-sec" id="sec-'+h(skKey)+'">' +
        '<div class="bn-toggle" onclick="STJ.vistas._toggleSec(\''+skKey+'\')" title="Recolher/expandir">'+(colapsado[skKey]?'▶':'▼')+'</div>' +
        '<div class="bn-content"><div class="bn-tipo">Secção</div><div class="bn-num">'+h(a.secNum||'')+'</div><div class="bn-tit">'+h(a.secTit||'')+'</div></div></div>';
      lsC=sk; lssC='';
    }
    if(ssk&&ssk!==lssC){
      corpo+='<div class="banner-nivel banner-subsec"><div class="bn-content"><div class="bn-tipo">Subsecção</div><div class="bn-num">'+h(a.subSecNum||'')+'</div><div class="bn-tit">'+h(a.subSecTit||'')+'</div></div></div>';
      lssC=ssk;
    }

    // Determina se artigo está colapsado (herda do agrupador)
    var eColapsado = colapsado[gkKey]||colapsado[ckKey]||colapsado[skKey];

    var textoHiper = STJ.vistas._hiperrefs(a.texto||'', artMap);
    var hi=!!a.interpretacaoTexto, io=STJ.estado.openInterpArt===i;
    var citAberto=STJ.estado.openCitArt===i;
    var citCache=STJ.estado._citCache||{};
    var citEstado=citCache[a.id];

    var interpHTML='';
    if(hi&&io){
      interpHTML='<div class="interp-panel" role="region">'+
        '<div class="interp-panel-hd">⚖ Interpretação Oficial do STJ</div>'+
        (a.interpretacaoTexto?'<div class="i-sec"><div class="i-key">Texto interpretativo</div><div class="i-val">'+h(a.interpretacaoTexto)+'</div></div>':'')+
        (a.principios?'<div class="i-sec"><div class="i-key">Princípios</div><div class="i-val">'+h(a.principios)+'</div></div>':'')+
        (a.ratio?'<div class="i-sec"><div class="i-key">Ratio decidendi</div><div class="i-val">'+h(a.ratio)+'</div></div>':'')+
        (a.enquadramento?'<div class="i-sec"><div class="i-key">Enquadramento</div><div class="i-val">'+h(a.enquadramento)+'</div></div>':'')+
        '</div>';
    } else if(hi){
      interpHTML='<div class="interp-hint">📌 Este artigo possui interpretação jurisprudencial do STJ</div>';
    }

    var citHTML='';
    if(citAberto){
      if(citEstado==='loading'||citEstado===undefined){
        citHTML='<div class="cit-panel"><div class="spinner-line">A procurar acórdãos…</div></div>';
      } else if(!citEstado.length){
        citHTML='<div class="cit-panel"><div class="empty-state" style="padding:1rem"><p>Nenhum acórdão cita este artigo.</p></div></div>';
      } else {
        citHTML='<div class="cit-panel"><div class="cit-panel-hd">🔗 Acórdãos que citam este artigo ('+citEstado.length+')</div><div class="cit-list">'+
          citEstado.map(function(ac){return '<div class="cit-item" role="button" tabindex="0" onclick="STJ.navegar(\'acordao-detalhe\',{currentAcId:\''+h(ac.id)+'\'})" onkeydown="if(event.key===\'Enter\')STJ.navegar(\'acordao-detalhe\',{currentAcId:\''+h(ac.id)+'\'})"><span class="cit-item-num">'+h(ac.numero)+'</span><span class="cit-item-tit">'+h(ac.titulo||'')+'</span>'+sd(ac.estado)+'</div>';}).join('')+
          '</div></div>';
      }
    }

    // Navegação artigo anterior/seguinte
    var navArt='';
    if(i>0||i<arts.length-1){
      navArt='<div class="art-nav">'+
        (i>0?'<button class="art-nav-btn" onclick="STJ.vistas._irParaArtigo('+(i-1)+')" title="Artigo anterior">← '+h((arts[i-1].numero||'').replace(/^Artigo\s+/,''))+'</button>':'<span></span>')+
        (i<arts.length-1?'<button class="art-nav-btn" onclick="STJ.vistas._irParaArtigo('+(i+1)+')" title="Artigo seguinte">'+h((arts[i+1].numero||'').replace(/^Artigo\s+/,''))+' →</button>':'<span></span>')+
        '</div>';
    }

    corpo+='<div class="art-block'+(hi?' has-interp':'')+(eColapsado?' art-hidden':'')+'" id="art-'+i+'">' +
      '<div class="art-block-hd">' +
        '<div class="art-num-badge">'+h((a.numero||'').replace(/^Artigo\s+/,''))+'</div>' +
        '<div class="art-hd-center">' +
          (a.titulo?'<div class="art-titulo">'+h(a.titulo)+'</div>':'')+
          (a.hierarquia&&a.hierarquia.length?'<div class="art-hier">'+a.hierarquia.map(function(hh){return h(hh.rotulo+' '+hh.num);}).join(' › ')+'</div>':'')+
        '</div>' +
        '<div class="art-block-actions">' +
          (hi?'<button class="doc-toolbar-btn btn-sm" onclick="STJ.vistas._toggleInterp('+i+')" aria-expanded="'+io+'">'+(io?'▲ Fechar':'⚖ Interpretação')+'</button>':'') +
          '<button class="doc-toolbar-btn btn-sm" onclick="STJ.vistas._toggleCitacoes('+i+',\''+h(a.id)+'\')" aria-expanded="'+citAberto+'">'+(citAberto?'▲ Fechar':'🔗 Acórdãos')+'</button>' +
          '<button class="doc-toolbar-btn btn-sm" onclick="STJ.vistas._copiarArt('+i+',\''+h(a.numero)+'\')" title="Copiar ligação deste artigo">🔗</button>' +
        '</div>' +
      '</div>' +
      '<div class="art-block-body">' + (textoHiper || '<em class="no-text">Sem texto</em>') + '</div>' +
      interpHTML + citHTML + navArt +
      '</div>';
  });
  if(!arts.length) corpo='<div class="empty-state" style="padding:3rem"><p>Sem artigos. Use a importação na Área Reservada.</p></div>';

  STJ._docArts = arts;
  STJ._posRenderFn = STJ.vistas._initTocObserver;

  return STJ.vistas._breadcrumb(lei) +
    toolbar +
    '<div class="doc-layout">' +
      '<aside class="toc-panel" aria-label="Índice">' +
        '<div class="toc-panel-hd">Índice<span class="toc-count">'+arts.length+' artigos</span></div>' +
        toc +
      '</aside>' +
      '<div class="doc-main">' +
        infoLateral +
        '<div id="doc-body">' + corpo + '</div>' +
      '</div>' +
    '</div>';
};

STJ.vistas._copiarArt = function(i, numero) {
  var url = window.location.href.split('#')[0] + '#art-' + i;
  navigator.clipboard && navigator.clipboard.writeText(url).then(function(){ STJ.toast('Ligação copiada: ' + numero); });
};
STJ.vistas._toggleSec = function(chave){
  var c=STJ.estado._docColapsado||(STJ.estado._docColapsado={});
  c[chave]=!c[chave];
  // Aplica sem re-render completo
  var els=document.querySelectorAll('[data-sec="'+chave+'"]');
  els.forEach(function(el){el.classList.toggle('art-hidden',!!c[chave]);});
  // Toggle ícone
  var banner=document.getElementById('sec-'+chave);
  if(banner){var t=banner.querySelector('.bn-toggle');if(t)t.textContent=c[chave]?'▶':'▼';}
};
STJ.vistas._expandirTudo = function(expandir){
  STJ.estado._docColapsado={};
  if(!expandir){
    var keys=new Set();
    document.querySelectorAll('.art-block[id^="art-"]').forEach(function(){});
    document.querySelectorAll('.banner-nivel').forEach(function(el){
      var id=el.id; if(id&&id.startsWith('sec-'))keys.add(id.replace('sec-',''));
    });
    keys.forEach(function(k){STJ.estado._docColapsado[k]=true;});
  }
  document.querySelectorAll('.art-block').forEach(function(el){el.classList.toggle('art-hidden',!expandir);});
  document.querySelectorAll('.bn-toggle').forEach(function(el){el.textContent=expandir?'▼':'▶';});
};
STJ.vistas._modoLeitura = function(){
  document.body.classList.toggle('modo-leitura');
  var btn=document.getElementById('btn-modo-leitura');
  if(btn) btn.classList.toggle('active');
};
STJ.vistas._tocFiltrar = function(q){
  var lq=(q||'').toLowerCase();
  document.querySelectorAll('.toc-art').forEach(function(el){
    var txt=(el.textContent||'').toLowerCase();
    el.style.display=(!lq||txt.includes(lq))?'':'none';
  });
};
STJ.vistas._toggleInterp = function(i){
  STJ.estado.openInterpArt=STJ.estado.openInterpArt===i?null:i;
  STJ.render().then(function(){if(STJ.estado.openInterpArt!==null){var el=document.getElementById('art-'+i);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}});
};
STJ.vistas._toggleCitacoes = async function(i, artigoId){
  if(STJ.estado.openCitArt===i){STJ.estado.openCitArt=null;STJ.render();return;}
  STJ.estado.openCitArt=i;
  if(!STJ.estado._citCache)STJ.estado._citCache={};
  if(!(artigoId in STJ.estado._citCache)){
    STJ.estado._citCache[artigoId]='loading';STJ.render();
    var lista=[];try{lista=(await STJ.api('obterCitantesArtigo',{artigoId:artigoId}))||[];}catch(e){lista=[];}
    STJ.estado._citCache[artigoId]=lista;
  }
  STJ.render().then(function(){var el=document.getElementById('art-'+i);if(el)el.scrollIntoView({behavior:'smooth',block:'nearest'});});
};

/* ── LISTA JURISPRUDÊNCIA ────────────────────────────────────────── */
STJ.vistas.jurisprudenciaLista = async function () {
  var acs = await STJ.api('listarAcordaos');
  var h = STJ.h, sd = STJ.stBadge, fd = STJ.fmtDate;
  var q=    (STJ.estado._jurQ   ||'').toLowerCase();
  var ord=   STJ.estado._jurOrd  ||'data-desc';
  var fTipo= STJ.estado._jurTipo ||'';
  var fEst=  STJ.estado._jurEst  ||'';

  var tipos   = [...new Set((acs||[]).map(function(a){return a.tipo||'';}).filter(Boolean))].sort();
  var estados = [...new Set((acs||[]).map(function(a){return a.estado||'';}).filter(Boolean))].sort();

  var filtrados=(acs||[]).filter(function(a){
    if(fTipo&&(a.tipo||'')!==fTipo)return false;
    if(fEst &&(a.estado||'')!==fEst) return false;
    if(q){var hay=[a.titulo,a.numero,a.relator,a.tipo,a.sumario].join(' ').toLowerCase();if(!hay.includes(q))return false;}
    return true;
  }).sort(function(a,b){
    switch(ord){
      case 'titulo-asc':  return (a.titulo||'').localeCompare(b.titulo||'','pt');
      case 'titulo-desc': return (b.titulo||'').localeCompare(a.titulo||'','pt');
      case 'data-asc':    return (a.data||'')>(b.data||'')?1:-1;
      case 'data-desc':   return (a.data||'')<(b.data||'')?1:-1;
      case 'numero-asc':  return (a.numero||'').localeCompare(b.numero||'','pt');
      case 'relator-asc': return (a.relator||'').localeCompare(b.relator||'','pt');
      default: return 0;
    }
  });

  var optT='<option value="">Todos os tipos</option>'+tipos.map(function(t){return '<option value="'+h(t)+'"'+(fTipo===t?' selected':'')+'>'+h(t)+'</option>';}).join('');
  var optE='<option value="">Todos os estados</option>'+estados.map(function(e){return '<option value="'+h(e)+'"'+(fEst===e?' selected':'')+'>'+h(e)+'</option>';}).join('');
  var optO=[['data-desc','Mais recentes'],['data-asc','Mais antigos'],['titulo-asc','A→Z'],['numero-asc','Número'],['relator-asc','Relator']].map(function(o){return '<option value="'+o[0]+'"'+(ord===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('');

  var linhas=filtrados.map(function(a){
    var sumExc=(a.sumario||'').substring(0,160).replace(/\n/g,' ');
    return '<div class="ac-card" role="button" tabindex="0" onclick="STJ.navegar(\'acordao-detalhe\',{currentAcId:\''+h(a.id)+'\'})" onkeydown="if(event.key===\'Enter\')STJ.navegar(\'acordao-detalhe\',{currentAcId:\''+h(a.id)+'\'})">' +
      '<div class="ac-card-top"><span class="badge b-gray">'+h(a.tipo||'STJ')+'</span><span class="ac-card-num">'+h(a.numero)+'</span>'+sd(a.estado)+'</div>' +
      '<div class="ac-card-title">'+h(a.titulo)+'</div>' +
      (sumExc?'<div class="ac-card-sum">'+h(sumExc)+(a.sumario&&a.sumario.length>160?'…':'')+'</div>':'')+
      '<div class="ac-card-meta"><span>'+fd(a.data)+'</span><span>Rel. '+h(a.relator||'—')+'</span></div>' +
      '</div>';
  }).join('')||'<div class="empty-state"><p>Nenhum acórdão encontrado'+(q||fTipo||fEst?' para os filtros aplicados':'')+'.</p></div>';

  return '<div class="list-toolbar">' +
    '<div class="section-title" style="margin:0">Jurisprudência <span class="section-count">('+filtrados.length+' de '+(acs||[]).length+')</span></div>' +
    '<div class="list-filters">' +
      '<div class="filter-search"><input type="search" id="jur-q" value="'+h(STJ.estado._jurQ||'')+'" placeholder="Pesquisar…" oninput="STJ.vistas._jurFiltrar()" onkeydown="if(event.key===\'Enter\')STJ.vistas._jurFiltrar()"><span class="filter-search-icon">⌕</span></div>' +
      '<select id="jur-tipo" onchange="STJ.vistas._jurFiltrar()">'+optT+'</select>' +
      '<select id="jur-est" onchange="STJ.vistas._jurFiltrar()">'+optE+'</select>' +
      '<select id="jur-ord" onchange="STJ.vistas._jurFiltrar()">'+optO+'</select>' +
      (q||fTipo||fEst?'<button class="btn btn-outline btn-sm" onclick="STJ.vistas._jurLimpar()">✕ Limpar</button>':'') +
    '</div></div>' +
    '<div class="ac-grid">' + linhas + '</div>';
};
STJ.vistas._jurFiltrar=function(){STJ.estado._jurQ=(document.getElementById('jur-q')||{}).value||'';STJ.estado._jurTipo=(document.getElementById('jur-tipo')||{}).value||'';STJ.estado._jurEst=(document.getElementById('jur-est')||{}).value||'';STJ.estado._jurOrd=(document.getElementById('jur-ord')||{}).value||'data-desc';STJ.render();};
STJ.vistas._jurLimpar=function(){STJ.estado._jurQ='';STJ.estado._jurTipo='';STJ.estado._jurEst='';STJ.estado._jurOrd='data-desc';STJ.render();};

/* ── DETALHE ACÓRDÃO ─────────────────────────────────────────────── */
STJ.vistas.acordaoDetalhe = async function () {
  var ac = await STJ.api('obterAcordao', { id: STJ.estado.currentAcId });
  if (!ac) return '<p>Acórdão não encontrado.</p>';
  var h = STJ.h, sd = STJ.stBadge, fd = STJ.fmtDate, np = STJ.nl2p;

  var sec=function(id,titulo,txt,destaque){
    if(!txt)return'';
    return '<div class="ac-sec'+(destaque?' ac-sec-destaque':'')+'">'+
      '<div class="ac-sec-hd"><span>'+titulo+'</span></div>'+
      '<div class="ac-sec-body" id="'+id+'">'+np(txt)+'</div></div>';
  };

  var artTags=ac.artigosAplicados
    ?'<div class="art-tags-row"><span class="art-tags-label">Artigos aplicados:</span>'+
      String(ac.artigosAplicados).split(',').filter(Boolean).map(function(t){return '<span class="art-chip">'+h(t.trim())+'</span>';}).join('')+'</div>':'';

  var authBar=(ac.elaboradoPor||ac.revistoPor)
    ?'<div class="authorship-bar">'+(ac.elaboradoPor?'<div class="auth-item"><div class="k">Elaborado por</div><div class="v">'+h(ac.elaboradoPor)+'</div></div>':'')+(ac.revistoPor?'<div class="auth-item"><div class="k">Revisto por</div><div class="v">'+h(ac.revistoPor)+'</div></div>':'')+'</div>':'';

  return STJ.vistas._breadcrumbAc(ac) +
    '<div class="doc-card ac-doc-card">' +
      '<div class="ac-header">' +
        '<div>' +
          '<div class="doc-ref">'+h(ac.numero)+'</div>' +
          '<div class="doc-title">'+h(ac.titulo)+'</div>' +
          authBar +
        '</div>' +
        '<div class="ac-meta-grid">' +
          '<div class="ac-meta-item"><div class="k">Data</div><div class="v">'+fd(ac.data)+'</div></div>' +
          '<div class="ac-meta-item"><div class="k">Tribunal</div><div class="v">'+h(ac.tipo||'STJ')+'</div></div>' +
          '<div class="ac-meta-item"><div class="k">Estado</div><div class="v">'+sd(ac.estado)+'</div></div>' +
          '<div class="ac-meta-item"><div class="k">Relator</div><div class="v">'+h(ac.relator||'—')+'</div></div>' +
          '<div class="ac-meta-item"><div class="k">Juízes adjuntos</div><div class="v">'+h(ac.juizesAdjuntos||'—')+'</div></div>' +
          '<div class="ac-meta-item"><div class="k">Votação</div><div class="v">'+h(ac.votacao||'—')+'</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="doc-actions">' +
        '<button class="btn btn-outline btn-sm" onclick="STJ.exportarPdf(\'acordao\',\''+h(ac.id)+'\')">⬇ PDF</button>' +
        '<button class="btn btn-outline btn-sm" onclick="window.print()">🖨 Imprimir</button>' +
        '<button class="btn btn-outline btn-sm" onclick="STJ.copiarLigacao()">🔗 Copiar ligação</button>' +
        (STJ.estado.sessao?'<button class="btn btn-outline btn-sm" onclick="STJ.apiAuth(\'adicionarFavorito\',{tipo:\'Acordao\',id:\''+h(ac.id)+'\'}).then(function(){STJ.toast(\'Adicionado aos favoritos.\')})">★ Favorito</button>':'') +
      '</div>' +
    '</div>' +
    sec('ac-sumario','📋 Sumário',ac.sumario,true) +
    sec('ac-factos','Factos Provados',ac.factos,false) +
    sec('ac-questoes','Questões Jurídicas',ac.questoes,false) +
    sec('ac-fund','Fundamentação',ac.fundamentacao,false) +
    (ac.decisao?'<div class="ac-sec"><div class="ac-sec-hd"><span>Decisão</span></div><div class="ac-sec-body"><div class="decision-box">'+np(ac.decisao)+'</div>'+artTags+'</div></div>':'');
};

/* ── PESQUISA ─────────────────────────────────────────────────────── */
STJ.vistas.pesquisa = async function () {
  var q = STJ.estado.searchQuery || '';
  var f = STJ.estado.searchFilters || { tipo: 'todos' };
  var resultados_pesq = await Promise.all([
    q ? STJ.api('pesquisar', { query: q, filtros: f }) : Promise.resolve([]),
    STJ.estado.sessao ? STJ.apiAuth('listarPesquisasGuardadas') : Promise.resolve([])
  ]);
  var resultados = resultados_pesq[0] || [];
  var pesqGuardadas = resultados_pesq[1] || [];
  STJ._pesqGuardadasCache = pesqGuardadas;
  var h = STJ.h, sd = STJ.stBadge;

  var guardadas = pesqGuardadas.length
    ? '<div class="pesq-guardadas"><div class="pesq-guardadas-label">Pesquisas guardadas</div><div class="pesq-guardadas-chips">'+
        pesqGuardadas.map(function(p,i){return '<button class="btn btn-outline btn-sm" onclick="STJ.vistas._carregarPesquisaGuardada('+i+')">'+h(p.nome)+'</button>';}).join('')+
      '</div></div>' : '';

  var linhas = resultados.map(function(r){
    var fn = r.tipo==='Lei' ? 'STJ.navegar(\'lei-detalhe\',{currentLawId:\''+h(r.id)+'\'})'
      : r.tipo==='Acórdão' ? 'STJ.navegar(\'acordao-detalhe\',{currentAcId:\''+h(r.id)+'\'})'
      : r.leiId ? 'STJ.navegar(\'lei-detalhe\',{currentLawId:\''+h(r.leiId)+'\'})'  : '';
    return '<div class="result-card" role="button" tabindex="0" onclick="'+fn+'" onkeydown="if(event.key===\'Enter\'){'+fn+'}">' +
      '<div class="result-type">'+h(r.tipo)+'</div>' +
      '<div class="result-title">'+h(r.titulo)+'</div>' +
      '<div class="result-excerpt">'+h((r.excerto||'').substring(0,220))+'</div>' +
      '<div class="result-foot"><span>'+h(r.meta)+'</span>'+sd(r.estado)+'</div></div>';
  }).join('');

  return '<div class="section-title">Pesquisa Avançada</div>' +
    '<div class="pesq-panel">' + guardadas +
    '<div class="search-form" role="search">' +
    '<input type="search" id="sq" value="'+h(q)+'" placeholder="Pesquise legislação, acórdãos, artigos, texto…" onkeydown="if(event.key===\'Enter\')STJ.vistas._pesquisar()" aria-label="Pesquisa avançada">' +
    '<button onclick="STJ.vistas._pesquisar()">Pesquisar</button></div>' +
    '<div class="pesq-filtros">' +
    '<select id="ft" onchange="STJ.vistas._pesquisar()">' +
    '<option value="todos"'+(f.tipo==='todos'?' selected':'')+'>Todos</option>' +
    '<option value="leis"'+(f.tipo==='leis'?' selected':'')+'>Leis</option>' +
    '<option value="acordaos"'+(f.tipo==='acordaos'?' selected':'')+'>Acórdãos</option>' +
    '<option value="interp"'+(f.tipo==='interp'?' selected':'')+'>Interpretações</option>' +
    '</select>' +
    (STJ.estado.sessao&&q?'<button class="btn btn-outline btn-sm" onclick="STJ.vistas._guardarPesquisa()">★ Guardar</button>':'') +
    '</div></div>' +
    (q?'<div class="pesq-info"><strong>'+resultados.length+'</strong> resultado(s) para «<strong>'+h(q)+'</strong>»</div>':'') +
    (resultados.length ? linhas
      : q ? '<div class="empty-state panel" style="padding:2rem"><p>Sem resultados para «'+h(q)+'».</p></div>'
          : '<div class="empty-state panel" style="padding:2rem"><p>Introduza um termo de pesquisa.</p></div>');
};
STJ.vistas._pesquisar=function(){STJ.estado.searchQuery=STJ.g('sq');STJ.estado.searchFilters.tipo=STJ.gv('ft')||'todos';STJ.atualizarUrl&&STJ.atualizarUrl();STJ.render();};
STJ.vistas._carregarPesquisaGuardada=function(i){var p=(STJ._pesqGuardadasCache||[])[i];if(!p){STJ.toast('Não encontrada.');return;}STJ.estado.searchQuery=p.query;STJ.estado.searchFilters=p.filtros||{tipo:'todos'};STJ.atualizarUrl&&STJ.atualizarUrl();STJ.render();};
STJ.vistas._guardarPesquisa=async function(){var nome=await STJ.modalInput({titulo:'Guardar pesquisa',label:'Nome',placeholder:'ex.: Arrendamento urbano',textoConfirmar:'Guardar'});if(!nome)return;await STJ.apiAuth('guardarPesquisa',{nome:nome,query:STJ.estado.searchQuery,filtros:STJ.estado.searchFilters});STJ.toast('Pesquisa guardada.');STJ.render();};

/* ── PRIVACIDADE ─────────────────────────────────────────────────── */
STJ.vistas.privacidade = function () {
  return '<div class="section-title">Política de Privacidade (RGPD)</div>' +
    '<div class="panel"><div style="padding:1.5rem;font-size:13.5px;line-height:1.9;color:var(--dark)">' +
    '<p><strong>Responsável:</strong> Supremo Tribunal de Justiça.</p>' +
    '<p style="margin-top:.75rem"><strong>Dados recolhidos:</strong> nome de utilizador, nome e registo de atividade de utilizadores autenticados. Visitantes anónimos não têm dados registados.</p>' +
    '<p style="margin-top:.75rem"><strong>Finalidade:</strong> controlo de acesso e rastreabilidade das alterações.</p>' +
    '<p style="margin-top:.75rem"><strong>Base legal:</strong> interesse legítimo e consentimento.</p>' +
    '<p style="margin-top:.75rem"><strong>Prazo de conservação:</strong> registos de auditoria por 5 anos; dados de conta até revogação.</p>' +
    '<p style="margin-top:.75rem"><strong>Direitos:</strong> acesso, rectificação, apagamento e portabilidade. Contacte o administrador do sistema.</p>' +
    (STJ.estado.sessao?'<div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border-lt)"><button class="btn btn-danger" onclick="STJ.vistas._pedirEliminarConta()">Eliminar / anonimizar a minha conta</button></div>':'') +
    '</div></div>' +
    '<button class="btn btn-outline btn-sm" onclick="history.back()" style="margin-top:1rem">‹ Voltar</button>';
};
STJ.vistas._pedirEliminarConta=async function(){if(!confirm('Anonimizará permanentemente os seus dados. Confirma?'))return;await STJ.apiAuth('eliminarDadosUtilizador');STJ.guardarSessao(null);STJ.toast('Conta anonimizada.');STJ.navegar('home');};
