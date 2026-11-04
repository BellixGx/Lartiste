from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from collections import defaultdict
from database import get_db
import models, schemas

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/", response_model=schemas.DashboardOut)
def get_dashboard(db: Session = Depends(get_db)):
    purchases = db.query(models.Purchase).all()
    deliveries = db.query(models.Delivery).all()

    total_purchased = sum(p.total for p in purchases)
    total_paid = sum(p.total for p in purchases if p.paid)
    total_unpaid = total_purchased - total_paid
    total_delivered = sum(d.total for d in deliveries)
    stock_balance = total_purchased - total_delivered
    unique_clients = len(set(d.client for d in deliveries))

    # Deliveries grouped by product — sum quantity
    del_by_product = defaultdict(lambda: {"qty": 0, "unit": ""})
    for d in deliveries:
        del_by_product[d.product]["qty"] += d.quantity
        del_by_product[d.product]["unit"] = d.unit

    # Purchases grouped by product — sum total MAD
    pur_by_product = defaultdict(float)
    for p in purchases:
        pur_by_product[p.product] += p.total

    return schemas.DashboardOut(
        total_purchased=round(total_purchased, 2),
        total_paid=round(total_paid, 2),
        total_unpaid=round(total_unpaid, 2),
        total_delivered=round(total_delivered, 2),
        stock_balance=round(stock_balance, 2),
        unique_clients=unique_clients,
        deliveries_by_product={k: v for k, v in del_by_product.items()},
        purchases_by_product=dict(pur_by_product),
    )
