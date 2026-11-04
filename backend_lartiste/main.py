from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
from routers import export
from routers import purchases, deliveries, invoices, dashboard, clients

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Product Management System", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://med-gelato.vercel.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(purchases.router)
app.include_router(deliveries.router)
app.include_router(invoices.router)
app.include_router(dashboard.router)
app.include_router(clients.router)
app.include_router(export.router)
@app.get("/")
def root():
    return {"status": "running", "docs": "/docs"}
