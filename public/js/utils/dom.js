/**
 * js/utils/dom.js
 * Utilitários de manipulação do DOM.
 * Elimina repetição de document.getElementById() e innerHTML espalhados
 * pelas views. Todas as operações DOM passam por aqui.
 */

/**
 * Seleciona um elemento por ID (equivalente a document.getElementById).
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function g(id) { return document.getElementById(id); }

/**
 * Seleciona o primeiro elemento que corresponde ao seletor CSS.
 */
export function q(seletor, contexto) {
  return (contexto || document).querySelector(seletor);
}

/**
 * Seleciona todos os elementos que correspondem ao seletor CSS.
 * @returns {HTMLElement[]}
 */
export function qa(seletor, contexto) {
  return Array.from((contexto || document).querySelectorAll(seletor));
}

/**
 * Define o innerHTML de um elemento (por ID).
 * @param {string} id
 * @param {string} html
 */
export function setHtml(id, html) {
  const el = g(id);
  if (el) el.innerHTML = html;
}

/**
 * Insere HTML como innerText de um elemento (por ID) — sem parsing.
 */
export function setText(id, texto) {
  const el = g(id);
  if (el) el.textContent = String(texto || '');
}

/**
 * Adiciona/remove classes de forma condicional.
 */
export function toggleClass(el, classe, condicao) {
  if (!el) return;
  if (condicao) el.classList.add(classe);
  else el.classList.remove(classe);
}

/**
 * Mostra/oculta um elemento (display block/none).
 */
export function mostrar(el, visivel) {
  if (!el) return;
  el.style.display = visivel ? '' : 'none';
}

/**
 * Mostra/oculta um elemento por ID.
 */
export function mostrarId(id, visivel) {
  mostrar(g(id), visivel);
}

/**
 * Faz scroll para o topo da página.
 */
export function scrollTopo() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Faz scroll suave para um elemento.
 */
export function scrollPara(el) {
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Lê o valor de um input por ID (com trim).
 */
export function valorInput(id) {
  const el = g(id);
  return el ? el.value.trim() : '';
}

/**
 * Define o valor de um input por ID.
 */
export function definirInput(id, valor) {
  const el = g(id);
  if (el) el.value = valor ?? '';
}

/**
 * Adiciona um event listener com cleanup automático opcional.
 * @returns {Function} - Função de remoção do listener
 */
export function on(el, evento, handler, opcoes) {
  if (!el) return () => {};
  el.addEventListener(evento, handler, opcoes);
  return () => el.removeEventListener(evento, handler, opcoes);
}

/**
 * Cria um elemento HTML com atributos e filhos.
 * @param {string} tag
 * @param {object} attrs
 * @param {...(string|HTMLElement)} filhos
 */
export function criarEl(tag, attrs, ...filhos) {
  const el = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el[k] = v;
      else el.setAttribute(k, v);
    });
  }
  filhos.forEach((f) => {
    if (f == null) return;
    el.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
  });
  return el;
}

/**
 * Debounce: adia a execução de uma função enquanto continua a ser chamada.
 * @param {Function} fn
 * @param {number}   delay - em milissegundos
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Copia texto para a área de transferência.
 * @returns {Promise<boolean>}
 */
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
