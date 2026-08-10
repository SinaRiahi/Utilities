from pydantic import BaseModel, Field, HttpUrl

class ScanOptions(BaseModel):
    ignore_robots: bool = False
    browser_mode: bool = True
    max_response_bytes: int = Field(default=20_000_000, ge=100_000, le=100_000_000)
    timeout_seconds: float = Field(default=30, ge=5, le=120)
    wait_seconds: float = Field(default=2, ge=0, le=15)
    max_network_items: int = Field(default=300, ge=25, le=2000)
    extract_script_references: bool = True

class ScanRequest(BaseModel):
    url: HttpUrl
    options: ScanOptions = Field(default_factory=ScanOptions)

class ReplayRequest(BaseModel):
    scan_id: str
    url: HttpUrl
