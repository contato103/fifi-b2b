/* FIFI Revenda · LP para lojistas (/distribuidor) */

/* ---------- 0. Modo revisão -----------------------------------------------
   true enquanto houver [CONFIRMAR] na copy. Marca cada promessa pendente e
   mostra a contagem. Desligar só quando o cliente confirmar tudo por escrito
   (o que não for confirmado sai da página, não vira texto mais vago).     */
const REVISAO = true;

const pends = document.querySelectorAll(".pend");
const pill = document.getElementById("review-pill");
if (REVISAO && pends.length) {
  pends.forEach(el => el.setAttribute("tabindex", "0"));
  document.getElementById("review-count").textContent = pends.length;
  pill.hidden = false;
  const toggle = document.getElementById("review-toggle");
  toggle.addEventListener("click", () => {
    const on = document.body.classList.toggle("revisao");
    toggle.textContent = on ? "Ocultar" : "Mostrar";
  });
} else {
  document.body.classList.remove("revisao");
}

/* ---------- 1. Fotos das abas escondidas ---------------------------------
   Os produtos estão no HTML (indexável, funciona sem JS), mas as abas que
   começam fechadas usam data-src: sem isso o navegador baixava ~330 KB de
   fotos que ninguém viu. Carregam ao abrir a aba ou ao passar o mouse nela. */
function loadPanel(panel) {
  panel.querySelectorAll("img[data-src]").forEach(img => {
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  });
}

/* ---------- 2. Abas (teclado: setas, Home, End) ---------------------------- */
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab, focus) {
  tabs.forEach(t => {
    const on = t === tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  });
  if (focus) tab.focus();
  const panel = document.getElementById(tab.getAttribute("aria-controls"));
  loadPanel(panel);
  panel.querySelectorAll("li").forEach((li, n) => li.style.setProperty("--n", n));
  panel.classList.remove("enter"); void panel.offsetWidth; panel.classList.add("enter");
}
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectTab(tab));
  ["pointerenter", "focus"].forEach(ev => tab.addEventListener(ev,
    () => loadPanel(document.getElementById(tab.getAttribute("aria-controls"))), { once: true }));
  tab.addEventListener("keydown", e => {
    const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    selectTab(tabs[(map[e.key] + tabs.length) % tabs.length], true);
  });
});

/* ---------- 3. Formulário: máscaras, validação e envio ---------------------
   POST /api/revenda → planilha "LP FIFI Revenda · Leads". Pixel Meta e
   conversão do Google ainda NÃO estão ligados (decisão pendente: qual pixel
   e qual ação de conversão, para não misturar com a campanha B2B).        */

/* Origem do lead: UTMs e IDs de clique da URL de entrada, guardados na sessão
   para não se perderem se o visitante navegar pelas âncoras antes de enviar. */
const ORIGEM_KEY = "fifi_revenda_origem";
const origem = (() => {
  const q = new URLSearchParams(location.search);
  const pega = keys => Object.fromEntries(keys.map(k => [k, q.get(k) || ""]));
  const atual = {
    utms: pega(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]),
    clicks: pega(["gclid", "gbraid", "wbraid", "fbclid"]),
    referencia: document.referrer
  };
  const temAlgo = Object.values({ ...atual.utms, ...atual.clicks }).some(Boolean);
  try {
    if (temAlgo) sessionStorage.setItem(ORIGEM_KEY, JSON.stringify(atual));
    return JSON.parse(sessionStorage.getItem(ORIGEM_KEY)) || atual;
  } catch { return atual; }
})();
const cookie = n => (document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")) || [])[1] || "";
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const form = document.getElementById("lead-form");
const onlyDigits = v => v.replace(/\D/g, "");
function maskPhone(v) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function maskCNPJ(v) {
  const d = onlyDigits(v).slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2")
          .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
          .replace(/\.(\d{3})(\d)/, ".$1/$2")
          .replace(/(\d{4})(\d)/, "$1-$2");
}
function cnpjValido(v) {
  const c = onlyDigits(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dig = n => {
    let s = 0, p = n - 7;
    for (let i = 0; i < n; i++) { s += c[i] * p--; if (p < 2) p = 9; }
    const r = s % 11; return r < 2 ? 0 : 11 - r;
  };
  return dig(12) == c[12] && dig(13) == c[13];
}
form.whatsapp.addEventListener("input", e => { e.target.value = maskPhone(e.target.value); });
form.cnpj.addEventListener("input", e => { e.target.value = maskCNPJ(e.target.value); });

const checks = {
  nome: () => form.nome.value.trim().length >= 2,
  whatsapp: () => onlyDigits(form.whatsapp.value).length >= 10,
  cnpj: () => cnpjValido(form.cnpj.value),
  loja: () => form.loja.value.trim().length >= 2,
  cidade: () => form.cidade.value.trim().length >= 2,
  tipo: () => !!form.querySelector('[name="tipo"]:checked'),
  ja_vende: () => !!form.querySelector('[name="ja_vende"]:checked')
};
function fieldOf(name) { return form.querySelector(`[name="${name}"]`).closest(".field"); }
Object.keys(checks).forEach(name => {
  form.querySelectorAll(`[name="${name}"]`).forEach(el =>
    el.addEventListener("change", () => fieldOf(name).classList.toggle("invalid", !checks[name]())));
});
let enviando = false;
form.addEventListener("submit", async e => {
  e.preventDefault();
  if (enviando) return;
  let first = null;
  for (const [name, ok] of Object.entries(checks)) {
    const bad = !ok();
    fieldOf(name).classList.toggle("invalid", bad);
    if (bad && !first) first = form.querySelector(`[name="${name}"]`);
  }
  const erro = form.querySelector(".form-error");
  erro.textContent = "Confira os campos marcados.";
  erro.hidden = !first;
  if (first) { first.focus(); return; }

  const botao = form.querySelector('button[type="submit"]');
  const rotulo = botao.textContent;
  enviando = true; botao.disabled = true; botao.textContent = "Enviando...";
  const f = form.elements;
  const payload = {
    nome: f.nome.value, whatsapp: f.whatsapp.value, cnpj: f.cnpj.value,
    loja: f.loja.value, cidade: f.cidade.value,
    tipo: form.querySelector('[name="tipo"]:checked').value,
    ja_vende: form.querySelector('[name="ja_vende"]:checked').value,
    site: f.site.value,
    utms: origem.utms, clicks: origem.clicks, referencia: origem.referencia,
    pagina: location.href, fbp: cookie("_fbp"), fbc: cookie("_fbc"), event_id: novoId()
  };
  try {
    const r = await fetch("/api/revenda", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), keepalive: true
    });
    if (!r.ok) throw new Error(r.status);
    window.location.href = "obrigado.html";
  } catch {
    erro.textContent = "Não conseguimos enviar agora. Confira sua conexão e tente de novo.";
    erro.hidden = false;
    enviando = false; botao.disabled = false; botao.textContent = rotulo;
  }
});

/* ---------- 4. CTA fixo no mobile ------------------------------------------ */
const sticky = document.querySelector(".sticky-cta");
const hero = document.querySelector(".hero");
let heroOut = false, formIn = false;
const paint = () => sticky.classList.toggle("show", heroOut && !formIn);
new IntersectionObserver(([e]) => { heroOut = !e.isIntersecting; paint(); }).observe(hero);
new IntersectionObserver(([e]) => { formIn = e.isIntersecting; paint(); }, { threshold: .1 }).observe(form.closest("section"));

/* ---------- 5. Movimento ----------------------------------------------------
   Revelar no scroll. Só age se o <head> ligou .js-motion (movimento liberado). */
if (document.documentElement.classList.contains("js-motion")) {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    io.unobserve(e.target);
  }), { rootMargin: "0px 0px -12% 0px" });
  document.querySelectorAll(".reveal").forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains("reveal"));
    el.style.setProperty("--d", `${(sibs.indexOf(el) % 4) * 80}ms`);
    io.observe(el);
  });
}
