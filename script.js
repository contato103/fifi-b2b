/* ============================================================
   FIFI Profissional — interações
   ============================================================ */

/* Dois níveis de movimento. "suave" não é ausência de movimento: mantém fade de
   opacidade (que a WCAG 2.3.3 não proíbe) e corta só o que dispara desconforto
   vestibular — parallax, giro, deslocamento grande, scroll com inércia.
   ?motion=full força o nível completo mesmo com animação desligada no SO. */
const forcaCompleto = new URLSearchParams(location.search).get("motion") === "full";
if (forcaCompleto) document.documentElement.classList.add("motion-full");

const suave = !forcaCompleto && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const temGSAP = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";

/* ---------- 1. Marquee de clientes ---------------------------------------
   31 logos reais do deck. Os assets são recortados sem sangria, por isso a
   pastilha clara com padding — sem ela logos escuras encostam na borda.      */
const CLIENTES = [
  "havan","unimed","sicredi","weg","panvel","koch","fort","giassi","comper",
  "grupo-pereira","skymsen","cooper","diase","embraed","fg","florisa","hoffmann",
  "informov","karsten","kyly","manatex","proaco","quimisa","rvb","sao-luiz",
  "stop-shop","taschibra","tecadi","transmagna","unifebe","viacredi","zen","zm"
];

const trilho = document.querySelector(".marquee-track");
if (trilho) {
  const nomes = CLIENTES.filter(n => n !== "grupo-pereira"); // sem asset próprio
  const criar = () => nomes.map(n => {
    const img = document.createElement("img");
    img.src = `img/clientes/${n}.webp`;
    img.alt = "";               // decorativo: o rótulo da seção já nomeia o conjunto
    img.loading = "lazy";
    img.width = 158; img.height = 74;
    img.addEventListener("error", () => img.remove(), { once: true });
    return img;
  });
  // duas passadas: a animação desloca 50%, então a segunda cobre a emenda
  trilho.append(...criar(), ...criar());
}

/* ---------- 2. Menu mobile ---------------------------------------------- */
const botaoMenu = document.querySelector(".menu-button");
const menu = document.querySelector(".mobile-menu");

botaoMenu?.addEventListener("click", () => {
  const aberto = botaoMenu.getAttribute("aria-expanded") === "true";
  botaoMenu.setAttribute("aria-expanded", String(!aberto));
  menu.hidden = aberto;
});
menu?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    botaoMenu.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  });
});

/* ---------- 2b. Modal da demonstração -------------------------------------
   `<dialog>` nativo já dá Esc, foco preso e backdrop. O que falta é o que ele
   NÃO faz: parar o vídeo ao fechar. Sem isso o áudio continua tocando por trás
   do backdrop fechado. `currentTime = 0` volta pro início, senão reabrir cai no
   meio da narração.                                                          */
const modalDemo   = document.querySelector(".demo-modal");
const videoDemo   = document.querySelector("[data-demo-video]");
const abrirDemo   = document.querySelectorAll("[data-demo-open]");
const fecharDemo  = document.querySelectorAll("[data-demo-close]");

if (modalDemo && videoDemo) {
  abrirDemo.forEach(b => b.addEventListener("click", () => {
    modalDemo.showModal();
    videoDemo.play().catch(() => {});   // autoplay COM som pode ser barrado: o clique é o gesto, mas nem todo browser aceita
  }));

  fecharDemo.forEach(b => b.addEventListener("click", () => modalDemo.close()));

  // Clique no backdrop: o <dialog> reporta o próprio elemento como target, e
  // o retângulo dele exclui a área do backdrop — daí a checagem por coordenada.
  modalDemo.addEventListener("click", e => {
    if (e.target !== modalDemo) return;
    const r = modalDemo.getBoundingClientRect();
    const fora = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (fora) modalDemo.close();
  });

  // Parar o vídeo em QUALQUER caminho de fechamento (X, backdrop, Esc).
  // Não dá pra confiar só no evento `close`: testado no Chromium 148 ele não
  // dispara em `dialog.close()` — só `beforetoggle`/`toggle` chegam, e o áudio
  // continuava tocando por trás do backdrop fechado. `toggle` é recente
  // (Chrome 120+), `close` é o antigo: ouvir os dois cobre as duas pontas.
  // O handler é idempotente, então disparar duas vezes não faz mal.
  const pararDemo = () => {
    if (modalDemo.open) return;
    videoDemo.pause();
    videoDemo.currentTime = 0;
  };
  modalDemo.addEventListener("close", pararDemo);
  modalDemo.addEventListener("toggle", pararDemo);
}

/* ---------- 3. Linha de produtos por embalagem ---------------------------
   Quatro linhas reais, conferidas no deck (p25-27) e no catalogo do
   fifilimpeza.com. A linha pet foi deixada de fora: esta e uma pagina B2B.
   Os aromatizantes sao 350ml (o rotulo e o e-commerce batem; o deck diz
   300ml, mas esta errado). Nenhuma descricao foi inventada: sai do rotulo
   ou do titulo do produto no e-commerce.                                   */
const LINHAS = {
  "5l": [
    ["espuma-pro","Espuma Pro","Perecíveis · manutenção","Desengordurante profissional para limpeza de gorduras difíceis."],
    ["citrus-5d","Citrus 5D","Multiuso · desengordurante","Desengordurante concentrado para gordura pesada e limpeza de fogão."],
    ["hp","HP","Sujidade pesada","Higienizador preventivo com nano partículas. Não mancha, sem cloro e pH neutro."],
    ["dia-a-dia","Dia a Dia","Circulação · rotina","Limpa piso sem danificar. Concentrado e pH neutro."],
    ["limpador-uso-geral","Limpador de Uso Geral","Uso geral","Limpa fachada e vidro com fuligem e maresia."],
    ["big-maq","Big Maq","Circulação · máquinas","Limpeza de galpões e grandes áreas. Antiespuma, para lavadoras e extratoras."],
    ["organic-pro","Organic Pro","Pontual · alta performance","Desincrustante ácido orgânico. Remove cimento e concreto em grandes áreas."],
    ["pos-obra","Pós-Obra","Pós-obra","Remove cimento e resíduos pós-obra sem danificar as superfícies."],
    ["limpa-musgo","Limpa Musgo","Áreas externas","Tira musgo de calçadas e muros."]
  ],
  "1l": [
    ["citrus-5d","Citrus 5D","Multiuso · desengordurante","Desengordurante concentrado para gordura pesada e limpeza de fogão."],
    ["dia-a-dia","Dia a Dia","Circulação · rotina","Limpa piso vinílico sem danificar. Concentrado e pH neutro."],
    ["organic-pro","Organic Pro","Alta performance","Desincrustante ácido orgânico para piso."],
    ["limpador-uso-geral","Limpador de Uso Geral","Fachadas · vidro","Limpa fachada, vidro externo e fuligem."],
    ["limpa-mofo","Limpa Mofo","Paredes · tecidos","Tira mofo de parede, armário e tecidos. Fragrância capim-limão."],
    ["vidro-vip","Vidro Vip","Vidros · espelhos","Limpador profissional para vidros, espelhos e acrílicos. Secagem rápida."],
    ["big-maq","Big Maq","Máquinas · pisos","Tira barro e gordura de pisos. Para lavadoras e extratoras."],
    ["pos-obra","Pós-Obra","Pós-obra","Remove cimento e resíduos pós-obra sem danificar."]
  ],
  "500ml": [
    ["citrus-5d","Citrus 5D","Multiuso · desengordurante","Desengordurante multiuso com ação rápida para limpeza pesada."],
    ["vidro-vip","Vidro Vip","Vidros · espelhos","Limpador instantâneo para vidros, espelhos e acrílicos."],
    ["odor-vip","Odor Vip","Ambientes","Limpador de odor. Elimina mau cheiro de banheiro e ambientes."],
    ["limpa-mofo","Limpa Mofo","Paredes · tecidos","Limpa mofo e bolor de paredes, tecidos, cozinhas e móveis."],
    ["limpa-musgo","Limpa Musgo","Áreas externas","Tira musgo de calçadas e muros."],
    ["limpa-rejunte","Limpa Rejunte","Rejunte · pastilhas","Limpador de rejunte e pastilhas. Realça a cor."],
    ["bye-manchas","Bye Manchas","Tecidos · superfícies","Tira manchas universal, com alto poder de limpeza."],
    ["bye-ferrugem","Bye Ferrugem","Ferrugem","Removedor de ferrugem. Limpa e revitaliza superfícies."],
    ["protege-tecido","Protege Tecido","Tecidos","Impermeabilizante de tecidos. Protege e prolonga a vida útil."],
    ["madeira-nova","Madeira Nova","Madeira · deck","Revitalizador de madeira. Restaura decks, bambus e fibras naturais."]
  ],
  "350ml": [
    ["capim-limao","Aromatizante Capim-Limão","Odorizante","Proporciona um ambiente relaxante e tranquilo."],
    ["cereja-avela","Aromatizante Cereja e Avelã","Odorizante","Deixa o ambiente acolhedor e adocicado."],
    ["limao-hortela","Aromatizante Limão e Hortelã","Odorizante","Refresca o ambiente com energia cítrica."]
  ]
};
const ROTULO = { "5l":"5L", "1l":"1L", "500ml":"500ml", "350ml":"350ml" };
const ORDEM_TAM = ["5l", "1l", "500ml", "350ml"];

const saidaLinha = document.getElementById("linha-out");

/* Um card por PRODUTO (nao mais por embalagem). Pedido da Ivonete (23/07):
   cada card mostra os tamanhos em que o produto e vendido. Consolida as 4
   litragens de LINHAS: a primeira ocorrencia (maior litragem que o produto
   tem) define nome/categoria/descricao/imagem; os tamanhos vao se somando.
   Produto que nao tem 5L usa a imagem da maior litragem que existe. */
const PRODUTOS = (() => {
  const mapa = new Map();
  for (const tam of ORDEM_TAM) {
    for (const [slug, nome, tag, desc] of (LINHAS[tam] || [])) {
      if (!mapa.has(slug)) mapa.set(slug, { slug, nome, tag, desc, img: `${tam}-${slug}`, tamanhos: [] });
      mapa.get(slug).tamanhos.push(tam);
    }
  }
  return [...mapa.values()];
})();

function cardProduto(p) {
  const art = document.createElement("article");
  const shot = document.createElement("div");
  shot.className = "prod-shot";
  const img = document.createElement("img");
  img.src = `img/${p.img}.webp`;
  img.alt = `FIFI ${p.nome}`;
  img.loading = "lazy";
  img.addEventListener("error", () => art.remove(), { once: true });
  shot.appendChild(img);

  const selos = p.tamanhos.map(t => `<span>${ROTULO[t]}</span>`).join("");
  const txt = document.createElement("div");
  txt.innerHTML =
    `<p>${p.tag}</p>` +
    `<h3>${p.nome}</h3>` +
    `<p class="prod-sizes" aria-label="Tamanhos disponíveis">${selos}</p>` +
    `<p class="prod-desc">${p.desc}</p>`;
  art.append(shot, txt);
  return art;
}

function renderProdutos() {
  if (!saidaLinha) return;
  const cards = PRODUTOS.map(cardProduto);

  /* Sao 20 produtos: a ultima fileira quase sempre sobra incompleta. Sem
     preencher, a cor do grid vaza no buraco. Em 2 colunas (mobile) um unico
     orfao ocupa a fileira e centraliza (.prod-orfao); nos demais, celula vazia. */
  const colunas = getComputedStyle(saidaLinha).gridTemplateColumns.split(" ").length;
  const falta = (colunas - (cards.length % colunas)) % colunas;
  if (colunas === 2 && falta === 1) {
    cards[cards.length - 1].classList.add("prod-orfao");
  } else {
    for (let i = 0; i < falta; i++) {
      const vazio = document.createElement("div");
      vazio.className = "prod-vazio";
      vazio.setAttribute("aria-hidden", "true");
      cards.push(vazio);
    }
  }
  saidaLinha.replaceChildren(...cards);

  if (!suave && temGSAP) {
    gsap.from(saidaLinha.children, {
      opacity: 0, y: 14, duration: .45, stagger: .03, ease: "power2.out", overwrite: true
    });
  }
}

renderProdutos();

/* ---------- 4. Máscara de telefone -------------------------------------- */
const campoTelefone = document.querySelector("#phone");
campoTelefone?.addEventListener("input", e => {
  const v = e.target.value.replace(/\D/g, "").slice(0, 11);
  const partes = [v.slice(0, 2), v.slice(2, v.length > 10 ? 7 : 6), v.slice(v.length > 10 ? 7 : 6)].filter(Boolean);
  e.target.value = partes.length === 1
    ? `(${partes[0]}`
    : `(${partes[0]}) ${partes[1]}${partes[2] ? `-${partes[2]}` : ""}`;
});

/* Máscara de CNPJ: 00.000.000/0000-00. Formata enquanto digita e só monta
   cada separador quando o bloco anterior existe, senão apagar deixaria um
   ponto ou barra solto no fim do campo. */
const campoCnpj = document.querySelector("#cnpj");
campoCnpj?.addEventListener("input", e => {
  const v = e.target.value.replace(/\D/g, "").slice(0, 14);
  let saida = v.slice(0, 2);
  if (v.length > 2)  saida += "." + v.slice(2, 5);
  if (v.length > 5)  saida += "." + v.slice(5, 8);
  if (v.length > 8)  saida += "/" + v.slice(8, 12);
  if (v.length > 12) saida += "-" + v.slice(12, 14);
  e.target.value = saida;
});

/* ---------- 5. Tracking --------------------------------------------------
   Padrão da casa (patterns/tracking-capi.md): tudo que o browser sabe vai
   junto com o lead pra edge, que grava no Sheets e manda o CAPI. O pixel
   dispara Lead com o MESMO event_id → a Meta deduplica os dois sinais.
   UTMs em localStorage (first-touch, sobrevive a sessões); click IDs
   last-touch.

   NÃO renomear para uma letra solta. Este arquivo é script clássico: um
   `const X` no topo colide com qualquer `var X` global já criado pelas libs
   de CDN e o browser descarta o ARQUIVO INTEIRO com SyntaxError, sem nada
   renderizar. Foi o que aconteceu com `const T` — o lenis.min.js exporta um
   `var T = class {...}` (VirtualScroll dele) e matou a LP toda em silêncio. */
const TRACK = window.FIFI_TRACK || {};

function getCookie(nome) {
  const m = document.cookie.match(new RegExp("(^| )" + nome + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function gerarEventId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function separarNome(completo) {
  const partes = (completo || "").trim().split(/\s+/);
  return { first_name: partes[0] || "", last_name: partes.slice(1).join(" ") || "" };
}

function getUtms() {
  const p = new URLSearchParams(location.search);
  const atuais = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
    .forEach(k => { if (p.get(k)) atuais[k] = p.get(k); });
  // first-touch: só grava se ainda não houver nada guardado
  if (Object.keys(atuais).length && !localStorage.getItem("_utms")) {
    localStorage.setItem("_utms", JSON.stringify(atuais));
  }
  return JSON.parse(localStorage.getItem("_utms") || "{}");
}

function getClickIds() {
  const p = new URLSearchParams(location.search);
  const atuais = {};
  ["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "msclkid"]
    .forEach(k => { if (p.get(k)) atuais[k] = p.get(k); });
  // last-touch: click ID novo sempre sobrescreve
  if (Object.keys(atuais).length) localStorage.setItem("_clickids", JSON.stringify(atuais));
  return JSON.parse(localStorage.getItem("_clickids") || "{}");
}

/* Lê cookie NA HORA DO ENVIO, nunca no load: o fbevents.js carrega async e
   o _fbp ainda não existe quando a página monta.                          */
function dadosDoBrowser(nomeCompleto) {
  const ids = getClickIds();
  const fbclid = ids.fbclid || "";
  const fbc = getCookie("_fbc") || (fbclid ? "fb.1." + Date.now() + "." + fbclid : "");
  const { first_name, last_name } = separarNome(nomeCompleto);

  return {
    event_id: gerarEventId(),
    first_name, last_name,
    fbp: getCookie("_fbp"),
    fbc, fbclid,
    gclid:   ids.gclid   || "",
    gbraid:  ids.gbraid  || "",
    wbraid:  ids.wbraid  || "",
    ttclid:  ids.ttclid  || "",
    msclkid: ids.msclkid || "",
    page_url:   location.href,
    referrer:   document.referrer,
    user_agent: navigator.userAgent,
    language:   navigator.language,
    screen:     window.screen.width + "x" + window.screen.height,
    timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/* Google: enhanced conversions nativo. user_data vem do STATE, nunca de
   scraping do DOM — o gtag normaliza e hasheia sozinho. transaction_id
   trava double-submit.                                                    */
function dispararGoogle(dados, eventId, label) {
  if (typeof gtag !== "function" || !TRACK.googleAdsId || !label) return;
  const userData = { address: {} };
  if (dados.email) userData.email = dados.email;
  if (dados.phone) userData.phone_number = "+55" + dados.phone.replace(/\D/g, "").replace(/^55/, "");
  const { first_name, last_name } = separarNome(dados.name);
  if (first_name) userData.address.first_name = first_name;
  if (last_name)  userData.address.last_name  = last_name;

  gtag("set", "user_data", userData);
  gtag("event", "conversion", {
    send_to: TRACK.googleAdsId + "/" + label,
    transaction_id: eventId,
  });
}

function dispararMeta(eventId, segmento) {
  if (typeof fbq !== "function") return;
  fbq("track", "Lead", {
    content_name: "FIFI Profissional — LP B2B",
    content_category: segmento || "",
  }, { eventID: eventId });
}

function enviarLead(payload) {
  return fetch(TRACK.endpoint || "/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}

/* ---------- 5b. Formulário ----------------------------------------------- */
const formulario = document.querySelector("#lead-form");
const aviso = document.querySelector(".form-status");
let enviando = false;

/* Máscaras: o telefone chega ao CAPI normalizado pela edge, mas a máscara
   evita o usuário digitar algo que não vira E.164.                        */
function mascara(campo, fn) {
  campo?.addEventListener("input", () => {
    const pos = campo.selectionStart === campo.value.length;
    campo.value = fn(campo.value);
    if (pos) campo.setSelectionRange(campo.value.length, campo.value.length);
  });
}
mascara(document.querySelector("#phone"), v => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d.replace(/(\d{0,2})/, "($1");
  if (d.length <= 6)  return d.replace(/(\d{2})(\d+)/, "($1) $2");
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d+)/, "($1) $2-$3");
});
mascara(document.querySelector("#cnpj"), v => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
});

/* Dígitos verificadores do CNPJ (módulo 11, pesos 5..2 e 6..2). Barra CNPJ
   inventado/incompleto no submit — lead sem empresa não entra na planilha.
   Só numérico: o CNPJ alfanumérico da Receita começou a ser emitido em
   07/2026, empresa com ele tem dias de vida — fora do perfil B2B da FIFI. */
function validarCnpj(valor) {
  const d = (valor || "").replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = base => {
    let peso = base.length - 7, soma = 0;
    for (const c of base) { soma += c * peso; peso = peso === 2 ? 9 : peso - 1; }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(d.slice(0, 12)) === +d[12] && dv(d.slice(0, 13)) === +d[13];
}
campoCnpj?.addEventListener("input", () => {
  campoCnpj.setCustomValidity(
    !campoCnpj.value || validarCnpj(campoCnpj.value) ? "" : "CNPJ inválido"
  );
});

formulario?.addEventListener("submit", async e => {
  e.preventDefault();
  if (enviando) return;

  const invalidos = [...formulario.elements].filter(c => c.willValidate && !c.checkValidity());
  formulario.querySelectorAll("[aria-invalid]").forEach(c => c.removeAttribute("aria-invalid"));

  if (invalidos.length) {
    invalidos.forEach(c => c.setAttribute("aria-invalid", "true"));
    invalidos[0].focus();
    aviso.dataset.state = "erro";
    aviso.textContent = invalidos.some(c => c.validity.customError)
      ? "CNPJ inválido — confira os números digitados."
      : "Confira os campos destacados antes de enviar.";
    return;
  }

  const f = formulario.elements;
  const dados = {
    name:     f.name.value.trim(),
    email:    f.email.value.trim().toLowerCase(),
    phone:    f.phone.value,
    empresa:  f.company.value.trim(),
    cnpj:     f.cnpj.value,
    segmento: f.sector.value,
    gasto:    f.spend.value,
  };

  const browser = dadosDoBrowser(dados.name);
  const payload = { ...dados, ...browser, origem: "Formulário", utms: getUtms() };

  enviando = true;
  const botao = formulario.querySelector("button[type=submit]");
  const rotulo = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Enviando…";
  aviso.dataset.state = "";
  aviso.textContent = "";

  // Dispara os pixels antes do await: se a rede da edge falhar, o sinal
  // client-side já saiu e o lead não some do Ads/Meta.
  dispararMeta(browser.event_id, dados.segmento);
  dispararGoogle(dados, browser.event_id, TRACK.convLabel);

  try {
    const res = await enviarLead(payload);
    if (!res.ok) throw new Error("HTTP " + res.status);
    formulario.reset();
    aviso.dataset.state = "ok";
    aviso.textContent = "Recebemos seus dados. Um consultor FIFI entra em contato em até 1 dia útil.";
  } catch (err) {
    aviso.dataset.state = "erro";
    aviso.textContent = "Não conseguimos enviar agora. Tente de novo ou chame no WhatsApp pelo botão verde.";
    console.error("[lead]", err);
  } finally {
    enviando = false;
    botao.disabled = false;
    botao.textContent = rotulo;
  }
});

/* ---------- 5c. Rota Typebot ---------------------------------------------
   O bot grava o lead sozinho (bloco Webhook client-side → /api/leads) e a
   edge manda o CAPI. Aqui só falta a perna Google: o `initBubble` roda no
   mesmo document, então dá pra disparar a conversão sem tocar no grafo.
   onAnswer coleta email/telefone por heurística para enhanced conversions;
   onEnd dispara uma vez só (a prop chama 2x).                             */
const respostasBot = { name: "", email: "", phone: "" };
let botFinalizado = false;

window.fifiBotAnswer = resposta => {
  const txt = String(resposta && (resposta.message ?? resposta) || "").trim();
  if (!txt) return;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(txt)) { respostasBot.email = txt.toLowerCase(); return; }
  const digitos = txt.replace(/\D/g, "");
  // 14 dígitos = CNPJ, não telefone
  if (digitos.length >= 10 && digitos.length <= 13) { respostasBot.phone = txt; return; }
  if (!respostasBot.name && /[a-zà-ú]/i.test(txt) && !digitos.length) respostasBot.name = txt;
};

window.fifiTrackBotLead = () => {
  if (botFinalizado) return;
  botFinalizado = true;
  // event_id próprio: o CAPI deste lead vem do bot com o event_id DELE, então
  // aqui só interessa que o transaction_id seja único por sessão.
  dispararGoogle(respostasBot, gerarEventId(), TRACK.convLabel);
};

/* ---------- 6. Movimento -------------------------------------------------
   Lenis + ScrollTrigger. Padrão já aprovado pelo Igor (patterns/gsap-patterns).
   Nada anima se o usuário pediu menos movimento.                           */
if (temGSAP) {
  document.documentElement.classList.add("js-anim");
  gsap.registerPlugin(ScrollTrigger);

  if (!suave && typeof Lenis !== "undefined") {
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    window.__lenis = lenis;   // handle p/ debug: scroll nativo briga com o lerp do Lenis
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);

    // âncoras precisam passar pelo Lenis, senão o scroll nativo briga com ele
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener("click", e => {
        const alvo = document.querySelector(a.getAttribute("href"));
        if (!alvo) return;
        e.preventDefault();
        lenis.scrollTo(alvo, { offset: -78 });
      });
    });
  }

  // entrada do hero
  const abertura = gsap.timeline({ defaults: { ease: "power3.out" } });
  if (suave) {
    abertura
      .to(".hero .anim-mask", { opacity: 1, duration: .55, stagger: .08 })
      .to(".hero .anim-up", { opacity: 1, y: 0, duration: .55, stagger: .07 }, "-=.35");
  } else {
    abertura
      .to(".hero .anim-mask", { y: 0, duration: 1.05, stagger: .09 })
      .to(".hero .anim-up", { opacity: 1, y: 0, duration: .8, stagger: .08 }, "-=.7");
  }

  // entradas por scroll
  gsap.utils.toArray(".anim-up").forEach(el => {
    if (el.closest(".hero")) return;
    gsap.to(el, {
      opacity: 1, y: 0, duration: suave ? .45 : .75, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true }
    });
  });

  // Parallax fica só no nível completo: movimento acoplado ao scroll é
  // justamente o que incomoda quem pediu menos movimento.
  if (!suave) {
    gsap.utils.toArray(".pain-media img, .system-media img").forEach(img => {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: "none",
        scrollTrigger: { trigger: img, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  }

  // Botão magnético roda nos dois níveis: só reage ao ponteiro da pessoa,
  // não se move sozinho nem acompanha o scroll.
  const forcaIma = suave ? .18 : .3;
  document.querySelectorAll(".magnetic").forEach(btn => {
    btn.addEventListener("mousemove", e => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, {
        x: (e.clientX - (r.left + r.width / 2)) * forcaIma,
        y: (e.clientY - (r.top + r.height / 2)) * forcaIma,
        duration: .4, ease: "power2.out"
      });
    });
    btn.addEventListener("mouseleave", () => {
      gsap.to(btn, { x: 0, y: 0, duration: .6, ease: "power3.out" });
    });
  });

  // ScrollTrigger perde referência quando o DOM muda (marquee/abas montam depois)
  window.addEventListener("load", () => ScrollTrigger.refresh());
}
