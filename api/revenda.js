export const config = { runtime: 'edge' };

// ── FIFI Revenda (/distribuidor) — captura de leads de lojistas ──────
// Grava na planilha "LP FIFI Revenda · Leads" com a MESMA service account
// da LP B2B (env GOOGLE_CREDENTIALS; a planilha foi compartilhada com
// fifi-b2b@sheets-services-accounts como editora).
//
// Diferença proposital para o api/leads.js: a aba NÃO é procurada pelo
// nome. Lá o nome 'Leads' é fixo e, quando a aba foi renomeada para
// "SETEMBRO" (21/09/2026), o endpoint passou a responder 400 em toda
// gravação. Aqui vale a PRIMEIRA aba da planilha, qualquer que seja o nome;
// as colunas continuam mapeadas pelo nome do cabeçalho (linha 1).

const SPREADSHEET_ID = process.env.REVENDA_SPREADSHEET_ID || '1-fiw_IbFHJAm1n-CRhA-TL5wENaGNfsJ7kWU1KYB8Dc';
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const TIPOS = ['Utilidades', 'Home center / Material de construção', 'Agropecuária', 'Pet shop', 'Mercado', 'Outro'];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function getAccessToken(serviceAccountKey) {
  const key = JSON.parse(serviceAccountKey);
  const b64url = obj => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  })}`;
  const pem = key.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(input));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${input}.${sigB64}` }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`TOKEN_FAIL: ${data.error_description || res.status}`);
  return data.access_token;
}

// Nome atual da primeira aba (a que o comercial vê ao abrir a planilha).
async function primeiraAba(token) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties(title,index)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`META_FAIL(${res.status})`);
  const d = await res.json();
  const aba = (d.sheets || []).map(s => s.properties).sort((a, b) => a.index - b.index)[0];
  if (!aba) throw new Error('SEM_ABA');
  return aba.title;
}
const range = (aba, a1) => encodeURIComponent(`'${aba.replace(/'/g, "''")}'!${a1}`);

async function lerCabecalho(token, aba) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range(aba, '1:1')}`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HEADERS_FAIL(${res.status})`);
  const d = await res.json();
  return (d.values?.[0] || []).map(h => h.toLowerCase().trim());
}

function agoraBR() {
  const now = new Date();
  const l = new Date(now.getTime() + (-3 * 60 + now.getTimezoneOffset()) * 60000);
  const p = n => String(n).padStart(2, '0');
  return {
    br: `${p(l.getDate())}/${p(l.getMonth() + 1)}/${l.getFullYear()} ${p(l.getHours())}:${p(l.getMinutes())}`,
    mes: `${MESES[l.getMonth()]}/${l.getFullYear()}`,
    iso: `${l.getFullYear()}-${p(l.getMonth() + 1)}-${p(l.getDate())}T${p(l.getHours())}:${p(l.getMinutes())}:${p(l.getSeconds())}-03:00`,
  };
}

const digitos = v => String(v || '').replace(/\D/g, '');
const limpa = (v, max = 200) => String(v || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

function telefone(raw) {
  let d = digitos(raw);
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return '';
  return '+55' + d;
}
function cnpjValido(c) {
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += c[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +c[12] && dv(13) === +c[13];
}
const cnpjFmt = c => `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;

export default async function handler(req) {
  const url = new URL(req.url);

  // Health-check só de leitura: GET /api/revenda?health=1
  if (req.method === 'GET' && url.searchParams.get('health') === '1') {
    try {
      const token = await getAccessToken(process.env.GOOGLE_CREDENTIALS);
      const aba = await primeiraAba(token);
      const cols = await lerCabecalho(token, aba);
      return json({ ok: true, aba, colunas: cols.length });
    } catch (e) {
      return json({ ok: false, erro: String(e && e.message || e) }, 500);
    }
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const d = await req.json();

    // Honeypot: campo invisível que só robô preenche. Responde sucesso e não grava.
    if (d.site) return json({ success: true });

    const nome = limpa(d.nome, 120), loja = limpa(d.loja, 160), cidade = limpa(d.cidade, 120);
    const fone = telefone(d.whatsapp), cnpj = digitos(d.cnpj);
    const tipo = TIPOS.includes(d.tipo) ? d.tipo : '';
    const jaVende = d.ja_vende === 'Sim' || d.ja_vende === 'Não' ? d.ja_vende : '';
    if (nome.length < 2 || loja.length < 2 || cidade.length < 2 || !fone || !cnpjValido(cnpj) || !tipo || !jaVende) {
      return json({ success: false, error: 'invalid' }, 400);
    }

    const u = d.utms || {}, ck = d.clicks || {};
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '';
    const t = agoraBR();
    const campos = {
      'data': t.br, 'mês': t.mes,
      'nome': nome, 'telefone': fone, 'loja': loja, 'cnpj': cnpjFmt(cnpj), 'cidade/uf': cidade,
      'tipo de loja': tipo, 'já vende limpeza': jaVende,
      'status': 'Novo', 'origem': 'Formulário',
      'utm_source': limpa(u.utm_source), 'utm_medium': limpa(u.utm_medium), 'utm_campaign': limpa(u.utm_campaign),
      'utm_term': limpa(u.utm_term), 'utm_content': limpa(u.utm_content),
      'gclid': limpa(ck.gclid), 'gbraid': limpa(ck.gbraid), 'wbraid': limpa(ck.wbraid), 'fbclid': limpa(ck.fbclid, 500),
      'fbp': limpa(d.fbp), 'fbc': limpa(d.fbc, 500), 'event id': limpa(d.event_id, 64),
      'pagina': limpa(d.pagina, 500), 'referencia': limpa(d.referencia, 500), 'navegador': limpa(req.headers.get('user-agent'), 300),
      'ip': ip,
      // Geo aproximado do próprio edge da Vercel: sem chamada externa.
      'cidade (ip)': decodeURIComponent(req.headers.get('x-vercel-ip-city') || ''),
      'estado (ip)': req.headers.get('x-vercel-ip-country-region') || '',
      'data iso': t.iso,
    };

    const token = await getAccessToken(process.env.GOOGLE_CREDENTIALS);
    const aba = await primeiraAba(token);
    const cabecalho = await lerCabecalho(token, aba);
    // RAW: o Sheets grava o texto como veio, sem interpretar fórmula ("=IMPORTXML(...)" fica texto).
    const linha = cabecalho.map(h => campos[h] ?? '');

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range(aba, 'A:A')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [linha] }) }
    );
    if (!res.ok) throw new Error(`SHEETS_FAIL(${res.status}): ${(await res.text()).slice(0, 300)}`);

    return json({ success: true });
  } catch (err) {
    console.error('[revenda]', err && err.message || err);
    return json({ success: false, error: 'internal' }, 500);
  }
}
