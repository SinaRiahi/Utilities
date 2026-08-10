import asyncio,uuid
from pathlib import Path
import httpx
from fastapi import FastAPI,HTTPException
from fastapi.responses import FileResponse,JSONResponse
from fastapi.staticfiles import StaticFiles
from .models import ScanRequest,ReplayRequest
from .analyzer import SiteAnalyzer
from .security import validate_public_http_url,same_origin
BASE=Path(__file__).resolve().parent.parent;FRONT=BASE/"frontend"
app=FastAPI(title="WebScope",version="0.1.0");app.mount("/assets",StaticFiles(directory=FRONT),name="assets")
analyzer=SiteAnalyzer();scans={}
@app.get("/",include_in_schema=False)
async def index():return FileResponse(FRONT/"index.html")
@app.get("/api/health")
async def health():return {"ok":True,"name":"WebScope","version":"0.1.0"}
@app.post("/api/scans")
async def create_scan(req:ScanRequest):
    url=str(req.url)
    try:validate_public_http_url(url)
    except ValueError as e:raise HTTPException(400,str(e))
    sid=uuid.uuid4().hex[:12];scans[sid]={"id":sid,"status":"queued","progress":0,"stage":"queued","message":"Waiting to start","result":None,"error":None};asyncio.create_task(run_scan(sid,url,req.options));return {"scan_id":sid}
async def run_scan(sid,url,options):
    def progress(stage,message,percent):scans[sid].update(status="running" if percent<100 else "complete",stage=stage,message=message,progress=percent)
    try:
        result=await analyzer.analyze(url,options,progress);scans[sid].update(status="complete",progress=100,stage="done",message="Analysis complete",result=result)
    except Exception as e:scans[sid].update(status="error",stage="error",message=str(e),error=str(e))
@app.get("/api/scans/{sid}")
async def get_scan(sid:str):
    if sid not in scans:raise HTTPException(404,"Scan not found")
    return scans[sid]
@app.get("/api/scans/{sid}/export")
async def export_scan(sid:str):
    if sid not in scans or not scans[sid].get("result"):raise HTTPException(404,"Completed scan not found")
    return JSONResponse(scans[sid]["result"],headers={"Content-Disposition":f'attachment; filename="webscope-{sid}.json"'})
@app.post("/api/replay-get")
async def replay_get(req:ReplayRequest):
    scan=scans.get(req.scan_id)
    if not scan or not scan.get("result"):raise HTTPException(404,"Completed scan not found")
    base=scan["result"].get("http",{}).get("final_url");target=str(req.url)
    if not base or not same_origin(base,target):raise HTTPException(400,"Replay is restricted to the scanned page origin.")
    try:validate_public_http_url(target)
    except ValueError as e:raise HTTPException(400,str(e))
    try:
        async with httpx.AsyncClient(timeout=20,follow_redirects=True,headers={"User-Agent":"WebScope/0.1 local request inspection"}) as c:r=await c.get(target)
        return {"status":r.status_code,"url":str(r.url),"content_type":r.headers.get("content-type"),"headers":dict(r.headers),"body_preview":r.text[:100000]}
    except Exception as e:raise HTTPException(502,str(e))
@app.get("/api/config")
async def config():return {"name":"WebScope","version":"0.1.0","features":{"robots":True,"rest_api_detection":True,"graphql_detection":True,"websocket_observation":True,"websocket_message_analysis":False,"crawler":False,"llm":False,"scraper_generation":False}}
