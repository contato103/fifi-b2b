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
