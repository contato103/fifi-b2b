"""Gera typebot/fifi-revenda.json: o bot da LP de revenda (/distribuidor).

Fluxo: Saudação -> O que você precisa? (Quero revender FIFI | Tirar uma dúvida;
a dúvida pede a mensagem) -> coleta (nome, WhatsApp, loja, CNPJ, cidade/UF, tipo de
loja, já vende) -> envio para /api/revenda -> agradecimento. O WhatsApp da Renata só
aparece DEPOIS dos dados, no agradecimento de quem quer revender (pedido do Adail,
28/09: ninguém vai para o WhatsApp sem deixar os dados).
Os campos e os valores das escolhas são os MESMOS do formulário da página: a
API valida os dois caminhos com as mesmas regras e grava na mesma planilha.

Importar em app.typebot.com (Create a typebot > Import a file) e publicar com o
ID público `fifi-revenda`. Rodar de novo este script depois de qualquer ajuste.
"""
import json
import pathlib

API = "https://mkt.fifilimpeza.com/api/revenda"
CATALOGO = "https://drive.google.com/file/d/1ayT0qVXGJHj7anIxKqzI1nNpeeM00l9P/view?usp=sharing"
# WhatsApp do comercial (quem responde é a Renata, mas o nome dela não aparece para o cliente).
WHATS = ("https://wa.me/5547991994731?text=Ol%C3%A1!%20Vim%20pela%20p%C3%A1gina%20de%20"
         "revenda%20da%20FIFI%20e%20quero%20saber%20como%20revender%20os%20produtos%20na%20minha%20loja.")
REVENDER, DUVIDA = "Quero revender FIFI", "Tirar uma dúvida"
TIPOS = ["Utilidades", "Home center / Material de construção", "Agropecuária", "Pet shop", "Mercado", "Outro"]

variaveis = ["interesse", "duvida", "nome", "whatsapp", "loja", "cnpj", "cidade", "tipo", "ja_vende",
             "tel_valido", "cnpj_valido", "envio", "lead_ok",
             # vêm da página (prefilledVariables) ou de Set variable no navegador
             "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
             "gclid", "gbraid", "wbraid", "fbclid", "referencia", "pagina", "fbp", "fbc", "event_id"]


def p(*partes):
    """Parágrafo de rich text. Parte str = texto; tupla (texto, url) = link."""
    filhos = []
    for x in partes:
        if isinstance(x, tuple):
            filhos.append({"type": "a", "url": x[1], "children": [{"text": x[0]}]})
        else:
            filhos.append({"text": x})
    return {"type": "p", "children": filhos}


def texto(bid, *partes, edge=None):
    b = {"id": bid, "type": "text", "content": {"richText": [p(*partes)]}}
    if edge:
        b["outgoingEdgeId"] = edge
    return b


def entrada(bid, var, placeholder, edge=None):
    b = {"id": bid, "type": "text input",
         "options": {"labels": {"placeholder": placeholder, "button": "Enviar"}, "variableId": "v_" + var, "isLong": False}}
    if edge:
        b["outgoingEdgeId"] = edge
    return b


def escolha(bid, var, itens, edge):
    return {"id": bid, "outgoingEdgeId": edge, "type": "choice input",
            "items": [{"id": f"{bid}-i{n}", "content": t} for n, t in enumerate(itens)],
            "options": {"variableId": "v_" + var, "isMultipleChoice": False}}


def codigo(bid, var, js, edge=None):
    b = {"id": bid, "type": "Set variable",
         "options": {"variableId": "v_" + var, "isExecutedOnClient": True,
                     "expressionToEvaluate": js, "isCode": True, "type": "Custom"}}
    if edge:
        b["outgoingEdgeId"] = edge
    return b


def condicao(bid, item_id, var, valor, edge_sim, edge_nao):
    return {"id": bid, "outgoingEdgeId": edge_nao, "type": "Condition",
            "items": [{"id": item_id, "outgoingEdgeId": edge_sim,
                       "content": {"logicalOperator": "AND",
                                   "comparisons": [{"id": item_id + "-cmp", "variableId": "v_" + var,
                                                    "comparisonOperator": "Equal to", "value": valor}]}}]}


COOKIE = "function gc(n){var m=document.cookie.match(new RegExp('(^| )'+n+'=([^;]+)'));return m?decodeURIComponent(m[2]):''}"
JS_TEL = ('var d=(""+({{whatsapp}}||"")).replace(/\\D/g,"");if(d.length>=12&&d.indexOf("55")===0)d=d.slice(2);'
          'return (d.length===10||d.length===11)?"sim":"nao";')
# Mesmo cálculo da página (script.js) e da API (api/revenda.js).
JS_CNPJ = ('var d=(""+({{cnpj}}||"")).replace(/\\D/g,"").slice(0,14);if(d.length!==14||/^(\\d)\\1{13}$/.test(d))return"nao";'
           'function dv(b){var p=b.length-7,s=0;for(var i=0;i<b.length;i++){s+=(+b[i])*p;p=p===2?9:p-1}var r=s%11;return r<2?0:11-r}'
           'return (dv(d.slice(0,12))===+d[12]&&dv(d.slice(0,13))===+d[13])?"sim":"nao";')
# Avisa a página que um lead do bot foi GRAVADO: é o gancho para Pixel/Google Ads.
# (O onEnd do Typebot dispara em QUALQUER fim de fluxo, inclusive na falha.)
JS_LEAD = ('try{sessionStorage.setItem("fifi_revenda_enviado","1")}catch(e){}'
           'try{window.dispatchEvent(new CustomEvent("fifi:lead",{detail:{origem:"Typebot",event_id:{{event_id}}}}))}catch(e){}'
           'return "sim";')

corpo = {
    "nome": "{{nome}}", "whatsapp": "{{whatsapp}}", "loja": "{{loja}}", "cnpj": "{{cnpj}}",
    "cidade": "{{cidade}}", "tipo": "{{tipo}}", "ja_vende": "{{ja_vende}}",
    "origem": "Typebot", "interesse": "{{interesse}}", "duvida": "{{duvida}}",
    "utms": {k: "{{%s}}" % k for k in ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]},
    "clicks": {k: "{{%s}}" % k for k in ["gclid", "gbraid", "wbraid", "fbclid"]},
    "referencia": "{{referencia}}", "pagina": "{{pagina}}",
    "fbp": "{{fbp}}", "fbc": "{{fbc}}", "event_id": "{{event_id}}",
}

JS_FBC = (COOKIE + " var c=gc('_fbc');if(!c){var f={{fbclid}}||new URLSearchParams(location.search).get('fbclid');"
          "if(f)c='fb.1.'+Date.now()+'.'+f}return c")
JS_UUID = ("return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():"
           "'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;"
           "return (c==='x'?r:(r&0x3|0x8)).toString(16)})")

grupos = [
    ("g-init", "Dados do navegador", [
        codigo("b-fbp", "fbp", COOKIE + " return gc('_fbp')"),
        codigo("b-fbc", "fbc", JS_FBC),
        codigo("b-event", "event_id", JS_UUID),
        codigo("b-pagina", "pagina", "return window.location.href", edge="e-init"),
    ]),
    ("g-oi", "Saudação", [
        texto("b-oi1", "Olá! Aqui é a FIFI."),
        texto("b-oi2", "Vou te ajudar a levar a linha de limpeza FIFI para a sua loja.", edge="e-oi"),
    ]),
    ("g-precisa", "O que você precisa?", [
        texto("b-precisa-q", "O que você precisa?"),
        {"id": "b-precisa-in", "outgoingEdgeId": "e-precisa", "type": "choice input",
         "items": [{"id": "b-precisa-in-rev", "content": REVENDER},
                   {"id": "b-precisa-in-duv", "content": DUVIDA, "outgoingEdgeId": "e-precisa-duvida"}],
         "options": {"variableId": "v_interesse", "isMultipleChoice": False}},
    ]),
    ("g-duvida", "Dúvida", [
        texto("b-duvida-q", "Pode escrever a sua dúvida. Um consultor comercial da FIFI vai responder."),
        {"id": "b-duvida-in", "outgoingEdgeId": "e-duvida", "type": "text input",
         "options": {"labels": {"placeholder": "Escreva a sua dúvida", "button": "Enviar"},
                     "variableId": "v_duvida", "isLong": True}},
    ]),
    ("g-nome", "Nome", [
        texto("b-nome-intro", "Combinado. Vou anotar alguns dados para um consultor comercial da FIFI falar com você."),
        texto("b-nome-q", "Qual o seu nome?"),
        entrada("b-nome-in", "nome", "Seu nome", edge="e-nome"),
    ]),
    ("g-tel", "WhatsApp", [
        texto("b-tel-q", "Qual o seu WhatsApp com DDD?"),
        entrada("b-tel-in", "whatsapp", "(47) 99999-9999"),
        codigo("b-tel-check", "tel_valido", JS_TEL),
        condicao("b-tel-cond", "tel-sim", "tel_valido", "sim", "e-tel", "e-tel-erro"),
    ]),
    ("g-tel-erro", "WhatsApp inválido", [
        texto("b-tel-err", "Esse número não parece completo. Envie com DDD, por exemplo (47) 99999-9999.",
              edge="e-tel-volta"),
    ]),
    ("g-loja", "Loja", [
        texto("b-loja-q", "Qual o nome da sua loja?"),
        entrada("b-loja-in", "loja", "Nome da loja", edge="e-loja"),
    ]),
    ("g-cnpj", "CNPJ", [
        texto("b-cnpj-q", "E o CNPJ da loja? As condições de revenda são para lojas com CNPJ ativo."),
        entrada("b-cnpj-in", "cnpj", "00.000.000/0000-00"),
        codigo("b-cnpj-check", "cnpj_valido", JS_CNPJ),
        condicao("b-cnpj-cond", "cnpj-sim", "cnpj_valido", "sim", "e-cnpj", "e-cnpj-erro"),
    ]),
    ("g-cnpj-erro", "CNPJ inválido", [
        texto("b-cnpj-err", "Esse CNPJ não confere. Confira os 14 números e envie de novo.", edge="e-cnpj-volta"),
    ]),
    ("g-cidade", "Cidade", [
        texto("b-cidade-q", "Em qual cidade e estado fica a loja?"),
        entrada("b-cidade-in", "cidade", "Brusque / SC", edge="e-cidade"),
    ]),
    ("g-tipo", "Tipo de loja", [
        texto("b-tipo-q", "Qual o tipo da sua loja?"),
        escolha("b-tipo-in", "tipo", TIPOS, "e-tipo"),
    ]),
    ("g-vende", "Já vende?", [
        texto("b-vende-q", "Você já vende produtos de limpeza hoje?"),
        escolha("b-vende-in", "ja_vende", ["Sim", "Não"], "e-vende"),
    ]),
    ("g-envio", "Enviar para a planilha", [
        {"id": "b-webhook", "type": "Webhook",
         "options": {"isCustomBody": True, "isExecutedOnClient": True,
                     "responseVariableMapping": [{"id": "map-envio", "variableId": "v_envio", "bodyPath": "data.resultado"}],
                     "webhook": {"headers": [], "method": "POST", "url": API,
                                 "body": json.dumps(corpo, ensure_ascii=False, indent=2)}}},
        condicao("b-envio-cond", "envio-ok", "envio", "ok", "e-envio-ok", "e-envio-falha"),
    ]),
    ("g-obrigado", "Agradecimento", [
        codigo("b-lead", "lead_ok", JS_LEAD),
        texto("b-ok1", "Obrigado pelas informações, {{nome}}!"),
        condicao("b-ok-cond", "ok-duvida", "interesse", DUVIDA, "e-ok-duvida", "e-ok-revenda"),
    ]),
    ("g-ok-revenda", "Agradecimento: revenda (libera o WhatsApp)", [
        texto("b-okr1", "Para continuar a conversa, fale com a gente no WhatsApp: ", ("Chamar no WhatsApp", WHATS)),
        texto("b-okr2", "Ou, se preferir, veja o nosso catálogo completo: ", ("Ver catálogo", CATALOGO)),
    ]),
    ("g-ok-duvida", "Agradecimento: dúvida", [
        texto("b-okd1", "Um consultor comercial da FIFI vai responder a sua dúvida pelo WhatsApp."),
        texto("b-okd2", "Enquanto isso, veja o nosso catálogo completo: ", ("Ver catálogo", CATALOGO)),
    ]),
    ("g-falha", "Envio falhou", [
        texto("b-falha1", "Não consegui registrar seus dados agora."),
        texto("b-falha2", "Fale com a gente direto no WhatsApp: ", ("Chamar no WhatsApp", WHATS)),
    ]),
]

ligacoes = [  # (id, bloco de origem, item, grupo de destino)
    ("e-init", "b-pagina", None, "g-oi"),
    ("e-oi", "b-oi2", None, "g-precisa"),
    ("e-precisa", "b-precisa-in", None, "g-nome"),
    ("e-precisa-duvida", "b-precisa-in", "b-precisa-in-duv", "g-duvida"),
    ("e-duvida", "b-duvida-in", None, "g-nome"),
    ("e-nome", "b-nome-in", None, "g-tel"),
    ("e-tel", "b-tel-cond", "tel-sim", "g-loja"),
    ("e-tel-erro", "b-tel-cond", None, "g-tel-erro"),
    ("e-tel-volta", "b-tel-err", None, "g-tel"),
    ("e-loja", "b-loja-in", None, "g-cnpj"),
    ("e-cnpj", "b-cnpj-cond", "cnpj-sim", "g-cidade"),
    ("e-cnpj-erro", "b-cnpj-cond", None, "g-cnpj-erro"),
    ("e-cnpj-volta", "b-cnpj-err", None, "g-cnpj"),
    ("e-cidade", "b-cidade-in", None, "g-tipo"),
    ("e-tipo", "b-tipo-in", None, "g-vende"),
    ("e-vende", "b-vende-in", None, "g-envio"),
    ("e-envio-ok", "b-envio-cond", "envio-ok", "g-obrigado"),
    ("e-envio-falha", "b-envio-cond", None, "g-falha"),
    ("e-ok-duvida", "b-ok-cond", "ok-duvida", "g-ok-duvida"),
    ("e-ok-revenda", "b-ok-cond", None, "g-ok-revenda"),
]

# Posições no editor: linha principal em cima e, embaixo, os desvios de erro.
posicao = {"g-init": (0, 0), "g-oi": (340, 0), "g-precisa": (680, 0), "g-duvida": (680, 360), "g-nome": (1020, 0), "g-tel": (1360, 0),
           "g-tel-erro": (1360, 360), "g-loja": (1700, 0), "g-cnpj": (2040, 0), "g-cnpj-erro": (2040, 360),
           "g-cidade": (2380, 0), "g-tipo": (2720, 0), "g-vende": (3060, 0), "g-envio": (3400, 0),
           "g-obrigado": (3740, 0), "g-falha": (3740, 720),
           "g-ok-revenda": (4080, 0), "g-ok-duvida": (4080, 360)}

bot = {
    "version": "6.1",
    "name": "FIFI Revenda · LP Distribuidor",
    "events": [{"id": "ev-start", "outgoingEdgeId": "e-start", "graphCoordinates": {"x": -300, "y": 0}, "type": "start"}],
    "groups": [{"id": gid, "title": t, "graphCoordinates": {"x": posicao[gid][0], "y": posicao[gid][1]}, "blocks": bl}
               for gid, t, bl in grupos],
    "edges": [{"id": "e-start", "from": {"eventId": "ev-start"}, "to": {"groupId": "g-init"}}] +
             [{"id": i, "from": ({"blockId": b, "itemId": it} if it else {"blockId": b}), "to": {"groupId": g}}
              for i, b, it, g in ligacoes],
    "variables": [{"id": "v_" + v, "name": v, "isSessionVariable": False} for v in variaveis],
    "theme": {"general": {"font": "Outfit", "background": {"type": "Color", "content": "#F4F7F2"}},
              "chat": {"hostAvatar": {"isEnabled": False},
                       "hostBubbles": {"backgroundColor": "#0B3A2C", "color": "#FFFFFF"},
                       "guestBubbles": {"backgroundColor": "#FFFFFF", "color": "#10231B"},
                       "buttons": {"backgroundColor": "#C4F04A", "color": "#0B3A2C"},
                       "inputs": {"backgroundColor": "#FFFFFF", "color": "#10231B", "placeholderColor": "#8A948E"}}},
    "settings": {"general": {"isBrandingEnabled": True, "isInputPrefillEnabled": True,
                             "isHideQueryParamsEnabled": False, "isNewResultOnRefreshEnabled": False},
                 "metadata": {"title": "FIFI Revenda"}},
}

# Checagens: toda ligação aponta para grupo/bloco que existe; toda saída declarada tem ligação e vice-versa;
# toda variável usada em {{...}} ou variableId existe.
gids = {g["id"] for g in bot["groups"]}
bids = {b["id"] for g in bot["groups"] for b in g["blocks"]}
eids = {e["id"] for e in bot["edges"]}
assert all(e["to"]["groupId"] in gids for e in bot["edges"])
assert all(e["from"]["blockId"] in bids for e in bot["edges"] if "blockId" in e["from"])
saidas = [b["outgoingEdgeId"] for g in bot["groups"] for b in g["blocks"] if "outgoingEdgeId" in b]
saidas += [i["outgoingEdgeId"] for g in bot["groups"] for b in g["blocks"] for i in b.get("items", [])
           if "outgoingEdgeId" in i]
assert set(saidas) | {"e-start"} == eids, set(saidas) ^ eids
bruto = json.dumps(bot, ensure_ascii=False)
import re
usadas = set(re.findall(r"\{\{(\w+)\}\}", bruto)) | {v[2:] for v in re.findall(r'"variableId": "(v_\w+)"', bruto)}
assert usadas <= set(variaveis), usadas - set(variaveis)

out = pathlib.Path(__file__).with_name("fifi-revenda.json")
out.write_text(json.dumps(bot, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"ok: {out.name} · {len(bot['groups'])} grupos · {len(bot['edges'])} ligações · {len(bot['variables'])} variáveis")
