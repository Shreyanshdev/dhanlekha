from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import product, demand, voice, suggestions, health

app = FastAPI(
    title="DhanLekha AI Service",
    description="AI-powered product parsing, voice billing, and demand prediction for DhanLekha ERP",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(health.router, prefix="/ai", tags=["Health"])
app.include_router(product.router, prefix="/ai", tags=["Product"])
app.include_router(voice.router, prefix="/ai", tags=["Voice"])
app.include_router(suggestions.router, prefix="/ai", tags=["Suggestions"])
app.include_router(demand.router, prefix="/ai", tags=["Demand"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
