import json,logging
log=logging.getLogger(__name__)
async def browser_scan(url,wait_seconds=2,max_network_items=300):
    out={"available":False,"browser_url":None,"page_title":None,"html":None,"resources":[],"websockets":[],"errors":[]}
    try: import nodriver as uc
    except Exception as e:out["errors"].append(f"nodriver unavailable: {e}");return out
    browser=None
    try:
        browser=await uc.start(headless=True)
        tab=await browser.get(url);out["available"]=True
        if wait_seconds:await tab.sleep(wait_seconds)
        try:out["html"]=await tab.get_content()
        except Exception as e:out["errors"].append(f"Rendered HTML unavailable: {e}")
        try:out["browser_url"]=str(getattr(tab,"url",None) or url)
        except Exception:out["browser_url"]=url
        try:out["page_title"]=await tab.evaluate("document.title")
        except Exception:pass
        try:
            raw=await tab.evaluate("JSON.stringify(performance.getEntriesByType('resource').map(r=>({url:r.name,initiator_type:r.initiatorType||null,duration:r.duration||null,transfer_size:r.transferSize||null,encoded_body_size:r.encodedBodySize||null,decoded_body_size:r.decodedBodySize||null})))")
            out["resources"]=json.loads(raw or "[]")[:max_network_items]
        except Exception as e:out["errors"].append(f"Resource inspection failed: {e}")
        out["websockets"]=[x for x in out["resources"] if x.get("url","").startswith(("ws://","wss://"))]
    except Exception as e:out["errors"].append(f"Browser scan failed: {e}");log.exception("browser scan")
    finally:
        if browser is not None:
            try:browser.stop()
            except Exception:pass
    return out
