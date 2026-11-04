# Product Management System

Local product purchase, delivery & invoice management system.
**Stack:** FastAPI + SQLite (backend) · React + Vite + TailwindCSS (frontend)

---

## 🚀 Quick Start

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

Backend runs at → http://localhost:8000
API docs (Swagger) → http://localhost:8000/docs

---

### 2. Frontend

Open a **second terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at → http://localhost:5173

---

## 📁 Project Structure

```
system/
├── backend/
│   ├── main.py              ← FastAPI app, CORS, router registration
│   ├── database.py          ← SQLAlchemy engine, session, Base
│   ├── models.py            ← DB models (Purchase, Delivery, Invoice, InvoiceItem)
│   ├── schemas.py           ← Pydantic schemas (validation + serialization)
│   ├── requirements.txt
│   └── routers/
│       ├── purchases.py     ← CRUD + toggle paid
│       ├── deliveries.py    ← CRUD
│       ├── invoices.py      ← CRUD + PDF export
│       └── dashboard.py     ← Aggregated stats
└── frontend/
    ├── vite.config.js       ← Vite + API proxy to :8000
    ├── tailwind.config.js
    └── src/
        ├── main.jsx         ← ReactDOM entry, QueryClient, Toaster
        ├── App.jsx          ← Layout + tab navigation
        ├── index.css        ← Tailwind + reusable component classes
        ├── api/
        │   └── client.js    ← All API calls (axios)
        └── components/
            ├── Dashboard.jsx
            ├── Purchases.jsx
            ├── Deliveries.jsx
            └── Invoices.jsx
```

---

## 🗄️ Database

SQLite file is created automatically at `backend/data.db` on first run.
No setup needed. To reset: just delete `data.db`.

---

## 📄 PDF Export

The system tries to use **WeasyPrint** for PDF generation.
If WeasyPrint isn't installed, it falls back to HTML in the browser.

To install WeasyPrint on Windows you may need GTK:
https://doc.courtbouillon.org/weasyprint/stable/first_steps.html

Simpler alternative — install via conda:
```bash
conda install -c conda-forge weasyprint
```

---

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /purchases/ | List all purchases |
| POST | /purchases/ | Create purchase |
| PATCH | /purchases/{id}/paid | Toggle paid status |
| DELETE | /purchases/{id} | Delete purchase |
| GET | /deliveries/ | List all deliveries |
| POST | /deliveries/ | Create delivery |
| DELETE | /deliveries/{id} | Delete delivery |
| GET | /invoices/ | List all invoices |
| POST | /invoices/ | Generate invoice from deliveries |
| GET | /invoices/{id}/pdf | Download PDF |
| DELETE | /invoices/{id} | Delete invoice |
| GET | /dashboard/ | Aggregated stats |

---

## 🛠️ Next steps to extend

- [ ] Add authentication (FastAPI + JWT)
- [ ] Edit purchases / deliveries (PUT routes already exist)
- [ ] Filter/search purchases by date or product
- [ ] Export purchases to Excel (use `openpyxl`)
- [ ] Switch to PostgreSQL (change DATABASE_URL in database.py)
- [ ] Deploy with Docker
