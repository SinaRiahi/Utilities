import json,re
from urllib.parse import urlparse
API_PATH_RE=re.compile(r"/(?:api|graphql|rest|ajax|rpc|v\d+)(?:/|$)",re.I)
def classify(resources,page_url):
    rest=[];graphql=[];external=[];other=[];host=urlparse(page_url).netloc
    for x in resources:
        u=x.get("url","");p=urlparse(u);path=p.path or "";low=u.lower()
        if "graphql" in low:graphql.append({**x,"kind":"graphql","confidence":.9})
        elif API_PATH_RE.search(path):rest.append({**x,"kind":"rest_candidate","confidence":.85})
        elif p.netloc and p.netloc!=host:external.append({**x,"kind":"external","confidence":.8})
        else:other.append({**x,"kind":"resource"})
    return {"rest_candidates":dedupe(rest),"graphql_candidates":dedupe(graphql),"external_services":dedupe(external),"other_resources":dedupe(other)}
def dedupe(items):
    seen=set();out=[]
    for x in items:
        k=json.dumps({k:x.get(k) for k in ("url","method","status","content_type")},sort_keys=True)
        if k not in seen:seen.add(k);out.append(x)
    return out
