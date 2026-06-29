/**
 * ════════════════════════════════════════════════════════════════════
 *  js/core.js  (equivalente a Cliente_Core.html)
 * ════════════════════════════════════════════════════════════════════
 * MIGRAÇÃO GOOGLE APPS SCRIPT → NETLIFY:
 *   STJ.chamar() deixou de usar google.script.run e passa a usar
 *   fetch() contra /api (redirecionado pelo netlify.toml para a
 *   Netlify Function "api"). O envelope {ok, dados/erro} devolvido
 *   pelo servidor mantém-se idêntico, por isso STJ.api() e todo o
 *   resto do cliente continuam a funcionar sem alterações de lógica.
 * ════════════════════════════════════════════════════════════════════
 */
window.STJ = window.STJ || {};

/* ── Sessão em memória (SEGURANÇA) ───────────────────────────────────
   O token e o CSRF são guardados APENAS nesta variável em memória.
   sessionStorage (e localStorage) são acessíveis via JavaScript por
   qualquer script na página — incluindo código injetado por XSS — o
   que permitiria roubar o token e fazer chamadas autenticadas.
   Ao usar uma variável de módulo em vez de storage persistente:
     • o token nunca é serializável/acessível fora deste módulo;
     • um atacante com XSS não consegue extraí-lo para um servidor externo;
     • a sessão termina ao fechar/recarregar o separador (comportamento
       correto para um painel de administração com dados sensíveis).
   Tradeoff aceite: o utilizador tem de re-autenticar após cada refresh. */
STJ._sessaoMemoria = null;

STJ.estado = {
  vista: 'home',
  get sessao() { return STJ._sessaoMemoria; },
  set sessao(v) { STJ._sessaoMemoria = v; },
  adminTab: 'leis-list',
  currentLawId: null, currentAcId: null, openInterpArt: null,
  searchQuery: '', searchFilters: { tipo: 'todos' },
  importStep: 1, importParsed: null, importLeiId: null,
  _editId: null, _leiId: null
};

/* ── Comunicação com o servidor ─────────────────────────────────── */

/**
 * Envia {action, payload} para a Netlify Function "api" via fetch,
 * com timeout de 30 segundos. Substitui o wrapper de
 * google.script.run da versão Apps Script.
 */
STJ.chamar = function (nomeFuncao, payload) {
  return new Promise(function (resolve, reject) {
    var terminado = false;
    var controller = new AbortController();

    var timer = setTimeout(function () {
      if (!terminado) {
        terminado = true;
        controller.abort();
        reject(new Error('O servidor demorou demasiado a responder. Tente novamente.'));
      }
    }, 30000);

    fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: nomeFuncao, payload: payload || {} }),
      signal: controller.signal
    }).then(function (resp) {
      if (terminado) return;
      return resp.json();
    }).then(function (resultado) {
      if (terminado) return;
      terminado = true;
      clearTimeout(timer);
      resolve(resultado);
    }).catch(function (erro) {
      if (terminado) return;
      terminado = true;
      clearTimeout(timer);
      reject(erro);
    });
  });
};

/**
 * Chama uma ação do servidor e desembrulha o envelope {ok, dados/erro}.
 * Mantém a mesma defesa contra respostas null/undefined da versão
 * original (proteção contra timeouts ou falhas silenciosas).
 */
STJ.api = async function (nomeFuncao, payload) {
  try {
    var resp = await STJ.chamar(nomeFuncao, payload);

    if (resp === null || resp === undefined) {
      var msgNull = 'O servidor não devolveu uma resposta válida. Tente recarregar a página.';
      STJ.toast(msgNull);
      throw new Error(msgNull);
    }

    if (!resp.ok) {
      STJ.toast(resp.erro || 'Ocorreu um erro.');
      throw new Error(resp.erro || 'Erro desconhecido');
    }

    return resp.dados;
  } catch (e) {
    var msg = typeof e === 'string' ? e : (e.message || 'Erro de comunicação com o servidor.');
    if (!msg.includes('não devolveu') && !msg.includes('Ocorreu um erro')) {
      STJ.toast(msg);
    }
    throw e;
  }
};

/** Chamadas autenticadas incluem sempre token + csrf da sessão atual. */
STJ.apiAuth = function (nomeFuncao, payload) {
  var s = STJ.estado.sessao;
  var completo = Object.assign({ token: s ? s.token : null, csrf: s ? s.csrf : null }, payload || {});
  return STJ.api(nomeFuncao, completo);
};

STJ.guardarSessao = function (sessao) {
  STJ.estado.sessao = sessao;
  if (sessao) sessionStorage.setItem('atjl_sessao', JSON.stringify(sessao));
  else sessionStorage.removeItem('atjl_sessao');
  STJ.atualizarTopbar();
};

STJ.atualizarTopbar = function () {
  var el = document.getElementById('utilizador-info');
  var s = STJ.estado.sessao;
  if (s && s.utilizador) { el.style.display = 'inline'; el.textContent = s.utilizador.nome + ' (' + s.utilizador.role + ')'; }
  else { el.style.display = 'none'; el.textContent = ''; }
};

/* ── Navegação ──────────────────────────────────────────────────── */
STJ.navegar = async function (vista, extra) {
  STJ.estado.vista = vista; STJ.estado.openInterpArt = null;
  if (extra) Object.assign(STJ.estado, extra);
  document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.view === vista); });
  await STJ.render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/**
 * Renderiza a vista atual. Na vista 'admin', se ocorrer um erro
 * durante o render, redireciona para 'leis-list' em vez de mostrar a
 * mensagem de erro genérica.
 */
STJ.render = async function () {
  var m = document.getElementById('main');
  m.innerHTML = '<div class="spinner-line">A carregar…</div>';
  try {
    var html;
    switch (STJ.estado.vista) {
      case 'home':            html = await STJ.vistas.home(); break;
      case 'legislacao':      html = await STJ.vistas.legislacaoLista(); break;
      case 'lei-detalhe':     html = await STJ.vistas.leiDetalhe(); break;
      case 'jurisprudencia':  html = await STJ.vistas.jurisprudenciaLista(); break;
      case 'acordao-detalhe': html = await STJ.vistas.acordaoDetalhe(); break;
      case 'pesquisa':        html = await STJ.vistas.pesquisa(); break;
      case 'privacidade':     html = STJ.vistas.privacidade(); break;
      case 'admin':           html = await STJ.admin.render(); break;
      default:                html = await STJ.vistas.home();
    }
    m.innerHTML = html;
  } catch (e) {
    if (STJ.estado.vista === 'admin' && STJ.estado.adminTab !== 'leis-list') {
      STJ.estado.adminTab = 'leis-list';
      try {
        var htmlFallback = await STJ.admin.render();
        m.innerHTML = htmlFallback;
        return;
      } catch (e2) { /* se mesmo assim falhar, cai no erro genérico */ }
    }
    m.innerHTML = '<div class="empty-state"><p>Não foi possível carregar esta página. ' + STJ.h(e.message || '') + '</p></div>';
  }
};

STJ.iniciar = async function () {
  STJ.atualizarTopbar();
  try {
    var info = await STJ.api('infoPublica');
    STJ.estado.appInfo = info;
    document.getElementById('hdr-nome').textContent = info.portalNome;
    document.getElementById('hdr-trib').textContent = info.nomeInstituicao;
    document.getElementById('hdr-lema').textContent = info.lema;
    document.title = info.portalNome + ' — ' + info.nomeInstituicao;
  } catch (e) { /* mantém os valores estáticos do HTML em caso de falha */ }
  STJ.render();
};

/* ── Utilitários ────────────────────────────────────────────────── */
STJ.h = function (s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
STJ.nl2p = function (s) { if (!s) return ''; return String(s).split('\n').filter(function (l) { return l.trim(); }).map(function (l) { return '<p>' + STJ.h(l) + '</p>'; }).join(''); };
STJ.fmtDate = function (iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }); } catch (e) { return iso; } };
STJ.stBadge = function (s) {
  var m = { vigor: ['b-green', 'Em vigor'], alterada: ['b-orange', 'Alterada'], revogada: ['b-red', 'Revogada'], consolidada: ['b-blue', 'Consolidada'], transitado: ['b-blue', 'Transitado'], 'nao-transitado': ['b-orange', 'Não transitado'] };
  var par = m[s] || ['b-gray', s || '—'];
  return '<span class="badge ' + par[0] + '">' + par[1] + '</span>';
};
STJ.toast = function (msg) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(STJ._toastTimer);
  STJ._toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3800);
};
STJ.g = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
STJ.gv = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
STJ.copiarLigacao = function () { navigator.clipboard && navigator.clipboard.writeText(window.location.href).then(function () { STJ.toast('Ligação copiada.'); }); };

STJ.exportarPdf = async function (tipo, id) {
  STJ.toast('A gerar PDF…');
  var fn = tipo === 'lei' ? 'exportarLeiPdf' : 'exportarAcordaoPdf';
  var dados = await STJ.api(fn, { id: id });
  var link = document.createElement('a');
  link.href = 'data:application/pdf;base64,' + dados.base64;
  link.download = dados.nomeFicheiro;
  link.click();
};

STJ.vistas = {};
STJ.admin = {};
