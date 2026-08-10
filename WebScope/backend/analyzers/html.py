import json,re
from collections import Counter
from urllib.parse import urljoin
from bs4 import BeautifulSoup
API_RE=re.compile(r"(?:https?://[^\s\"'`<>]+|/(?:api|graphql|rest|v\d+)(?:/[A-Za-z0-9_./:{}$?=&%-]*)?)",re.I)

def analyze_html(html,base_url,extract_scripts=True):
    s=BeautifulSoup(html,"lxml"); title=s.title.get_text(" ",strip=True) if s.title else None
    meta={}
    for t in s.find_all("meta"):
        k=t.get("name") or t.get("property"); v=t.get("content")
        if k and v: meta[k]=v
    can=s.find("link",rel=lambda x:x and "canonical" in x); canonical=urljoin(base_url,can.get("href")) if can and can.get("href") else None
    headings=[{"level":int(t.name[1]),"text":t.get_text(" ",strip=True)} for t in s.find_all(re.compile(r"^h[1-6]$")) if t.get_text(" ",strip=True)]
    links=[{"url":urljoin(base_url,t["href"]),"text":t.get_text(" ",strip=True)[:300],"rel":t.get("rel",[])} for t in s.find_all("a",href=True)]
    images=[{"url":urljoin(base_url,t.get("src")),"alt":t.get("alt")} for t in s.find_all("img",src=True)]
    forms=[]
    for f in s.find_all("form"):
        fields=[{"tag":x.name,"name":x.get("name"),"type":x.get("type"),"value":x.get("value"),"placeholder":x.get("placeholder")} for x in f.find_all(["input","select","textarea","button"])]
        forms.append({"method":(f.get("method") or "GET").upper(),"action":urljoin(base_url,f.get("action") or base_url),"fields":fields})
    tables=[]
    for t in s.find_all("table"):
        rows=[]
        for tr in t.find_all("tr"):
            cells=[c.get_text(" ",strip=True) for c in tr.find_all(["th","td"])]
            if cells:rows.append(cells)
        if rows:tables.append({"rows":rows[:100]})
    jsonld=[]; embedded=[]
    for t in s.find_all("script"):
        raw=t.string or t.get_text(); typ=(t.get("type") or "").lower()
        if "ld+json" in typ:
            try:jsonld.append(json.loads(raw))
            except Exception:jsonld.append({"_parse_error":True,"raw":raw[:10000]})
        elif raw and len(raw)<2000000 and raw.strip().startswith(("{","[")):
            try:
                v=json.loads(raw.strip())
                if isinstance(v,(dict,list)):embedded.append(v)
            except Exception:pass
    scripts=[]; refs=[]
    if extract_scripts:
        scripts=[urljoin(base_url,t["src"]) for t in s.find_all("script",src=True)]
        for t in s.find_all("script"):
            for m in API_RE.findall(t.string or t.get_text() or ""):refs.append({"reference":m,"source":"inline-script","confidence":.65})
    for x in links:
        if "/api/" in x["url"].lower() or "/graphql" in x["url"].lower():refs.append({"reference":x["url"],"source":"link","confidence":.8})
    assets=[]
    for tag,attr,kind in [("script","src","script"),("link","href","stylesheet"),("video","src","video"),("audio","src","audio"),("source","src","media")]:
        for t in s.find_all(tag,**{attr:True}):assets.append({"type":kind,"url":urljoin(base_url,t.get(attr))})
    return {"metadata":{"title":title,"description":meta.get("description"),"language":s.html.get("lang") if s.html else None,"canonical":canonical,"meta":meta},"headings":headings[:300],"links":links[:2000],"forms":forms[:100],"images":images[:2000],"tables":tables[:100],"structured_data":{"json_ld":jsonld[:100],"embedded_json":embedded[:100]},"scripts":scripts[:500],"assets":assets[:2000],"api_references":dedupe(refs)[:500],"repeated_structures":repeated(s),"technology":technology(s,html),"text_stats":{"characters":len(s.get_text("\n",strip=True)),"words":len(s.get_text(" ",strip=True).split())}}

def repeated(s):
    c=Counter(); ex={}
    for n in s.find_all(True):
        cls=[x for x in n.get("class",[]) if re.fullmatch(r"[A-Za-z0-9_-]{2,80}",x)]
        if not cls:continue
        sel=n.name+"."+".".join(cls[:3]); c[sel]+=1; ex.setdefault(sel,n.get_text(" ",strip=True)[:180])
    return [{"selector":k,"occurrences":v,"example_text":ex[k]} for k,v in c.most_common(50) if v>=3]

def technology(s,html):
    low=html.lower(); found=set()
    sig={"Next.js":["__next_data__","/_next/","next/static"],"Nuxt":["__nuxt__","/_nuxt/"],"WordPress":["wp-content","wp-includes"],"Shopify":["cdn.shopify.com","shopify"],"React":["data-reactroot","__react"],"Vue":["data-v-"],"Angular":["ng-version","ng-app"],"Bootstrap":["bootstrap.min.css","bootstrap.css"],"Tailwind CSS":["tailwindcss","tailwind.css"]}
    for name,needles in sig.items():
        if any(n in low for n in needles):found.add(name)
    g=s.find("meta",attrs={"name":re.compile("^generator$",re.I)})
    if g and g.get("content"):found.add(g["content"])
    return sorted(found)

def dedupe(items):
    seen=set();out=[]
    for x in items:
        k=json.dumps(x,sort_keys=True,ensure_ascii=False)
        if k not in seen:seen.add(k);out.append(x)
    return out
