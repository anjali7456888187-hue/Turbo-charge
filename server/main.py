import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("turbo-charge-server")

app = FastAPI(title="Turbo Charge Live Status API", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("DASHBOARD_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

API_TOKEN = os.getenv("DASHBOARD_API_TOKEN", "")
if not API_TOKEN:
    logger.warning("DASHBOARD_API_TOKEN is not configured; authenticated publishing is disabled.")

class StatusUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=80)
    message: str = Field(default="", max_length=500)

class ConnectionManager:
    def __init__(self) -> None:
        self.active: set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self.lock:
            self.active.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self.lock:
            self.active.discard(websocket)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        async with self.lock:
            peers = list(self.active)
        stale: list[WebSocket] = []
        for peer in peers:
            try:
                await peer.send_text(json.dumps(payload))
            except Exception:
                stale.append(peer)
        for peer in stale:
            await self.disconnect(peer)

manager = ConnectionManager()
state: dict[str, Any] = {
    "status": "Waiting",
    "message": "Server is ready.",
    "updated_at": datetime.now(timezone.utc).isoformat(),
}

def snapshot() -> dict[str, Any]:
    return dict(state)

def require_token(authorization: str | None = Header(default=None)) -> None:
    if not API_TOKEN or authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/api/status")
async def get_status() -> dict[str, Any]:
    return snapshot()

@app.post("/api/status")
async def update_status(update: StatusUpdate, _: None = Depends(require_token)) -> dict[str, Any]:
    state.update(
        status=update.status,
        message=update.message,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    payload = {"type": "STATE_UPDATE", "data": snapshot()}
    await manager.broadcast(payload)
    return {"status": "success", "data": snapshot()}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    # Anonymous connections are read-only. A supplied token must be valid.
    token = websocket.query_params.get("token", "")
    if token and (not API_TOKEN or token != API_TOKEN):
        await websocket.close(code=1008)
        return

    await manager.connect(websocket)
    try:
        await websocket.send_text(json.dumps({"type": "INIT_STATE", "data": snapshot()}))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket error")
    finally:
        await manager.disconnect(websocket)
