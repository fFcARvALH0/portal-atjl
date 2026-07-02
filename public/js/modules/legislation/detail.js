/**
 * js/modules/legislation/detail.js
 * Vista pública: detalhe de uma lei com TOC lateral, pesquisa no documento,
 * hiperligações entre artigos, recolher/expandir e navegação artigo a artigo.
 */

import * as api from '../../services/api.js';
import { h, formatarData, badgeEstadoLei, nl2br } from '../../utils/format.js';

export async function renderLeiDetalhe(estado) {
  const resp = await api.obterLei(estado.currentLawId);
  if (!resp || !resp.lei) return '<p class="erro-pagina">Lei não encontrada.</p>';

  const lei  = resp.lei;
  const arts = (resp.artigos || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const artMap = _buildArtMap(arts);
  const colapsado = estado._docColapsado || (estado._docColapsado = {});

  /* ── TOC ─────────────────────────────────────────────────── */
  let toc = `<div class="toc-search-wrap">
    <input class="toc-search" type="search" placeholder="Filtrar artigos…"
      oninput="_tocFiltrar(this.value)" aria-label="Filtrar índice">
  </div>`;
  let lgT = '', lcT = '', lsT = '';
  arts.forEach((a, i) => {
    const gk = (a.grupoTipo || '') + (a.grupoNum || '');
    const ck = a.capNum || '', sk = a.secNum || '';
    if (gk && gk !== lgT) {
      toc += `<div class="toc-nivel toc-nivel-grupo">${h((a.grupoTipo || '') + ' ' + (a.grupoNum || '') + (a.grupoTit ? ' — ' + a.grupoTit : ''))}</div>`;
      lgT = gk; lcT = ''; lsT = '';
    }
    if (ck && ck !== lcT) {
      toc += `<div class="toc-nivel toc-nivel-cap">Cap. ${h(a.capNum || '')}${a.capTit ? ' — ' + h(a.capTit) : ''}</div>`;
      lcT = ck; lsT = '';
    }
    if (sk && sk !== lsT) {
      toc += `<div class="toc-nivel toc-nivel-sec">Sec. ${h(a.secNum || '')}${a.secTit ? ' — ' + h(a.secTit) : ''}</div>`;
      lsT = sk;
    }
    toc += `<div class="toc-art" data-idx="${i}" tabindex="0" role="button"
      onclick="_irParaArtigo(${i})"
      onkeydown="if(event.key==='Enter')_irParaArtigo(${i})">
      <span class="toc-art-n">${h((a.numero || '').replace(/^Artigo\s+/, 'Art. '))}</span>
      <span class="toc-art-t">${h(a.titulo || '')}</span>
    </div>`;
  });
  if (!arts.length) toc += '<div style="padding:.75rem 1rem;font-size:12px;color:var(--muted)">Sem artigos</div>';

  /* ── Barra de ferramentas ───────────────────────────────── */
  const toolbar = `<div class="doc-toolbar" id="doc-toolbar">
    <div class="doc-toolbar-left">
      <div class="doc-search-wrap">
        <input class="doc-search-input" id="doc-search-q" type="search"
          placeholder="Pesquisar no documento…"
          oninput="_docSearchRun(this.value)" aria-label="Pesquisar no documento">
        <button class="doc-toolbar-btn icon-btn" onclick="_docSearchPrev()" title="Anterior">↑</button>
        <button class="doc-toolbar-btn icon-btn" onclick="_docSearchNext()" title="Seguinte">↓</button>
        <span id="doc-search-info" class="doc-search-info"></span>
      </div>
      <div class="doc-goto-wrap">
        <select id="doc-goto-sel"
          onchange="_irParaArtigo(Number(this.value));this.value=''"
          aria-label="Ir para artigo">
          <option value="">Ir para artigo…</option>
          ${arts.map((a, i) => `<option value="${i}">${h(a.numero + (a.titulo ? ' — ' + a.titulo : ''))}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="doc-toolbar-right">
      <button class="doc-toolbar-btn" onclick="_expandirTudo(true)"  title="Expandir tudo">⊞ Expandir</button>
      <button class="doc-toolbar-btn" onclick="_expandirTudo(false)" title="Recolher tudo">⊟ Recolher</button>
      <button class="doc-toolbar-btn" id="btn-modo-leitura" onclick="_modoLeitura()" title="Modo leitura">◎ Leitura</button>
      <button class="doc-toolbar-btn" onclick="STJ.copiarLigacao()" title="Copiar ligação">🔗</button>
      <button class="doc-toolbar-btn" onclick="window.print()" title="Imprimir">🖨</button>
      <button class="doc-toolbar-btn" onclick="STJ.exportarPdf('lei','${h(lei.id)}')" title="PDF">⬇ PDF</button>
    </div>
  </div>`;

  /* ── Metadados ──────────────────────────────────────────── */
  const infoLateral = `<div class="doc-info-card">
    <div class="dic-estado">${badgeEstadoLei(lei.estado)}</div>
    <div class="dic-title">${h(lei.titulo)}</div>
    <div class="dic-ref">${h(lei.numero || '')}</div>
    <dl class="dic-meta">
      ${lei.dataPublicacao ? `<dt>Data</dt><dd>${formatarData(lei.dataPublicacao)}</dd>` : ''}
      ${lei.publicacaoOficial ? `<dt>Publicação</dt><dd>${h(lei.publicacaoOficial)}</dd>` : ''}
      ${lei.autor ? `<dt>Órgão</dt><dd>${h(lei.autor)}</dd>` : ''}
      ${lei.area ? `<dt>Área</dt><dd>${h(lei.area)}</dd>` : ''}
      <dt>Artigos</dt><dd>${arts.length}</dd>
    </dl>
    ${lei.ementa ? `<div class="dic-ementa">${h(lei.ementa)}</div>` : ''}
    <div class="dic-actions">
      ${estado.sessao ? `<button class="btn btn-outline btn-sm"
        onclick="STJ.apiAuth('adicionarFavorito',{tipo:'Lei',id:'${h(lei.id)}'}).then(()=>STJ.toast('Adicionado aos favoritos.'))">
        ★ Favorito</button>` : ''}
    </div>
  </div>`;

  /* ── Corpo dos artigos ──────────────────────────────────── */
  let corpo = '';
  let lgC = '', lcC = '', lsC = '', lssC = '';
  arts.forEach((a, i) => {
    const gk = (a.grupoTipo || '') + (a.grupoNum || '');
    const ck = a.capNum || '', sk = a.secNum || '', ssk = a.subSecNum || '';
    const gkKey = 'g_' + gk, ckKey = 'c_' + ck, skKey = 's_' + sk;

    if (gk && gk !== lgC) {
      corpo += `<div class="banner-nivel banner-grupo" id="sec-${h(gkKey)}">
        <div class="bn-toggle" onclick="_toggleSec('${gkKey}')" title="Recolher/expandir">${colapsado[gkKey] ? '▶' : '▼'}</div>
        <div class="bn-content">
          <div class="bn-tipo">${h(a.grupoTipo || '')}</div>
          <div class="bn-num">${h(a.grupoNum || '')}</div>
          <div class="bn-tit">${h(a.grupoTit || '')}</div>
        </div></div>`;
      lgC = gk; lcC = ''; lsC = ''; lssC = '';
    }
    if (ck && ck !== lcC) {
      corpo += `<div class="banner-nivel banner-cap" id="sec-${h(ckKey)}">
        <div class="bn-toggle" onclick="_toggleSec('${ckKey}')">${colapsado[ckKey] ? '▶' : '▼'}</div>
        <div class="bn-content">
          <div class="bn-tipo">Capítulo</div>
          <div class="bn-num">${h(a.capNum || '')}</div>
          <div class="bn-tit">${h(a.capTit || '')}</div>
        </div></div>`;
      lcC = ck; lsC = ''; lssC = '';
    }
    if (sk && sk !== lsC) {
      corpo += `<div class="banner-nivel banner-sec" id="sec-${h(skKey)}">
        <div class="bn-toggle" onclick="_toggleSec('${skKey}')">${colapsado[skKey] ? '▶' : '▼'}</div>
        <div class="bn-content">
          <div class="bn-tipo">Secção</div>
          <div class="bn-num">${h(a.secNum || '')}</div>
          <div class="bn-tit">${h(a.secTit || '')}</div>
        </div></div>`;
      lsC = sk; lssC = '';
    }
    if (ssk && ssk !== lssC) {
      corpo += `<div class="banner-nivel banner-subsec">
        <div class="bn-content">
          <div class="bn-tipo">Subsecção</div>
          <div class="bn-num">${h(a.subSecNum || '')}</div>
          <div class="bn-tit">${h(a.subSecTit || '')}</div>
        </div></div>`;
      lssC = ssk;
    }

    const eColapsado = colapsado[gkKey] || colapsado[ckKey] || colapsado[skKey];
    const textoHiper = _hiperrefs(a.texto || '', artMap);
    const hi = !!a.interpretacaoTexto;
    const io = estado.openInterpArt === i;
    const citAberto = estado.openCitArt === i;
    const citCache = estado._citCache || {};
    const citEstado = citCache[a.id];

    let interpHTML = '';
    if (hi && io) {
      interpHTML = `<div class="interp-panel" role="region">
        <div class="interp-panel-hd">⚖ Interpretação Oficial do STJ</div>
        ${a.interpretacaoTexto ? `<div class="i-sec"><div class="i-key">Texto interpretativo</div><div class="i-val">${h(a.interpretacaoTexto)}</div></div>` : ''}
        ${a.principios ? `<div class="i-sec"><div class="i-key">Princípios</div><div class="i-val">${h(a.principios)}</div></div>` : ''}
        ${a.ratio ? `<div class="i-sec"><div class="i-key">Ratio decidendi</div><div class="i-val">${h(a.ratio)}</div></div>` : ''}
        ${a.enquadramento ? `<div class="i-sec"><div class="i-key">Enquadramento</div><div class="i-val">${h(a.enquadramento)}</div></div>` : ''}
      </div>`;
    } else if (hi) {
      interpHTML = '<div class="interp-hint">📌 Este artigo possui interpretação jurisprudencial do STJ</div>';
    }

    let citHTML = '';
    if (citAberto) {
      if (!citEstado || citEstado === 'loading') {
        citHTML = '<div class="cit-panel"><div class="spinner-line">A procurar acórdãos…</div></div>';
      } else if (!citEstado.length) {
        citHTML = '<div class="cit-panel"><div class="empty-state" style="padding:1rem"><p>Nenhum acórdão cita este artigo.</p></div></div>';
      } else {
        citHTML = `<div class="cit-panel">
          <div class="cit-panel-hd">🔗 Acórdãos que citam este artigo (${citEstado.length})</div>
          <div class="cit-list">${citEstado.map((ac) =>
            `<div class="cit-item" role="button" tabindex="0"
              onclick="STJ.navegar('acordao-detalhe',{currentAcId:'${h(ac.id)}'})"
              onkeydown="if(event.key==='Enter')STJ.navegar('acordao-detalhe',{currentAcId:'${h(ac.id)}'})">
              <span class="cit-item-num">${h(ac.numero)}</span>
              <span class="cit-item-tit">${h(ac.titulo || '')}</span>
              ${badgeEstadoLei(ac.estado)}
            </div>`).join('')}
          </div>
        </div>`;
      }
    }

    const navArt = (i > 0 || i < arts.length - 1) ? `<div class="art-nav">
      ${i > 0 ? `<button class="art-nav-btn" onclick="_irParaArtigo(${i - 1})" title="Artigo anterior">← ${h((arts[i - 1].numero || '').replace(/^Artigo\s+/, ''))}</button>` : '<span></span>'}
      ${i < arts.length - 1 ? `<button class="art-nav-btn" onclick="_irParaArtigo(${i + 1})" title="Seguinte">${h((arts[i + 1].numero || '').replace(/^Artigo\s+/, ''))} →</button>` : '<span></span>'}
    </div>` : '';

    corpo += `<div class="art-block${hi ? ' has-interp' : ''}${eColapsado ? ' art-hidden' : ''}" id="art-${i}">
      <div class="art-block-hd">
        <div class="art-num-badge">${h((a.numero || '').replace(/^Artigo\s+/, ''))}</div>
        <div class="art-hd-center">
          ${a.titulo ? `<div class="art-titulo">${h(a.titulo)}</div>` : ''}
        </div>
        <div class="art-block-actions">
          ${hi ? `<button class="doc-toolbar-btn btn-sm" onclick="_toggleInterp(${i})" aria-expanded="${io}">${io ? '▲ Fechar' : '⚖ Interpretação'}</button>` : ''}
          <button class="doc-toolbar-btn btn-sm" onclick="_toggleCitacoes(${i},'${h(a.id)}')" aria-expanded="${citAberto}">${citAberto ? '▲ Fechar' : '🔗 Acórdãos'}</button>
          <button class="doc-toolbar-btn btn-sm" onclick="_copiarArt(${i},'${h(a.numero)}')" title="Copiar ligação">🔗</button>
        </div>
      </div>
      <div class="art-block-body">${textoHiper || '<em class="no-text">Sem texto</em>'}</div>
      ${interpHTML}${citHTML}${navArt}
    </div>`;
  });

  if (!arts.length) corpo = '<div class="empty-state" style="padding:3rem"><p>Sem artigos. Use a importação na Área Reservada.</p></div>';

  // Sinalizar IntersectionObserver pós-render
  estado._posRenderFn = _initTocObserver;

  return `<nav class="breadcrumb" aria-label="Localização">
    <button class="bc-item" onclick="STJ.navegar('legislacao')">Legislação</button>
    <span class="bc-sep">›</span>
    <span class="bc-item bc-cur">${h(lei.titulo)}</span>
  </nav>
  ${toolbar}
  <div class="doc-layout">
    <aside class="toc-panel" aria-label="Índice">
      <div class="toc-panel-hd">Índice<span class="toc-count">${arts.length} artigos</span></div>
      ${toc}
    </aside>
    <div class="doc-main">
      ${infoLateral}
      <div id="doc-body">${corpo}</div>
    </div>
  </div>`;
}

/* ── Helpers internos ────────────────────────────────────────────── */
function _buildArtMap(arts) {
  const m = {};
  arts.forEach((a, i) => {
    const n = (a.numero || '').toLowerCase().replace(/\s+/g, ' ').trim();
    m[n] = i;
    const curta = n.replace(/^artigo\s+/, 'art. ');
    if (curta !== n) m[curta] = i;
  });
  return m;
}

function _hiperrefs(texto, artMap) {
  if (!texto || !artMap) return h(texto);
  return h(texto).replace(
    /\b(n\.º\s+\d+\s+do\s+)?[Aa]rtigo\s+(\d+\.?[ºo]?(?:-[A-Z])?|[IVXLCDM]+\.?[ºo]?|[ÚU]nico)/g,
    (match) => {
      const limpo = match.trim().replace(/^n\.º\s+\d+\s+do\s+/i, '').trim();
      const idx = artMap[limpo.toLowerCase().replace(/\s+/g, ' ')];
      if (idx === undefined) return h(match);
      return `<a class="art-ref-link" href="#art-${idx}" onclick="_irParaArtigo(${idx});return false">${h(match)}</a>`;
    }
  );
}

function _initTocObserver() {
  if (!('IntersectionObserver' in window)) return;
  const tocItems  = document.querySelectorAll('.toc-art[data-idx]');
  const artBlocks = document.querySelectorAll('.art-block[id^="art-"]');
  if (!tocItems.length || !artBlocks.length) return;
  let ativo = null;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const idx = e.target.id.replace('art-', '');
      if (ativo === idx) return;
      ativo = idx;
      tocItems.forEach((t) => {
        const a = t.getAttribute('data-idx') === idx;
        t.classList.toggle('active', a);
        if (a) t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
  }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
  artBlocks.forEach((el) => obs.observe(el));
}

/* ── Pesquisa no documento ──────────────────────────────────────── */
const _docSearch = { query: '', hits: [], cur: -1 };

window._docSearchRun = function (q) {
  _docSearch.query = (q || '').trim();
  _docSearch.hits  = [];
  _docSearch.cur   = -1;
  document.querySelectorAll('mark.doc-hit').forEach((m) => { m.outerHTML = m.textContent; });
  if (!_docSearch.query) { _docSearchInfo(); return; }
  const re    = new RegExp(_docSearch.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const scope = document.getElementById('doc-body');
  if (!scope) return;
  (function walk(node) {
    if (node.nodeType === 3) {
      const val = node.textContent;
      if (!re.test(val)) return;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = re.exec(val)) !== null) {
        frag.appendChild(document.createTextNode(val.slice(last, m.index)));
        const mk = document.createElement('mark');
        mk.className = 'doc-hit'; mk.textContent = m[0];
        frag.appendChild(mk); last = re.lastIndex;
      }
      frag.appendChild(document.createTextNode(val.slice(last)));
      node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === 1 && !['SCRIPT', 'STYLE', 'BUTTON', 'INPUT'].includes(node.tagName)) {
      Array.from(node.childNodes).forEach(walk);
    }
  })(scope);
  _docSearch.hits = Array.from(scope.querySelectorAll('mark.doc-hit'));
  if (_docSearch.hits.length) { _docSearch.cur = 0; _docSearchGoto(0); }
  _docSearchInfo();
};
window._docSearchNext = function () { if (!_docSearch.hits.length) return; _docSearch.cur = (_docSearch.cur + 1) % _docSearch.hits.length; _docSearchGoto(_docSearch.cur); _docSearchInfo(); };
window._docSearchPrev = function () { if (!_docSearch.hits.length) return; _docSearch.cur = (_docSearch.cur - 1 + _docSearch.hits.length) % _docSearch.hits.length; _docSearchGoto(_docSearch.cur); _docSearchInfo(); };
function _docSearchGoto(i) { _docSearch.hits.forEach((m, j) => m.classList.toggle('doc-hit-cur', j === i)); const el = _docSearch.hits[i]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
function _docSearchInfo() { const el = document.getElementById('doc-search-info'); if (!el) return; if (!_docSearch.query) { el.textContent = ''; return; } el.textContent = _docSearch.hits.length ? `${_docSearch.cur + 1} / ${_docSearch.hits.length}` : 'Sem resultados'; }

/* ── Handlers inline ────────────────────────────────────────────── */
window._irParaArtigo = function (idx) {
  STJ.estado._docFocusArt = idx;
  const el = document.getElementById('art-' + idx);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.remove('art-flash'); void el.offsetWidth; el.classList.add('art-flash');
};
window._tocFiltrar = function (q) {
  const lq = (q || '').toLowerCase();
  document.querySelectorAll('.toc-art').forEach((el) => {
    el.style.display = (!lq || (el.textContent || '').toLowerCase().includes(lq)) ? '' : 'none';
  });
};
window._toggleSec = function (chave) {
  const c = STJ.estado._docColapsado || (STJ.estado._docColapsado = {});
  c[chave] = !c[chave];
  document.querySelectorAll(`[data-sec="${chave}"]`).forEach((el) => el.classList.toggle('art-hidden', !!c[chave]));
  const banner = document.getElementById('sec-' + chave);
  if (banner) { const t = banner.querySelector('.bn-toggle'); if (t) t.textContent = c[chave] ? '▶' : '▼'; }
};
window._expandirTudo = function (expandir) {
  STJ.estado._docColapsado = {};
  if (!expandir) {
    document.querySelectorAll('.banner-nivel').forEach((el) => {
      const id = el.id; if (id && id.startsWith('sec-')) STJ.estado._docColapsado[id.replace('sec-', '')] = true;
    });
  }
  document.querySelectorAll('.art-block').forEach((el) => el.classList.toggle('art-hidden', !expandir));
  document.querySelectorAll('.bn-toggle').forEach((el) => { el.textContent = expandir ? '▼' : '▶'; });
};
window._modoLeitura = function () {
  document.body.classList.toggle('modo-leitura');
  const btn = document.getElementById('btn-modo-leitura');
  if (btn) btn.classList.toggle('active');
};
window._copiarArt = function (i, numero) {
  const url = window.location.href.split('#')[0] + '#art-' + i;
  navigator.clipboard && navigator.clipboard.writeText(url).then(() => STJ.toast('Ligação copiada: ' + numero));
};
window._toggleInterp = function (i) {
  STJ.estado.openInterpArt = STJ.estado.openInterpArt === i ? null : i;
  STJ.render().then(() => { if (STJ.estado.openInterpArt !== null) { const el = document.getElementById('art-' + i); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
};
window._toggleCitacoes = async function (i, artigoId) {
  if (STJ.estado.openCitArt === i) { STJ.estado.openCitArt = null; STJ.render(); return; }
  STJ.estado.openCitArt = i;
  if (!STJ.estado._citCache) STJ.estado._citCache = {};
  if (!(artigoId in STJ.estado._citCache)) {
    STJ.estado._citCache[artigoId] = 'loading'; STJ.render();
    let lista = [];
    try { lista = (await STJ.api('obterCitantesArtigo', { artigoId })) || []; } catch { lista = []; }
    STJ.estado._citCache[artigoId] = lista;
  }
  STJ.render().then(() => { const el = document.getElementById('art-' + i); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
};
