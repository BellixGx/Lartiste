from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import List, Optional
from datetime import date as date_type
from database import get_db
import models, schemas

router = APIRouter(prefix="/purchases", tags=["purchases"])


@router.get("/", response_model=List[schemas.PurchaseOut])
def get_all(
    day: Optional[date_type] = Query(default=None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Purchase)
    if day:
        query = query.filter(models.Purchase.date == day)
    return query.order_by(models.Purchase.date.desc(), models.Purchase.id.desc()).all()


# ⚠️ MUST be before /{id} routes so FastAPI doesn't treat "active-dates" as an id
@router.get("/active-dates")
def get_active_dates(year: int = Query(...), month: int = Query(...), db: Session = Depends(get_db)):
    rows = (
        db.query(models.Purchase.date)
        .filter(
            models.Purchase.date.isnot(None),
            extract('year', models.Purchase.date) == year,
            extract('month', models.Purchase.date) == month,
        )
        .distinct()
        .all()
    )
    return [r[0].day for r in rows]


@router.post("/", response_model=schemas.PurchaseOut)
def create(p: schemas.PurchaseCreate, db: Session = Depends(get_db)):
    obj = models.Purchase(**p.dict(), total=round(p.quantity * p.unit_price, 2))
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=schemas.PurchaseOut)
def update(id: int, data: schemas.PurchaseCreate, db: Session = Depends(get_db)):
    p = db.query(models.Purchase).filter(models.Purchase.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Purchase not found")
    for k, v in data.dict().items():
        setattr(p, k, v)
    p.total = round(data.quantity * data.unit_price, 2)
    db.commit()
    db.refresh(p)
    return p


@router.patch("/{id}/paid", response_model=schemas.PurchaseOut)
def toggle_paid(id: int, db: Session = Depends(get_db)):
    p = db.query(models.Purchase).filter(models.Purchase.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Purchase not found")
    p.paid = not p.paid
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{id}")
def delete(id: int, db: Session = Depends(get_db)):
    p = db.query(models.Purchase).filter(models.Purchase.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Purchase not found")
    db.delete(p)
    db.commit()
    return {"ok": True}