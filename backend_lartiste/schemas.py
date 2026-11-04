from pydantic import BaseModel
from typing import Optional, List
from datetime import date as date_type


class ClientCreate(BaseModel):
    code: str
    name: str
    address: str = ""
    phone: str = ""
    email: str = ""
    notes: str = ""

class ClientOut(ClientCreate):
    id: int
    class Config:
        from_attributes = True


class PurchaseCreate(BaseModel):
    date: Optional[date_type] = None
    product: str
    supplier: str
    quantity: float = 0
    unit: str = ""
    unit_price: float = 0
    paid: bool = False
    notes: str = ""

class PurchaseOut(PurchaseCreate):
    id: int
    total: float
    class Config:
        from_attributes = True


class DeliveryCreate(BaseModel):
    date: Optional[date_type] = None
    client: str
    address: str = ""
    product: str
    quantity: float = 0
    unit: str = ""
    unit_price: float = 0
    notes: str = ""

class DeliveryOut(DeliveryCreate):
    id: int
    total: float
    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    number: str = ""
    client: str
    client_code: str = ""
    client_address: str = ""
    invoice_type: str = "single_day"   # single_day | range | all_time
    delivery_date: Optional[date_type] = None
    date_from: Optional[date_type] = None
    date_to: Optional[date_type] = None
    payment_method: str = "Espèce"

class InvoiceItemOut(BaseModel):
    id: int
    ref: Optional[str]
    date: Optional[date_type]
    product: Optional[str]
    address: Optional[str]
    quantity: float
    unit: Optional[str]
    unit_price: float
    total: float
    class Config:
        from_attributes = True

class InvoiceOut(BaseModel):
    id: int
    number: str
    client: str
    client_code: str
    client_address: str
    invoice_type: str
    delivery_date: Optional[date_type]
    date_from: Optional[date_type]
    date_to: Optional[date_type]
    total: float
    created_at: date_type
    payment_method: str
    items: List[InvoiceItemOut] = []
    class Config:
        from_attributes = True


class DashboardOut(BaseModel):
    total_purchased: float
    total_paid: float
    total_unpaid: float
    total_delivered: float
    stock_balance: float
    unique_clients: int
    deliveries_by_product: dict
    purchases_by_product: dict