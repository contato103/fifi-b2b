# FIFI Profissional — tracking, planilha e Typebot

Stack implementada seguindo `patterns/tracking-capi.md` → **PROCEDIMENTO PADRÃO 2026 + v2**
(referências: Fiel, Liderança, Orcali).

```
Pixel Meta       → PageView + fbq('track','Lead') com event_id compartilhado
gtag (Ads + GA4) → conversion no submit (enhanced conversions nativo, sem GTM)
Form OU Typebot  → POST /api/leads (EDGE)
      ├── geo por IP (ipapi.co) → Cidade/Estado/CEP
      ├── grava no Sheets (mapeado por NOME de coluna, RAW)
      └── manda o CAPI Lead server-side (em, ph, fn, ln, ct, st, zp,
          external_id, fbc, fbp, ip, ua) → dedup com o pixel por event_id
Apps Script onChange → sobe o lead pro topo + formata (+ RD, se ligar)
Apps Script onEdit   → Status muda → evento Meta de funil + remonta a aba
                       "Google Ads Offline" (upload por GCLID)
```

**Dedup:** o form dispara o pixel e a edge dispara o CAPI com o mesmo `event_id`.
O Typebot **não** dispara pixel (não tem sentido duplicar) — só o CAPI da edge.
Para o Google, o Typebot dispara `gtag` pelo callback `onEnd` do `initBubble`
(web component, mesmo document da LP — não é iframe).

---

## ✅ Já implementado

| Arquivo | O que é |
|---|---|
| `api/leads.js` | Edge function: Sheets + Meta CAPI + geo por IP. Health-check em `GET /api/leads?health=1` |
| `index.html` | Bloco `window.FIFI_TRACK` (todos os IDs num lugar só) + pixel Meta + gtag + embed do Typebot |
| `script.js` | Captura de browser/UTM/click IDs, máscaras de telefone e CNPJ, submit real, disparo Meta + Google, rota Typebot |
| `sheets-setup-fifi.gs` | Setup da planilha (38 colunas), funil por Status, aba de upload do Google Ads. **Gitignored — tem token** |
| `wa-icon.svg` | Ícone do bubble do Typebot |

**Typebot criado e publicado:**

| Item | Valor |
|---|---|
| Nome | FIFI Profissional — LP B2B |
| id | `cmrvygk15000009j7e0cmx2e5` |
| publicId | `fifi-profissional` |
| Workspace | Solany & Yan's (Digitha) `cmq5swe2t00010bjajfgjb8jh` |
| Coleta | Nome · E-mail · WhatsApp · Empresa · CNPJ · Segmento · Gasto mensal |
| Validado | 9 blocos `Set variable` client-side rodando em sequência + webhook com valores reais interpolados, percorrido por `startChat`/`continueChat` sem gravar lead |

---

## ⛳ Falta — depende de credencial/login

### 1. Google Cloud — Service Account da FIFI
Criar no projeto `sheets-services-accounts` uma SA nova (**não reusar a da Fiel**):

- nome sugerido: `leads-fifi@sheets-services-accounts.iam.gserviceaccount.com`
- gerar chave JSON → salvar em `~/.secrets/google-cloud-fifi.json`
- registrar em `~/.secrets/index.md`

### 2. Planilha
- Criar "Leads FIFI Profissional" no Drive.
- Compartilhar com o `client_email` da SA como **Editor**.
- Anotar o `SPREADSHEET_ID`.

### 3. Apps Script
- `script.google.com` vinculado à planilha → colar `sheets-setup-fifi.gs`.
  ⚠️ Colar via PowerShell `Set-Clipboard`, **nunca** `clip.exe` (estraga o UTF-8 e
  desalinha as colunas com acento).
- Preencher no topo: `META_PIXEL_ID`, `META_ACCESS_TOKEN`, `GOOGLE_CONVERSION_NAME`.
- Rodar `configurarTudo()` uma vez.
- Instalar os acionadores: `onChange` (Ao alterar) e `onEdit` (Ao editar).

### 4. Meta
- Pegar o **pixel ID da FIFI** (o mesmo do e-commerce) e gerar token CAPI em
  Events Manager → Configurações → Conversions API → Gerar token de acesso.
- Salvar em `~/.secrets/meta-fifi.json`.
- Verificar o domínio `fifi-lp.vercel.app` (ou o domínio final) no Business Manager.

### 5. Google Ads
- Anotar o **ID de conversão** (`AW-…`) da conta da FIFI e o **ID do GA4** (`G-…`).
- Criar **duas** ações de conversão:
  - `Lead LP FIFI — Formulário` — criada **manualmente**, disparada por `gtag` → pegar o **label**.
  - `Lead LP FIFI — Typebot` — idem, label próprio.
    ⚠️ **Nunca** usar ação do tipo `WEBPAGE`: a LP não navega no submit, então
    ela nunca dispara e o painel não avisa (fica verde "aguardando conversões" pra sempre).
  - `Leads BD - FIFI Profissional` — tipo **UPLOAD_CLICKS**, para o import offline
    da planilha. O nome tem que bater **exatamente** com `GOOGLE_CONVERSION_NAME` no `.gs`.
- Configurar o import: Ferramentas → Conversões → Uploads → Google Sheets → apontar
  para a aba **Google Ads Offline** da planilha, agendado diário.

### 6. Preencher os IDs no código
Em `index.html`, bloco `window.FIFI_TRACK` — e trocar também as duas ocorrências
literais fora do bloco (a `src` do gtag e o `noscript` do pixel):

```
META_PIXEL_ID   → id real do pixel     (2 lugares: FIFI_TRACK + noscript)
AW-XXXXXXXXXX   → id de conversão Ads  (2 lugares: FIFI_TRACK + src do gtag)
G-XXXXXXXXXX    → id do GA4
LABEL_FORM      → label da conversão do formulário
LABEL_TYPEBOT   → label da conversão do Typebot
```

### 7. Vercel
```bash
vercel env add GOOGLE_CREDENTIALS production
vercel env add SPREADSHEET_ID production
vercel env add META_PIXEL_ID production
vercel env add META_ACCESS_TOKEN production
vercel env add ALLOWED_ORIGINS production
vercel --prod
```

`ALLOWED_ORIGINS` (o Typebot manda o webhook do browser do visitante — sem os dois
domínios dele o CORS derruba o lead):
```
https://fifi-lp.vercel.app,https://typebot.co,https://app.typebot.io
```

### 8. Política de Privacidade
O checkbox de consentimento já existe no form, mas o `href` está vazio (`#`).
Sem página publicada, o consentimento não se sustenta.

---

## 🧪 Teste E2E (nesta ordem)

1. `GET https://fifi-lp.vercel.app/api/leads?health=1` → `{"ok":true,"columns":38}`
2. Abrir a LP e conferir no console: `document.cookie.match(/_fbp=/)` **não pode ser null**
   (se for, o pixel não disparou nenhum `track` e o Advanced Matching degrada em silêncio).
3. Submeter o form → linha na planilha com os 38 campos preenchidos + Events Manager
   mostrando `Lead` com `em`, `ph`, `fbp`, `fbc`.
4. Rodar o Typebot pelo bubble → linha nova com `Origem = Typebot` e os mesmos campos
   de browser preenchidos.
5. Marcar um lead como **Quente** → evento `LeadQualificado` no Events Manager +
   linha nova na aba `Google Ads Offline`.
6. **Validar a conversão do Google sem poluir a conta** — trocar `window.gtag` por um
   espião na própria aba, em vez de submeter formulário de verdade:
   ```js
   const real = window.gtag; const cap = [];
   window.gtag = function(){ cap.push([...arguments]) };
   // dispara a rota que quer testar, depois:
   console.log(cap); window.gtag = real;
   ```

---

## 🅱️ `/v2` — variante do teste A/B (clone de `empresas.fifilimpeza.com`)

Validado em produção em 28/07/2026. Compartilha `api/leads.js`, `api/cnpj.js`,
a planilha, o pixel e a ação de conversão com a `/`.

### O que foi conferido no ar

| Checagem | Resultado |
|---|---|
| `GET /api/leads?health=1` | `{"ok":true,"sheet":"Leads","columns":38}` |
| `GET /api/cnpj?n=<real>` | `{"ok":"sim"}` · sequência repetida → `{"ok":"nao","reason":"digito"}` |
| CORS `OPTIONS /api/leads` com `Origin: fifi-lp.vercel.app` | liberado |
| Cookie `_fbp` | criado (o `track PageView` roda) |
| Cookie `_fbc` | criado a partir do `fbclid` da URL |
| Cookie `_gcl_aw` | criado a partir do `gclid` (Conversion Linker) |
| `fbq('track','Lead')` no submit | com `content_category` = segmento e `variante: v2` |
| `gtag('event','conversion')` no submit | `transaction_id` **igual** ao `eventID` do pixel |
| Enhanced conversions | `user_data` com e-mail minúsculo, telefone `+55…`, nome/sobrenome |
| Payload → `/api/leads` | `event_id` igual ao do pixel (dedup do CAPI), `fbp`, `fbc`, `gclid`, UTMs |
| `origem` na planilha | `Formulário v2` |
| Consentimento | obrigatório; sem marcar, o submit não sai |

**A perna CAPI server-side não foi testada isoladamente** porque só dispara depois
de gravar na planilha, e um teste real criaria linha lixo no funil do cliente
(ver `feedback-sondar-endpoint-captura`). Não é lacuna: o `/v2` chama o **mesmo**
`/api/leads` da `/`, que já está em produção — é literalmente o mesmo código.
Se quiser confirmar mesmo assim, setar `META_TEST_CODE` na Vercel e olhar o
Events Manager → Testar eventos.

### Atribuição — conferida com 3 navegações seguidas
- **UTM = first-touch.** Entrou por `primeiro_toque`, voltou por `segundo_toque`,
  a planilha continua recebendo `primeiro_toque`.
- **Click ID = last-touch.** `GCLID_A` → `GCLID_B`. Tem de ser assim, senão a
  conversão não casa com o clique cobrado no Ads.
- Os dois são gravados **no load**, não no submit. Quem entra por `?gclid=`, sai
  para o WhatsApp e volta pela URL limpa continua com o click ID.

### Rotas de lead — iguais às da `/` desde 28/07
O WhatsApp saiu do `/v2` (5 links + botão flutuante) e entrou o **mesmo Typebot**
da `/`. As duas páginas passam a ter as mesmas rotas, então o A/B compara design
e copy, não canal.

| | `/` | `/v2` |
|---|---|---|
| Formulário → planilha | ✅ `Origem: Formulário` | ✅ `Origem: Formulário v2` |
| Typebot → planilha | ✅ `Origem: Typebot` | ✅ `Origem: Typebot` + `Pagina` = `/v2/` |
| WhatsApp direto | ❌ | ❌ |

**Como separar o lead de bot das duas LPs:** pela coluna **`Pagina`**, não pela
`Origem`. O corpo do webhook do bot tem `"origem": "Typebot"` **literal**, não
variável — prefill não muda isso. Trocar por `{{origem}}` exigiria mexer no grafo
compartilhado **e** passar prefill nas DUAS LPs; mexer só no bot faria o lead da
`/` cair como "Formulário", que é o fallback da edge quando `origem` vem vazio.

Os dois botões do hero (a única segmentação da página original) viram
`EscolheuCaminho` no Meta — `trackCustom`, não `Lead`: é intenção, não conversão.
Não viraram campo do formulário de propósito, senão os dois forms deixariam de
ser comparáveis.

**Se um dia quiser medir clique de WhatsApp no Google:** criar ação própria em
Metas → Conversões, tipo manual/gtag, e marcá-la como **Secundária** ("Não
otimizar"). Nunca reusar `convLabel` — ela é compartilhada com a `/` e só conta
lead qualificado.

---

## ✅ CAPI — consertado em 30/07 (ficou fora do ar de 22/07 a 30/07)

`GET /api/leads?health=1` devolve um campo `capi` com o diagnóstico.

### ⚠️ Escopo de token NÃO diz se o CAPI funciona
Erro meu no diagnóstico de 28/07: culpei a falta de `ads_management`. Está
**errado**. O token que funciona e o que não funcionava têm **exatamente o mesmo
escopo** (`read_ads_dataset_quality`). O que decide é o **pixel estar atribuído
ao system user** no Business Manager — e isso não aparece em `debug_token`.

Consequência prática: **o health-check antigo dava falso negativo em token bom.**
Corrigido — agora ele **tenta enviar** (`POST /{pixel}/events` com
`test_event_code: HEALTHCHECK`) e só diz ok se `events_received > 0`. Evento com
`test_event_code` cai apenas em Events Manager → Testar eventos: não entra no
dado de produção, não conta conversão, não afeta otimização.

**Regra:** para saber se um token de CAPI presta, mande um evento com
`test_event_code`. Não olhe escopo.

### O que estava certo no diagnóstico
- O CAPI **estava** fora e falhando **calado**, de 22/07 a 30/07.
- A causa do silêncio: `sendLeadCAPI` devolvia `{status: res.status}` sem checar
  `res.ok`. Como não lançava, o `try/catch` de quem chama nunca rodava e um 400
  da Meta passava sem **uma linha de log**. Corrigido: agora lança com status,
  pixel e corpo (segue **não** bloqueando o lead).
- Perdido no período: nenhum evento server-side, nenhum dedup, lead de quem usa
  bloqueador ou iOS com prevenção de rastreamento perdido inteiro, e todo o
  Advanced Matching que a edge monta (em, ph, fn, ln, ct, st, zp, external_id).

### Como foi verificado o conserto (30/07)
Três evidências independentes:
1. `POST /{pixel}/events` direto com o token → `events_received: 1` nos **dois**
   pixels da conta.
2. `?health=1` rodando **dentro da edge**, com a env var de produção →
   `capi.ok: true, eventosAceitos: 1`.
3. Lead real pela edge com o log em stream → **nenhuma** linha `[leads] capi:`,
   que é o que o fix emitiria se a Meta recusasse.

`server_last_fired_time` do dataset **não serve** de prova enquanto
`META_TEST_CODE` estiver setado: evento de teste não atualiza esse campo.

Token novo em `~/.secrets/meta-fifi.json` e na Vercel (Production +
Development). **Preview ficou sem** — exige flag de branch e não serve tráfego
real; se algum dia precisar de CAPI em deploy de preview, adicionar lá.

### Pixel — qual é, e por que
`3538639579767084` "New E-commerce Fifi", business `Fiel Limpeza`, conta
`CA - Fifi Limpeza`. **É da FIFI**, não há pixel de outro cliente envolvido.

A conta tem um segundo pixel, `1184111166897233` "Pixel LP - Fifi Empresarial",
que é o que a `empresas.fifilimpeza.com` dispara. **Decisão do Igor em 28/07:
manter o do e-commerce nas duas LPs**, só fazer funcionar. Se um dia migrar, tem
de ser nas duas ao mesmo tempo, senão a comparação dentro do Meta se perde — e o
token novo tem de ser gerado a partir do pixel escolhido.

## ⚠️ Armadilhas já cobertas neste código

- `valueInputOption=RAW` no append — com `USER_ENTERED` o Sheets come o `+` do telefone.
- Cookie `_fbp` lido **no submit**, não no load (o `fbevents.js` carrega async).
- `fbq('track','PageView')` presente — o `init` sozinho **não cria** o cookie `_fbp`.
- Variáveis do Typebot com id `v_nome` (underscore) — hífen quebra `new Function` em
  bloco `Code`, em silêncio.
- Dado de browser via bloco `Set variable` client-side, **nunca** `setVariable()` dentro
  de bloco `Code` (essa função não existe lá — foi o bug que zerou 10 leads da Fiel).
- `outgoingEdgeId` no **último** bloco de cada grupo.
- `googleTagManagerId` ausente das settings do Typebot — senão ele reinjeta GTM na LP.
- `Conversion Time` do upload offline = data **fixa** do lead, nunca `now()`.
