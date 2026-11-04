from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("/", response_model=List[schemas.ClientOut])
def get_all(db: Session = Depends(get_db)):
    return db.query(models.Client).order_by(models.Client.name).all()


@router.post("/", response_model=schemas.ClientOut)
def create(c: schemas.ClientCreate, db: Session = Depends(get_db)):
    # Auto-generate code if not provided
    if not c.code or not c.code.strip():
        last = db.query(models.Client).order_by(models.Client.id.desc()).first()
        if last:
            try:
                seq = int(last.code) + 1
            except Exception:
                seq = db.query(models.Client).count() + 1
        else:
            seq = 1
        c = c.model_copy(update={'code': str(seq).zfill(2)})

    existing = db.query(models.Client).filter(models.Client.code == c.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Client code already exists")
    obj = models.Client(**c.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{id}", response_model=schemas.ClientOut)
def update(id: int, data: schemas.ClientCreate, db: Session = Depends(get_db)):
    c = db.query(models.Client).filter(models.Client.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    for k, v in data.dict().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{id}")
def delete(id: int, db: Session = Depends(get_db)):
    c = db.query(models.Client).filter(models.Client.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(c)
    db.commit()
    return {"ok": True}
