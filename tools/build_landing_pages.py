#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Landing oldal generátor v1. Használat: python3 build_landing_pages_v1.py albums_v1.json [kimeneti_mappa]
Kimenet: okos-funkciok.html + album-<id>.html + sitemap_landing.xml"""
import html, json, os, sys
APP="https://csereljokosan.hu/"
albums=[a for a in json.load(open(sys.argv[1],encoding="utf-8")) if not a["id"].startswith("tovabbiak-betoltese")]
out=sys.argv[2] if len(sys.argv)>2 else "landing_out"
MIN_YEAR=int(sys.argv[3]) if len(sys.argv)>3 else 2025  # ennél régebbi albumhoz nem készül külön oldal (csak a katalógusban szerepel)
E=html.escape

CSS="""
:root{--deep:#0D2E2C;--mid:#14453F;--light:#1D5750;--amber:#D89B4A;--amber-h:#E5A855;--gold:#FFD166;--text:#F3EEDF;--muted:#9FB3A3;--sand:#E3D5B8;--blue:#2B6CB0;--line:rgba(227,213,184,.18);--disp:'Fraunces',Georgia,serif;--body:'Work Sans',system-ui,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;font-family:var(--body);color:var(--text);line-height:1.6;background:radial-gradient(900px 500px at 85% -10%,rgba(216,155,74,.16),transparent 60%),radial-gradient(700px 500px at -10% 10%,rgba(29,87,80,.55),transparent 60%),var(--deep)}
a{color:var(--amber)}.w{max-width:960px;margin:0 auto;padding:0 16px}
.top{position:sticky;top:0;z-index:5;backdrop-filter:blur(10px);background:rgba(13,46,44,.85);border-bottom:1px solid var(--line)}
.top .w{display:flex;justify-content:space-between;align-items:center;padding-top:10px;padding-bottom:10px}
.brand{font-family:var(--disp);font-weight:700;color:var(--text);text-decoration:none;font-size:1.15rem}
.btn{display:inline-block;background:var(--amber);color:#2a1c06;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:999px;transition:.15s}
.btn:hover{background:var(--amber-h);color:#2a1c06;transform:translateY(-1px)}
.btn.ghost{background:transparent;color:var(--text);border:1px solid var(--line)}
.hero{padding:56px 0 30px}.eyebrow{color:var(--amber);font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:.75rem}
h1{font-family:var(--disp);font-size:clamp(2.1rem,6vw,3.5rem);line-height:1.08;margin:.3em 0}
h2{font-family:var(--disp);font-size:1.6rem;margin:0 0 10px}
.lead{color:var(--sand);font-size:1.1rem;max-width:58ch}.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
section{padding:34px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.card{background:linear-gradient(180deg,rgba(29,87,80,.55),rgba(20,69,63,.6));border:1px solid var(--line);border-radius:16px;padding:18px}
.card h3{margin:.2em 0 .3em;font-size:1.05rem}.card p{margin:0;color:var(--sand);font-size:.95rem}.ic{font-size:1.6rem}
.feat{display:grid;grid-template-columns:1fr 1fr;gap:26px;align-items:center;padding:26px 0;border-top:1px solid var(--line)}
.feat:nth-child(even) .txt{order:2}.feat h2{font-size:1.4rem}.feat p{color:var(--sand);margin:.3em 0}
.vis{background:rgba(0,0,0,.25);border:1px solid var(--line);border-radius:16px;padding:18px;font-size:.92rem}
.chip{display:inline-block;padding:3px 10px;border-radius:999px;font-weight:600;font-size:.82rem;margin:2px}
.g{background:#2f6b3a}.b{background:#8B5E3C}.r{background:var(--blue)}.e{border:1px dashed var(--muted);color:var(--muted)}
.fl{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed var(--line)}
.cta{margin:30px 0 50px;padding:28px;border-radius:20px;border:1px solid var(--amber);background:linear-gradient(135deg,rgba(216,155,74,.2),rgba(20,69,63,.7));text-align:center}
.cta p{color:var(--sand)}footer{text-align:center;color:var(--muted);font-size:.82rem;padding:0 16px 40px}
.stats{display:flex;gap:22px;flex-wrap:wrap;margin-top:22px}.stats b{display:block;font-family:var(--disp);font-size:1.9rem;color:var(--gold)}.stats span{color:var(--muted);font-size:.85rem}
@media(max-width:700px){.feat{grid-template-columns:1fr}.feat:nth-child(even) .txt{order:0}}
"""
FONTS='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">'

def page(title,desc,canon,body,ld):
    return f'''<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title><meta name="description" content="{E(desc)}"><link rel="canonical" href="{canon}">
<meta property="og:type" content="website"><meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}"><meta property="og:image" content="{APP}og-image.png">
<meta name="theme-color" content="#0D2E2C">{FONTS}
<script type="application/ld+json">{json.dumps(ld,ensure_ascii=False)}</script><style>{CSS}</style></head><body>
<header class="top"><div class="w"><a class="brand" href="{APP}">🦦 Cserélj Okosan</a><a class="btn" href="{APP}">Megnyitom</a></div></header>
{body}
<footer>© Cserélj Okosan · <a href="{APP}gyik.html">GYIK</a> · <a href="{APP}okos-funkciok.html">Okos funkciók</a></footer></body></html>'''

# ---------- okos funkciók ----------
FEATS=[
("🎯","Automatikus párosítás","Bejelölöd, mid van duplán és mi hiányzik, az app megmutatja, kivel tudtok cserélni. A kölcsönös egyezések kerülnek előre.",
 '<div class="fl"><span>Te adsz</span><span><span class="chip g">12</span><span class="chip g">47</span><span class="chip g">88</span></span></div><div class="fl"><span>Te kapsz</span><span><span class="chip b">5</span><span class="chip b">63</span><span class="chip b">101</span></span></div>',""),
("⚖️","Szimmetrikus (1:1) csere","Egy szűrővel csak azokat a partnereket látod, akikkel pontosan ugyanannyit tudtok átadni egymásnak. Nincs alkudozás.",
 '<div class="fl"><span>Te adsz</span><b>3 db</b></div><div class="fl"><span>Te kapsz</span><b>3 db</b></div>',""),
("🧮","Többpartneres Csere-Tervező","Több partnert kipipálsz, az Ütközések ellenőrzése pedig megmutatja, ha ugyanazt a duplát többen is kérik. Te döntöd el, kinek adod.",
 '<div class="fl"><span>#45 dupla (1 db)</span><span class="chip b">2 partner kéri</span></div><div class="fl"><span>Döntés</span><b>te választasz</b></div>',"csere-tervezo-szimulator.html"),
("🔄","3 fős körcsere","Ha ketten nem cserélhettek, de hárman igen: te → B → C → te. Az app megtalálja ezeket a köröket.",
 '<div class="fl"><span>Te → Béla</span><span class="chip g">22</span></div><div class="fl"><span>Béla → Csilla</span><span class="chip g">35</span></div><div class="fl"><span>Csilla → Te</span><span class="chip b">9</span></div>',"korcsere-kalkulator.html"),
("📦","Több album, egy boríték","Ha a partnerrel másik közös albumban is cserélhettek, az app jelzi, így egy csomagban küldhetitek, és kevesebb a postaköltség.",
 '<div class="fl"><span>Lutra</span><b>4 db</b></div><div class="fl"><span>Garfield</span><b>3 db</b></div><div class="fl"><span>Postázás</span><b>1 boríték</b></div>',""),
("📷","Fotós számszkenner","Lefotózod a számokat, az AI kiolvassa őket, te átnézed és egy gombbal mented a duplákhoz vagy hiányzókhoz.",
 '<div class="fl"><span>Felismert</span><span>3, 14, 27, 56</span></div><div class="fl"><span>Mentés</span><span class="chip g">Duplák</span></div>',"fotos-matrica-szkenner.html"),
("💬","Facebook poszt elemző","Bemásolod a csoportban talált posztot, az app összeveti a listáddal, és udvarias válaszkommentet fogalmaz.",
 '<div class="fl"><span>Keresem</span><span>3, 12, 45</span></div><div class="fl"><span>Egyezés</span><b>2 tétel</b></div>',"facebook-matrica-csere.html"),
("⌨️","Tömeges bevitel","Írd be egy sorban: <code>1-15, 42*2</code>. Tartományok, darabszámok, egy gombbal mentés.",
 '<div class="fl"><span>Bevitel</span><code>1-15, 42*2</code></div><div class="fl"><span>Eredmény</span><b>17 db</b></div>',""),
("👨‍👩‍👧","Családi mód","Testvéreknek külön füzet ugyanabból az albumból, egyetlen fiókban. Minden füzet külön rácsot kap.",
 '<div class="fl"><span>1. füzet</span><span class="chip g">saját</span></div><div class="fl"><span>2. füzet</span><span class="chip r">testvér</span></div>',""),
("🔒","Lakatvédelem","Az elfogadott cserében szereplő duplák zárolva vannak, így nem ígéred oda ugyanazt kétszer.",
 '<div class="fl"><span>47 (dupla)</span><span class="chip r">🔒 foglalt</span></div>',""),
("🎩","Közös Kalap","Ha nem kérsz cserét, a dupláidat felajánlhatod iskolai osztályoknak és óvodai csoportoknak.",
 '<div class="fl"><span>Felajánlás</span><span class="chip g">ingyen</span></div>',"kozos-kalap.html"),
]
fe="".join(f'<div class="feat" id="f{i}"><div class="txt"><div class="ic">{ic}</div><h2>{E(t)}</h2><p>{d}</p>'+(f'<p><a href="{l}">Részletek →</a></p>' if l else '')+f'</div><div class="vis">{v}</div></div>' for i,(ic,t,d,v,l) in enumerate(FEATS))
cards="".join(f'<a class="card" href="#f{i}" style="text-decoration:none;color:inherit"><div class="ic">{ic}</div><h3>{E(t)}</h3></a>' for i,(ic,t,d,v,l) in enumerate(FEATS))
body=f'''<main><div class="w"><div class="hero"><div class="eyebrow">Okos funkciók</div><h1>Ne keresgélj. Cserélj okosan.</h1>
<p class="lead">Matrica-, kártya- és figuracsere, amely a számolást átveszi helyetted: párosít, ajánlatot készít, és megtalálja azt is, amit magadtól nem találnál meg.</p>
<div class="row"><a class="btn" href="{APP}">Kipróbálom ingyen</a><a class="btn ghost" href="{APP}gyik.html">Gyakori kérdések</a></div></div>
<section><div class="grid">{cards}</div></section>{fe}
<div class="cta"><h2>Készen állsz?</h2><p>Ingyenes. Vendégként is kipróbálhatod, regisztráció nélkül.</p><a class="btn" href="{APP}">Megnyitom az appot →</a></div></div></main>'''
ld={"@context":"https://schema.org","@type":"WebApplication","name":"Cserélj Okosan","url":APP,"applicationCategory":"LifestyleApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":"0","priceCurrency":"HUF"},"inLanguage":"hu"}
os.makedirs(out,exist_ok=True)
open(f"{out}/okos-funkciok.html","w",encoding="utf-8").write(page("Okos funkciók – Cserélj Okosan","Automatikus párosítás, kiegyensúlyozott ajánlat, többpartneres tervező, körcsere és fotós szkenner matrica- és kártyacseréhez.",APP+"okos-funkciok.html",body,ld))

# ---------- album oldalak ----------
SKIP={"lidl-lutra-2026"}   # erre a lutra-album-matrica-csere.html oldal van
def has_page(a): return a["id"] not in SKIP and (a.get("featured") or (a.get("year") or 0)>=MIN_YEAR)
def item_word(a): return "kártya" if a.get("type")=="card" or "Kártya" in (a.get("typeLabel") or "") else "matrica"
def link_for(a): return f"{APP}album-{a['id']}.html" if has_page(a) else (f"{APP}lutra-album-matrica-csere.html" if a["id"] in SKIP else f"{APP}?album={a['id']}")
urls=[APP+"okos-funkciok.html",APP+"albumok.html"]
for a in albums:
    if not has_page(a): continue
    aid=a["id"];t=a["title"];tl=a.get("typeLabel") or "Gyűjtemény";item=item_word(a)
    pub=a.get("publisher") or "";yr=a.get("year") or ""
    n=a.get("totalItems") or 0
    title=f"{t} – {item}csere | Cserélj Okosan"
    adesc=(a.get("description") or "").strip() if a.get("descOriginal") else ""   # csak a saját megfogalmazású leírás kerül nyilvános oldalra
    desc=f"{t}: {n} tételes {tl.lower()}. Jelöld a dupláidat és a hiányzókat, és találd meg a cserepartnereket ingyen."
    if adesc:
        desc=adesc if len(adesc)<=158 else adesc[:155].rsplit(" ",1)[0]+"…"
    chs=[c.get("cim") for c in (a.get("customChaptersList") or []) if c.get("cim")]
    about=""
    if adesc or len(chs)>1:
        about='<section><h2>A gyűjteményről</h2>'
        if adesc: about+=f'<p>{E(adesc)}</p>'
        if len(chs)>1: about+='<p><b>Fejezetek:</b> '+E(", ".join(chs))+'.</p>'
        about+='</section>'

    canon=f"{APP}album-{aid}.html";cta=f"{APP}?album={aid}"
    items=[("📝",f"Jelöld be a {n} tételből, mid van","Dupla, hiányzik, foglalt: egy koppintás, tömegesen számokkal, vagy fotóról."),
           ("🤝","Kapd meg a partnereket","Az app megmutatja, kinek kell a dupláid közül valami, és kinél van, ami hiányzik."),
           ("🔄","Körcsere, ha elakadtok","Ha ketten nem cserélhettek, az app hármas köröket is keres.")]
    cards="".join(f'<div class="card"><div class="ic">{i}</div><h3>{E(x)}</h3><p>{E(y)}</p></div>' for i,x,y in items)
    meta=" · ".join(E(str(x)) for x in (pub,yr,tl) if x)
    rel=[b for b in albums if b["id"]!=aid and b.get("publisher")==a.get("publisher") and b.get("type")==a.get("type")]
    rel.sort(key=lambda b:-(b.get("year") or 0)); rel=rel[:6]
    relhtml=""
    if rel:
        relhtml='<section><h2>Hasonló gyűjtemények</h2><div class="grid">'+"".join(f'<a class="card" href="{link_for(b)}" style="text-decoration:none;color:inherit"><h3>{E(b["title"])}</h3><p>{E(str(b.get("publisher","")))} · {b.get("year","")} · {b.get("totalItems","")} tétel</p></a>' for b in rel)+'</div></section>'
    body=f'''<main><div class="w"><div class="hero"><div class="eyebrow">{meta}</div><h1>{E(t)} {item}csere</h1>
<p class="lead">Ne a csoportokban keresgélj. Jelöld be a dupláidat és a hiányzókat, az app pedig megtalálja, kivel tudtok cserélni.</p>
<div class="stats"><div><b>{n}</b><span>tétel az albumban</span></div><div><b>{E(str(yr))}</b><span>megjelenés éve</span></div></div>
<div class="row"><a class="btn" href="{cta}">Megnyitom ezt az albumot</a><a class="btn ghost" href="{APP}albumok.html">Összes gyűjtemény</a></div></div>
{about}<section><h2>Hogyan működik?</h2><div class="grid">{cards}</div></section>{relhtml}
<div class="cta"><h2>{E(t)}: kezdd el most</h2><p>Ingyenes, regisztráció nélkül is kipróbálhatod.</p><a class="btn" href="{cta}">Indulás →</a></div></div></main>'''
    ld={"@context":"https://schema.org","@type":"WebPage","name":title,"url":canon,"description":desc,"inLanguage":"hu","isPartOf":{"@type":"WebSite","name":"Cserélj Okosan","url":APP}}
    open(f"{out}/album-{aid}.html","w",encoding="utf-8").write(page(title,desc,canon,body,ld))
    urls.append(canon)

# ---------- katalógus oldal: az összes gyűjtemény ----------
groups={}
for a in sorted(albums,key=lambda b:(-(b.get("year") or 0),b["title"].lower())):
    groups.setdefault(a.get("year") or 0,[]).append(a)
sec=""
for y in sorted(groups,reverse=True):
    sec+=f'<section><h2>{y}</h2><div class="grid">'+"".join(f'<a class="card" href="{link_for(b)}" style="text-decoration:none;color:inherit"><div class="eyebrow">{E(b.get("typeLabel") or "")}</div><h3>{E(b["title"])}</h3><p>{E(str(b.get("publisher","")))} · {b.get("totalItems","")} tétel</p></a>' for b in groups[y])+'</div></section>'
body=f'''<main><div class="w"><div class="hero"><div class="eyebrow">Gyűjtemények</div><h1>Matrica- és kártyagyűjtemények</h1>
<p class="lead">{len(albums)} gyűjtemény, amelyhez jelölheted a dupláidat és a hiányzóidat. Válassz egyet, és találd meg a cserepartnereket.</p></div>{sec}
<div class="cta"><h2>Hiányzik egy gyűjtemény?</h2><p>Az appban az Új gyűjtemény javaslata gombbal beküldheted.</p><a class="btn" href="{APP}">Megnyitom az appot →</a></div></div></main>'''
ld={"@context":"https://schema.org","@type":"CollectionPage","name":"Matrica- és kártyagyűjtemények","url":APP+"albumok.html","inLanguage":"hu"}
open(f"{out}/albumok.html","w",encoding="utf-8").write(page("Matrica- és kártyagyűjtemények – Cserélj Okosan","Az összes gyűjtemény egy helyen: matricaalbumok és kártyák, amelyekhez ingyen cserepartnert találhatsz.",APP+"albumok.html",body,ld))
open(f"{out}/sitemap_landing.xml","w",encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+"".join(f"<url><loc>{u}</loc></url>\n" for u in urls)+"</urlset>\n")
print("kész:",sum(1 for a in albums if has_page(a)),"album oldal + katalógus ("+str(len(albums))+" gyűjtemény) + okos-funkciok")
