from sqlalchemy import Column, Integer, String, Float, Boolean, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base


class Client(Base):
    __tablename__ = "clients"
    id      = Column(Integer, primary_key=True, index=True)
    code    = Column(String(50), unique=True, nullable=False)
    name    = Column(String(200), nullable=False)
    address = Column(String(300), default="")
    phone   = Column(String(50), default="")
    email   = Column(String(200), default="")
    notes   = Column(Text, default="")


class Purchase(Base):
    __tablename__ = "purchases"
    id         = Column(Integer, primary_key=True, index=True)
    date       = Column(Date, nullable=True)
    product    = Column(String(200), nullable=False)
    supplier   = Column(String(200), nullable=False)
    quantity   = Column(Float, default=0)
    unit       = Column(String(50), default="")
    unit_price = Column(Float, default=0)
    total      = Column(Float, default=0)
    paid       = Column(Boolean, default=False)
    notes      = Column(Text, default="")


class Delivery(Base):
    __tablename__ = "deliveries"
    id         = Column(Integer, primary_key=True, index=True)
    date       = Column(Date, nullable=True)   # optional — can be null
    client     = Column(String(200), nullable=False)
    address    = Column(String(300), default="")
    product    = Column(String(200), nullable=False)
    quantity   = Column(Float, default=0)
    unit       = Column(String(50), default="")
    unit_price = Column(Float, default=0)
    total      = Column(Float, default=0)
    notes      = Column(Text, default="")


class Invoice(Base):
    __tablename__ = "invoices"
    id             = Column(Integer, primary_key=True, index=True)
    number         = Column(String(100), unique=True, nullable=False)
    client         = Column(String(200), nullable=False)
    client_code    = Column(String(50), default="")
    client_address = Column(String(300), default="")
    invoice_type   = Column(String(20), default="single_day")  # single_day | range | all_time
    delivery_date  = Column(Date, nullable=True)   # for single_day
    date_from      = Column(Date, nullable=True)   # for range / all_time
    date_to        = Column(Date, nullable=True)   # for range / all_time
    total          = Column(Float, default=0)
    created_at     = Column(Date, nullable=False)
    payment_method = Column(String(100), default="Espèce")
    items          = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id         = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    ref        = Column(String(50), default="")
    date       = Column(Date)
    product    = Column(String(200))
    address    = Column(String(300), default="")
    quantity   = Column(Float, default=0)
    unit       = Column(String(50), default="")
    unit_price = Column(Float, default=0)
    total      = Column(Float, default=0)
    invoice    = relationship("Invoice", back_populates="items")