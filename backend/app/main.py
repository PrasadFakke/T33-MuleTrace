from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db import ensure_database_initialized
from app.routes.dashboard import router as dashboard_router
from app.routes.alerts import router as alerts_router
from app.routes.accounts import router as accounts_router
from app.routes.investigations import router as investigations_router
from app.routes.analytics import router as analytics_router
from app.routes.settings_routes import router as settings_router
from app.routes.chat_routes import router as chat_router

from app.routes.ingestion import router as ingestion_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure SQLite database is present and initialized on startup
    try:
        ensure_database_initialized()
    except Exception as e:
        print(f"[Warning] Database auto-initialization deferred: {e}")
    yield

app = FastAPI(
    title="MuleTrace AML & Fraud Investigation Platform API",
    description="High-performance fintech backend for mule account detection and bipartite network analysis",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for local React/Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(dashboard_router)
app.include_router(alerts_router)
app.include_router(accounts_router)
app.include_router(investigations_router)
app.include_router(analytics_router)
app.include_router(settings_router)
app.include_router(chat_router)
app.include_router(ingestion_router)

@app.get("/")
def root():
    return {
        "platform": "MuleTrace",
        "status": "ONLINE",
        "version": "1.0.0",
        "description": "Fintech AML & Mule Detection Engine for RBI Innovation Challenge"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}
