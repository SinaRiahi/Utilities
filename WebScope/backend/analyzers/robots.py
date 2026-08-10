from urllib.parse import urljoin,urlparse
import httpx
async def inspect_robots(client,url):
    p=urlparse(url); robots_url=urljoin(f"{p.scheme}://{p.netloc}/","robots.txt")
    r={"url":robots_url,"found":False,"status":None,"raw":"","rules":[],"url_allowed":None}
    try:
        x=await client.get(robots_url,follow_redirects=True); r["status"]=x.status_code
        if x.status_code>=400:return r
        r["found"]=True; r["raw"]=x.text[:200000]
        agents=[]
        for raw in x.text.splitlines():
            line=raw.split("#",1)[0].strip()
            if not line or ":" not in line: continue
            k,v=line.split(":",1); k=k.strip().lower(); v=v.strip()
            if k=="user-agent": agents=[v]
            elif k in {"allow","disallow"} and agents:
                for a in agents:r["rules"].append({"user_agent":a,"directive":k,"path":v})
        r["url_allowed"]=robots_allows(url,r["rules"]); return r
    except Exception as e:r["error"]=str(e); return r

def robots_allows(url,rules):
    path=urlparse(url).path or "/"
    applicable=[x for x in rules if x["user_agent"] in {"*","webscope","WebScope"}]
    matches=[(len(x["path"]),x["directive"]) for x in applicable if x["path"] and path.startswith(x["path"])]
    if not matches:return True
    matches.sort(reverse=True); return matches[0][1]=="allow"
