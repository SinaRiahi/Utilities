import time,httpx
from .security import validate_public_http_url
from .analyzers.robots import inspect_robots
from .analyzers.html import analyze_html
from .analyzers.browser import browser_scan
from .analyzers.network import classify
class SiteAnalyzer:
    async def analyze(self,url,options,progress=None):
        validate_public_http_url(url);start=time.time()
        def emit(stage,msg,pct):
            if progress:progress(stage,msg,pct)
        emit("prepare","Preparing analysis",3)
        async with httpx.AsyncClient(headers={"User-Agent":"WebScope/0.1 local website analysis","Accept":"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"},timeout=httpx.Timeout(options.timeout_seconds),follow_redirects=True,limits=httpx.Limits(max_connections=8,max_keepalive_connections=4)) as client:
            emit("robots","Checking robots.txt",8);robots=await inspect_robots(client,url)
            if robots.get("found") and robots.get("url_allowed") is False and not options.ignore_robots:
                return {"version":"0.1","blocked":True,"block_reason":"robots.txt disallows the supplied URL.","input":{"url":url},"robots":robots,"duration_seconds":round(time.time()-start,2)}
            emit("http","Fetching supplied URL",15);resp=await client.get(url);resp.raise_for_status();body=resp.content[:options.max_response_bytes];ctype=resp.headers.get("content-type","")
            result={"version":"0.1","blocked":False,"input":{"url":url,"options":options.model_dump()},"http":{"status":resp.status_code,"final_url":str(resp.url),"content_type":ctype,"content_length":len(resp.content),"headers":dict(resp.headers)},"robots":robots,"html":{},"browser":{},"network":{},"api_inventory":{},"summary":{},"duration_seconds":0}
            if "html" in ctype.lower() or body.lstrip().startswith(b"<"):
                text=body.decode(resp.encoding or "utf-8",errors="replace");emit("html","Analyzing HTML and structured data",28);result["html"]=analyze_html(text,str(resp.url),options.extract_script_references)
                if options.browser_mode:
                    emit("browser","Inspecting rendered page",42);b=await browser_scan(str(resp.url),options.wait_seconds,options.max_network_items)
                    result["browser"]={k:b.get(k) for k in ("available","browser_url","page_title","websockets","errors","resources")}
                    if b.get("html"):
                        emit("rendered","Analyzing rendered DOM",58);result["html"]["rendered"]=analyze_html(b["html"],b.get("browser_url") or str(resp.url),options.extract_script_references)
                    result["network"]=classify(b.get("resources",[]),str(resp.url))
            emit("inventory","Building API and data inventory",76);result["api_inventory"]=build_api(result)
            emit("summary","Organizing site model",92);result["summary"]=summary(result);result["duration_seconds"]=round(time.time()-start,2);emit("done","Analysis complete",100);return result

def build_api(r):
    refs=r.get("html",{}).get("api_references",[])+r.get("html",{}).get("rendered",{}).get("api_references",[]);n=r.get("network",{});rest=[];graphql=[]
    for x in refs:
        v=x.get("reference","");lo=v.lower()
        if "graphql" in lo:graphql.append({**x,"observed":False})
        elif any(z in lo for z in ("/api/","/rest/","/ajax/","/rpc/")):rest.append({**x,"observed":False})
    for x in n.get("rest_candidates",[]):rest.append({"url":x.get("url"),"method":x.get("method","GET"),"initiator_type":x.get("initiator_type"),"observed":True,"confidence":x.get("confidence",.85)})
    for x in n.get("graphql_candidates",[]):graphql.append({"url":x.get("url"),"method":x.get("method","GET"),"observed":True,"confidence":x.get("confidence",.9)})
    return {"rest":dedupe_api(rest),"graphql":dedupe_api(graphql)}
def summary(r):
    h=r.get("html",{});rr=h.get("rendered",{});n=r.get("network",{});a=r.get("api_inventory",{});ld=h.get("structured_data",{}).get("json_ld",[])
    return {"page_type_hint":page_type(ld,h.get("metadata",{}).get("title")),"title":h.get("metadata",{}).get("title"),"links":len(h.get("links",[])),"images":len(h.get("images",[])),"forms":len(h.get("forms",[])),"tables":len(h.get("tables",[])),"scripts":len(h.get("scripts",[])),"structured_json_ld":len(ld),"embedded_json":len(h.get("structured_data",{}).get("embedded_json",[])),"repeated_structures":len(h.get("repeated_structures",[])),"network_resources":len(r.get("browser",{}).get("resources",[])),"rest_candidates":len(a.get("rest",[])),"graphql_candidates":len(a.get("graphql",[])),"external_services":len(n.get("external_services",[])),"technologies":sorted(set(h.get("technology",[])+rr.get("technology",[]))),"websockets_observed":len(r.get("browser",{}).get("websockets",[]))}
def page_type(data,title):
    vals=[]
    def walk(v):
        if isinstance(v,dict):
            if "@type" in v:vals.append(str(v["@type"]).lower())
            for x in v.values():walk(x)
        elif isinstance(v,list):
            for x in v:walk(x)
    walk(data);j=" ".join(vals)
    for typ,name in (("product","product"),("article","article"),("newsarticle","article"),("person","profile"),("organization","organization")):
        if typ in j:return name
    return "likely product" if any(x in (title or "").lower() for x in ("product","محصول")) else "unknown"
def dedupe_api(items):
    seen=set();out=[]
    for x in items:
        k=(x.get("url") or x.get("reference"),x.get("method","GET"))
        if k not in seen:seen.add(k);out.append(x)
    return out[:1000]
