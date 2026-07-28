/* ════════════════════════════════════════════════════════════════════
   FIFI Profissional — LP /v2

   Sem GSAP, sem Lenis, sem jQuery. A página original não tem animação
   de scroll; carregar biblioteca para imitar nada só custaria TBT.
   O que existe aqui: vídeo do hero adiado, revelação por
   IntersectionObserver, lightbox de vídeo e o formulário.

   Os helpers de tracking são os mesmos da LP `/` de propósito — as duas
   páginas precisam falar o mesmo contrato com /api/leads para o teste
   A/B fechar. A única diferença é `variante`.
   ════════════════════════════════════════════════════════════════════ */

const TRACK = window.FIFI_TRACK || {};
const VARIANTE = TRACK.variante || "v2";

/* ---------- 1. Vídeo do hero ---------------------------------------------
   preload="none" no HTML e src injetado só depois do load. O poster webp
   já é o LCP; o vídeo entra por cima quando puder tocar. Em conexão
   econômica (saveData) ou reduced-motion ele simplesmente não entra —
   a imagem sozinha resolve.                                             */
(function heroVideo() {
  const v = document.querySelector(".hero__video");
  if (!v) return;

  const economia = navigator.connection && (navigator.connection.saveData ||
                   /2g/.test(navigator.connection.effectiveType || ""));
  const paradoPorPreferencia = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (economia || paradoPorPreferencia) return;

  const subir = () => {
    v.src = v.dataset.src;
    // load() explícito: com preload="none" o navegador NÃO começa a buscar só
    // por receber um src novo, então `canplay` nunca chegava e o vídeo ficava
    // parado atrás do poster. Quem revela é o evento `playing`, não o play():
    // a promise resolve antes do primeiro quadro e o fade aconteceria no vazio.
    v.load();
    v.addEventListener("playing", () => v.classList.add("pronto"), { once: true });
    v.play().catch(() => { /* autoplay bloqueado: fica o poster, que já basta */ });
  };

  // requestIdleCallback pode nunca rodar em aba de fundo; o teto de 2,5 s
  // garante que o vídeo suba de qualquer jeito, mas sempre depois do load.
  if (document.readyState === "complete") agendar();
  else addEventListener("load", agendar, { once: true });

  function agendar() {
    if (window.requestIdleCallback) requestIdleCallback(subir, { timeout: 2500 });
    else setTimeout(subir, 800);
  }
})();

/* ---------- 2. Revelação no scroll --------------------------------------- */
(function revelar() {
  const alvos = document.querySelectorAll(".revela");
  if (!alvos.length) return;

  if (!("IntersectionObserver" in window)) {
    alvos.forEach(el => el.classList.add("visivel"));
    return;
  }
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add("visivel");
      obs.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -12% 0px" });

  alvos.forEach(el => obs.observe(el));
})();

/* ---------- 3. Lightbox de vídeo -----------------------------------------
   O <video> nasce sem src: os arquivos têm 3 a 5 MB e não podem entrar no
   carregamento da página. O src só é atribuído no clique.                */
(function visorDeVideo() {
  const visor = document.querySelector("#visor");
  if (!visor) return;
  const video = visor.querySelector("video");
  const fechar = visor.querySelector(".visor__fechar");

  document.querySelectorAll(".card--tem-video").forEach(card => {
    card.addEventListener("click", () => {
      video.src = card.dataset.video;
      video.setAttribute("aria-label", card.dataset.titulo || "Vídeo do produto");
      visor.showModal();
      video.play().catch(() => {});
      if (typeof fbq === "function") {
        fbq("trackCustom", "VerVideoProduto", {
          content_name: card.dataset.titulo || "", variante: VARIANTE,
        });
      }
    });
  });

  const encerrar = () => {
    video.pause();
    video.removeAttribute("src");
    video.load();          // solta o buffer; sem isso o arquivo continua na memória
    if (visor.open) visor.close();
  };
  fechar.addEventListener("click", encerrar);
  visor.addEventListener("close", encerrar);
  // clique no backdrop: o alvo é o próprio <dialog>, nunca um filho
  visor.addEventListener("click", e => { if (e.target === visor) encerrar(); });
})();

/* ---------- 4. Helpers de tracking (espelho da LP `/`) ------------------- */
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

/* Grava UTM e click ID JÁ NO LOAD, não só no submit. É o único jeito de o
   first-touch ser mesmo o primeiro toque: se o visitante entrar por
   `?gclid=…`, sair para o WhatsApp e voltar pela URL limpa, no modelo
   antigo (ler só no submit) o lead chegaria sem gclid e a conversão não
   casaria com o clique no Ads. Os valores enviados são os mesmos — muda
   só o momento de guardar, então não altera nada do que o A/B mede.     */
getUtms();
getClickIds();

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
    transaction_id: eventId,      // trava double-submit
  });
}

function dispararMeta(eventId, segmento) {
  if (typeof fbq !== "function") return;
  fbq("track", "Lead", {
    content_name: "FIFI Limpeza — LP v2",
    content_category: segmento || "",
    variante: VARIANTE,
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

/* ---------- 5. Caminho escolhido no hero ---------------------------------
   Os dois botões do hero são a única segmentação da página original
   ("tenho equipe própria" x "quero implantação"). Vira evento próprio no
   Meta, não campo no formulário: campo novo quebraria a paridade com o
   form da LP `/` e o A/B deixaria de comparar a mesma coisa.

   `trackCustom` e não `Lead`: é sinal de intenção, não conversão. Não
   entra na otimização de quem está comprando Lead.                      */
document.querySelectorAll(".caminho").forEach(link => {
  link.addEventListener("click", () => {
    if (typeof fbq !== "function") return;
    fbq("trackCustom", "EscolheuCaminho", {
      content_name: link.dataset.caminho || "",
      variante: VARIANTE,
    });
  }, { passive: true });
});

/* ---------- 5b. Rota Typebot ---------------------------------------------
   O bot grava o lead sozinho (bloco Webhook client-side → /api/leads, com
   o event_id DELE) e a edge manda o CAPI. Falta só a perna Google: o
   `initBubble` roda no mesmo document, então dá para disparar a conversão
   sem tocar no grafo compartilhado.

   onAnswer coleta e-mail/telefone por heurística para enhanced conversions.
   onEnd dispara uma vez só — a prop é chamada duas vezes pelo bundle.    */
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
  // event_id próprio: o CAPI deste lead sai do bot com o event_id dele, então
  // aqui só interessa que o transaction_id seja único por sessão.
  dispararGoogle(respostasBot, gerarEventId(), TRACK.convLabel);
};

/* ---------- 6. Formulário ------------------------------------------------ */
const formulario = document.querySelector("#lead-form");
const aviso = document.querySelector(".form__aviso");
let enviando = false;

function mascara(campo, fn) {
  campo?.addEventListener("input", () => {
    const noFim = campo.selectionStart === campo.value.length;
    campo.value = fn(campo.value);
    if (noFim) campo.setSelectionRange(campo.value.length, campo.value.length);
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
   inventado ou incompleto antes de gastar a chamada de rede.             */
function validarCnpj(valor) {
  const d = (valor || "").replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = base => {
    let peso = base.length - 7, soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

formulario?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (enviando) return;

  const f = formulario.elements;

  // Validação nativa primeiro (campos required, formato de e-mail)
  if (!formulario.checkValidity()) {
    formulario.reportValidity();
    return;
  }
  if (!validarCnpj(f.cnpj.value)) {
    f.cnpj.setAttribute("aria-invalid", "true");
    f.cnpj.focus();
    aviso.dataset.estado = "erro";
    aviso.textContent = "Esse CNPJ não confere. Confira os números.";
    return;
  }
  f.cnpj.removeAttribute("aria-invalid");

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
  // `origem` é o que separa as duas páginas do teste na planilha. A coluna
  // já existe e aceita texto livre — nada a mudar no Apps Script.
  const payload = { ...dados, ...browser, origem: "Formulário v2", utms: getUtms() };

  enviando = true;
  const botao = formulario.querySelector("button[type=submit]");
  const rotulo = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Verificando CNPJ…";
  aviso.dataset.estado = "";
  aviso.textContent = "";

  // Confirma que o CNPJ existe na Receita antes de contar o lead — é o que
  // barra CPF/pessoa física. Só aborta com "nao" explícito; se a verificação
  // cair, segue o envio (o dígito verificador já filtrou número inventado).
  try {
    const r = await fetch((TRACK.cnpjEndpoint || "/api/cnpj") + "?n=" + dados.cnpj.replace(/\D/g, ""));
    if ((await r.json()).ok === "nao") {
      f.cnpj.setAttribute("aria-invalid", "true");
      f.cnpj.focus();
      aviso.dataset.estado = "erro";
      aviso.textContent = "Não encontramos esse CNPJ na Receita. Confira ou use o CNPJ da empresa.";
      enviando = false;
      botao.disabled = false;
      botao.textContent = rotulo;
      return;
    }
  } catch { /* verificação indisponível: fail-open, não perde lead real */ }

  botao.textContent = "Enviando…";

  // Pixels antes do await: se a rede da edge falhar, o sinal client-side já
  // saiu e o lead não some do Ads nem do Meta.
  dispararMeta(browser.event_id, dados.segmento);
  dispararGoogle(dados, browser.event_id, TRACK.convLabel);

  try {
    const res = await enviarLead(payload);
    if (!res.ok) throw new Error("HTTP " + res.status);
    formulario.reset();
    aviso.dataset.estado = "ok";
    aviso.textContent = "Recebemos seus dados. Um consultor FIFI entra em contato em até 1 dia útil.";
  } catch (err) {
    aviso.dataset.estado = "erro";
    aviso.textContent = "Não conseguimos enviar agora. Tente de novo ou chame no WhatsApp pelo botão verde.";
    console.error("[lead]", err);
  } finally {
    enviando = false;
    botao.disabled = false;
    botao.textContent = rotulo;
  }
});
