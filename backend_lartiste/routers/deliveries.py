from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import List, Optional
from datetime import date as date_type
from database import get_db
import models, schemas

router = APIRouter(prefix="/deliveries", tags=["deliveries"])


@router.get("/", response_model=List[schemas.DeliveryOut])
def get_all(day: Optional[date_type] = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(models.Delivery)
    if day:
        query = query.filter(models.Delivery.date == day)
    return query.order_by(models.Delivery.date.desc(), models.Delivery.id.desc()).all()


@router.get("/clients-by-date")
def get_clients_by_date(day: date_type = Query(...), db: Session = Depends(get_db)):
    rows = db.query(models.Delivery.client).filter(models.Delivery.date == day).distinct().all()
    return [r[0] for r in rows]


@router.get("/clients-by-range")
def get_clients_by_range(
    date_from: Optional[date_type] = Query(default=None),
    date_to: Optional[date_type] = Query(default=None),
    db: Session = Depends(get_db)
):
    """Return distinct clients in a date range. If both null, returns all clients."""
    query = db.query(models.Delivery.client)
    if date_from:
        query = query.filter(models.Delivery.date >= date_from)
    if date_to:
        query = query.filter(models.Delivery.date <= date_to)
    rows = query.distinct().all()
    return sorted([r[0] for r in rows])


@router.get("/active-dates")
def get_active_dates(year: int = Query(...), month: int = Query(...), db: Session = Depends(get_db)):
    rows = (
        db.query(models.Delivery.date)
        .filter(
            extract('year', models.Delivery.date) == year,
            extract('month', models.Delivery.date) == month,
        )
        .distinct().all()
    )
    return [r[0].day for r in rows]


@router.post("/", response_model=schemas.DeliveryOut)
def create(d: schemas.DeliveryCreate, db: Session = Depends(get_db)):
    obj = models.Delivery(**d.dict(), total=round(d.quantity * d.unit_price, 2))
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=schemas.DeliveryOut)
def update(id: int, data: schemas.DeliveryCreate, db: Session = Depends(get_db)):
    d = db.query(models.Delivery).filter(models.Delivery.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")
    for k, v in data.dict().items():
        setattr(d, k, v)
    d.total = round(data.quantity * data.unit_price, 2)
    db.commit()
    db.refresh(d)
    return d


@router.delete("/{id}")
def delete(id: int, db: Session = Depends(get_db)):
    d = db.query(models.Delivery).filter(models.Delivery.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")
    db.delete(d)
    db.commit()
    return {"ok": True}