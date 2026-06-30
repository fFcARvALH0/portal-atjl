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
  openCitArt: null, _citCache: {},
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
  STJ.estado.vista = vista; STJ.estado.openInterpArt = null; STJ.estado.openCitArt = null;
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

/* ── Diff de texto (word-level, LCS) ──────────────────────────────────
   Algoritmo simples de maior subsequência comum sobre tokens
   (palavras + espaços/pontuação preservados), usado para gerar a
   comparação visual lado-a-lado entre versões de uma entidade. Não
   depende de bibliotecas externas — mantém o CSP do projeto intacto. */
STJ._diffTokenizar = function (s) {
  return String(s == null ? '' : s).match(/\s+|[^\s]+/g) || [];
};

/** Devolve um array de {tipo: 'igual'|'add'|'rem', valor} a partir de duas strings. */
STJ.diffPalavras = function (antigo, novo) {
  var a = STJ._diffTokenizar(antigo);
  var b = STJ._diffTokenizar(novo);
  var n = a.length, m = b.length;
  // Tabela de LCS (limitada — textos de artigos são curtos o suficiente).
  var dp = new Array(n + 1);
  for (var i = 0; i <= n; i++) dp[i] = new Array(m + 1).fill(0);
  for (i = n - 1; i >= 0; i--) {
    for (var j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  var resultado = [];
  i = 0; j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { resultado.push({ tipo: 'igual', valor: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { resultado.push({ tipo: 'rem', valor: a[i] }); i++; }
    else { resultado.push({ tipo: 'add', valor: b[j] }); j++; }
  }
  while (i < n) { resultado.push({ tipo: 'rem', valor: a[i] }); i++; }
  while (j < m) { resultado.push({ tipo: 'add', valor: b[j] }); j++; }
  return resultado;
};

/** Marca apenas as remoções (para a coluna "antes") ou adições (coluna "depois"). */
STJ._diffColuna = function (partes, ladoAntigo) {
  var h = STJ.h;
  return partes.filter(function (p) { return p.tipo === 'igual' || (ladoAntigo ? p.tipo === 'rem' : p.tipo === 'add'); })
    .map(function (p) {
      if (p.tipo === 'igual') return h(p.valor);
      var cls = p.tipo === 'rem' ? 'diff-rem' : 'diff-add';
      return '<mark class="' + cls + '">' + h(p.valor) + '</mark>';
    }).join('');
};

/** Constrói o HTML de comparação lado-a-lado para um conjunto de campos de duas versões. */
STJ.renderDiffCampos = function (campos, snapAntigo, snapNovo) {
  var h = STJ.h;
  return campos.map(function (c) {
    var valAntigo = (snapAntigo && snapAntigo[c.chave]) || '';
    var valNovo = (snapNovo && snapNovo[c.chave]) || '';
    if (valAntigo === valNovo) {
      return '<div class="diff-campo"><div class="diff-campo-label">' + h(c.label) + '</div>' +
        '<div class="diff-igual">' + (h(valNovo) || '<em>(vazio)</em>') + '</div></div>';
    }
    var partes = STJ.diffPalavras(valAntigo, valNovo);
    return '<div class="diff-campo"><div class="diff-campo-label">' + h(c.label) + '</div>' +
      '<div class="diff-grid"><div class="diff-col diff-col-old"><div class="diff-col-hd">Antes</div><div class="diff-col-body">' + (STJ._diffColuna(partes, true) || '<em>(vazio)</em>') + '</div></div>' +
      '<div class="diff-col diff-col-new"><div class="diff-col-hd">Depois</div><div class="diff-col-body">' + (STJ._diffColuna(partes, false) || '<em>(vazio)</em>') + '</div></div></div></div>';
  }).join('');
};

/* ── Painel de Histórico de Versões (com diff visual) ─────────────────
   Uso: STJ.abrirHistoricoVersoes({ tipo: 'Artigo', id, campos, onRestaurado })
   campos: [{chave: 'texto', label: 'Texto do Artigo'}, ...] — define
   que campos do snapshot entram na comparação. */
STJ.abrirHistoricoVersoes = async function (opcoes) {
  var h = STJ.h;
  var tipo = opcoes.tipo, id = opcoes.id, campos = opcoes.campos || [];
  var overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.className = 'stj-hist-overlay';
  overlay.innerHTML = '<div class="stj-hist-box"><div class="stj-hist-hd"><span>📜 Histórico de Versões</span><button class="btn btn-outline btn-sm" id="stj-hist-fechar">Fechar</button></div><div class="stj-hist-body"><div class="spinner-line">A carregar histórico…</div></div></div>';
  document.body.appendChild(overlay);

  var fechar = function () { if (document.body.contains(overlay)) document.body.removeChild(overlay); };
  document.getElementById('stj-hist-fechar').addEventListener('click', fechar);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) fechar(); });

  var body = overlay.querySelector('.stj-hist-body');

  var versoes;
  try {
    versoes = await STJ.apiAuth('listarVersoes', { tipo: tipo, id: id });
  } catch (e) {
    body.innerHTML = '<div class="empty-state"><p>Não foi possível carregar o histórico.</p></div>';
    return;
  }

  if (!versoes || !versoes.length) {
    body.innerHTML = '<div class="empty-state"><p>Sem versões anteriores registadas para esta entidade.</p></div>';
    return;
  }

  // Estado local: índices das duas versões a comparar (0 = mais recente).
  var selAntigo = versoes.length > 1 ? 1 : 0;
  var selNovo = 0;

  var optsVersao = function (selecionado) {
    return versoes.map(function (v, idx) {
      return '<option value="' + idx + '"' + (idx === selecionado ? ' selected' : '') + '>' +
        STJ.fmtDate(v.timestamp) + ' — ' + h(v.utilizador) + '</option>';
    }).join('');
  };

  var redesenhar = function () {
    var vAntigo = versoes[selAntigo], vNovo = versoes[selNovo];
    var snapAntigo = vAntigo ? vAntigo.snapshot : null;
    var snapNovo = vNovo ? vNovo.snapshot : null;
    var sessao = STJ.estado.sessao;
    var podeRestaurar = !!(sessao && sessao.utilizador && sessao.utilizador.role === 'administrador');

    body.innerHTML =
      '<div class="diff-toolbar">' +
      '<div class="diff-sel"><label>Comparar (de)</label><select id="stj-hist-de">' + optsVersao(selAntigo) + '</select></div>' +
      '<div class="diff-sel"><label>Com (para)</label><select id="stj-hist-para">' + optsVersao(selNovo) + '</select></div>' +
      (podeRestaurar ? '<button class="btn btn-red btn-sm" id="stj-hist-restaurar" ' + (vAntigo ? '' : 'disabled') + '>↩ Restaurar versão "De"</button>' : '') +
      '</div>' +
      (snapAntigo && snapNovo ? STJ.renderDiffCampos(campos, snapAntigo, snapNovo) : '<div class="empty-state"><p>Snapshot indisponível ou corrompido para uma das versões selecionadas.</p></div>') +
      '<div class="diff-legenda"><span><mark class="diff-rem">texto</mark> removido</span><span><mark class="diff-add">texto</mark> adicionado</span></div>';

    document.getElementById('stj-hist-de').addEventListener('change', function (e) { selAntigo = Number(e.target.value); redesenhar(); });
    document.getElementById('stj-hist-para').addEventListener('change', function (e) { selNovo = Number(e.target.value); redesenhar(); });
    var btnRestaurar = document.getElementById('stj-hist-restaurar');
    if (btnRestaurar) {
      btnRestaurar.addEventListener('click', async function () {
        if (!vAntigo) return;
        if (!await STJ.modalConfirm({
          titulo: 'Restaurar Versão',
          mensagem: 'Tem a certeza que quer restaurar a versão de ' + STJ.fmtDate(vAntigo.timestamp) + '? O estado atual será substituído (mas fica também registado no histórico).',
          textoConfirmar: 'Restaurar'
        })) return;
        try {
          await STJ.apiAuth('restaurarVersao', { tipo: tipo, versaoId: vAntigo.id });
          STJ.toast('Versão restaurada.');
          fechar();
          STJ.render();
        } catch (e) { /* erro já mostrado em toast por STJ.api */ }
      });
    }
  };

  redesenhar();
};

/* ── Modal de confirmação estilizado (substitui window.confirm) ──────
   Uso: if (await STJ.modalConfirm({ titulo, mensagem, textoConfirmar })) { ... }
   Devolve true se confirmado, false se cancelado. */
STJ.modalConfirm = function (opcoes) {
  return new Promise(function (resolve) {
    var h = STJ.h;
    var overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem';

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:6px;padding:1.5rem;width:100%;max-width:460px;box-shadow:0 6px 32px rgba(0,0,0,.22)">' +
      '<div style="font-size:15px;font-weight:700;color:var(--charcoal,#1a1a1a);margin-bottom:.75rem">' + h(opcoes.titulo || 'Confirmar') + '</div>' +
      '<div style="font-size:13px;color:var(--dark,#333);line-height:1.7;white-space:pre-wrap;margin-bottom:1.25rem">' + h(opcoes.mensagem || '') + '</div>' +
      '<div style="display:flex;gap:.5rem;justify-content:flex-end">' +
      '<button id="stj-conf-cancel" class="btn btn-outline btn-sm">' + h(opcoes.textoCancelar || 'Cancelar') + '</button>' +
      '<button id="stj-conf-ok" class="btn btn-red btn-sm">' + h(opcoes.textoConfirmar || 'Confirmar') + '</button>' +
      '</div></div>';

    document.body.appendChild(overlay);
    var fechar = function (valor) { if (document.body.contains(overlay)) document.body.removeChild(overlay); resolve(valor); };
    document.getElementById('stj-conf-ok').addEventListener('click', function () { fechar(true); });
    document.getElementById('stj-conf-cancel').addEventListener('click', function () { fechar(false); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) fechar(false); });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', escHandler); fechar(false); }
    });
    setTimeout(function () { var b = document.getElementById('stj-conf-cancel'); if (b) b.focus(); }, 40);
  });
};

/* ── Modal de input estilizado (substitui window.prompt) ──────────────
   Uso: var valor = await STJ.modalInput({ titulo, label, placeholder, textoConfirmar })
   Devolve a string introduzida ou null se cancelado/vazio. */
STJ.modalInput = function (opcoes) {
  return new Promise(function (resolve) {
    var h = STJ.h;
    var overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem';

    var fechar = function (valor) {
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
      resolve(valor != null && valor !== '' ? valor : null);
    };

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:6px;padding:1.5rem;width:100%;max-width:440px;box-shadow:0 6px 32px rgba(0,0,0,.22)">' +
      '<div style="font-size:15px;font-weight:700;color:var(--charcoal,#1a1a1a);margin-bottom:1rem">' + h(opcoes.titulo || 'Informação') + '</div>' +
      '<label for="stj-modal-inp" style="font-size:12px;font-weight:600;color:var(--muted,#888);display:block;margin-bottom:6px">' + h(opcoes.label || '') + '</label>' +
      '<input id="stj-modal-inp" type="text" placeholder="' + h(opcoes.placeholder || '') + '" autocomplete="off" ' +
      'style="width:100%;box-sizing:border-box;padding:.55rem .65rem;font-size:13px;border:1px solid var(--border,#ddd);border-radius:4px;outline:none;margin-bottom:1rem">' +
      '<div style="display:flex;gap:.5rem;justify-content:flex-end">' +
      '<button id="stj-modal-cancel" class="btn btn-outline btn-sm">Cancelar</button>' +
      '<button id="stj-modal-ok" class="btn btn-red btn-sm">' + h(opcoes.textoConfirmar || 'OK') + '</button>' +
      '</div></div>';

    document.body.appendChild(overlay);

    var inp = document.getElementById('stj-modal-inp');
    var confirmar = function () { fechar(inp ? String(inp.value || '').trim() : null); };

    document.getElementById('stj-modal-ok').addEventListener('click', confirmar);
    document.getElementById('stj-modal-cancel').addEventListener('click', function () { fechar(null); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) fechar(null); });
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') confirmar();
        if (e.key === 'Escape') fechar(null);
      });
      setTimeout(function () { inp.focus(); }, 40);
    }
  });
};

/* ── Modal informativo (substitui alert/confirm) ─────────────────────
   Uso: await STJ.modalInfo({ titulo, mensagem, textoBotao })          */
STJ.modalInfo = function (opcoes) {
  return new Promise(function (resolve) {
    var h = STJ.h;
    var overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem';

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:6px;padding:1.5rem;width:100%;max-width:460px;box-shadow:0 6px 32px rgba(0,0,0,.22)">' +
      '<div style="font-size:15px;font-weight:700;color:var(--charcoal,#1a1a1a);margin-bottom:.75rem">' + h(opcoes.titulo || 'Informação') + '</div>' +
      '<div style="font-size:13px;color:var(--dark,#333);line-height:1.7;white-space:pre-wrap;margin-bottom:1.25rem">' + h(opcoes.mensagem || '') + '</div>' +
      '<div style="display:flex;justify-content:flex-end">' +
      '<button id="stj-info-ok" class="btn btn-red btn-sm">' + h(opcoes.textoBotao || 'OK') + '</button>' +
      '</div></div>';

    document.body.appendChild(overlay);
    var fechar = function () { if (document.body.contains(overlay)) document.body.removeChild(overlay); resolve(); };
    document.getElementById('stj-info-ok').addEventListener('click', fechar);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) fechar(); });
    setTimeout(function () { var b = document.getElementById('stj-info-ok'); if (b) b.focus(); }, 40);
  });
};
