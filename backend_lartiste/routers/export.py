from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from database import get_db
from typing import Optional
import models
import io

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

router = APIRouter(prefix="/export", tags=["export"])

# ── Palette ────────────────────────────────────────────────────────────────────
PAL = {
    "deliveries": "818CF8",
    "purchases":  "FB923C",
    "clients":    "34D399",
    "invoices":   "A78BFA",
    "row_even":   "EEF2FF",
    "row_odd":    "FFFFFF",
    "total_bg":   "E0E7FF",
    "total_text": "3730A3",
    "border":     "C7D2FE",
}

# ── Style helpers ──────────────────────────────────────────────────────────────
def thin(color): return Side(style="thin", color=color)
def med(color):  return Side(style="medium", color=color)

def bdr(color, style="thin"):
    s = thin(color) if style == "thin" else med(color)
    return Border(left=s, right=s, top=s, bottom=s)

def apply(cell, font=None, fill=None, align=None, border=None):
    if font:   cell.font      = font
    if fill:   cell.fill      = fill
    if align:  cell.alignment = align
    if border: cell.border    = border

def style_header(cell, bg):
    apply(cell,
        font   = Font(bold=True, color="FFFFFF", name="Arial", size=10),
        fill   = PatternFill("solid", fgColor=bg),
        align  = Alignment(horizontal="center", vertical="center"),
        border = bdr(bg),
    )

def style_row(cell, even, right=False):
    apply(cell,
        font   = Font(name="Arial", size=10),
        fill   = PatternFill("solid", fgColor=PAL["row_even"] if even else PAL["row_odd"]),
        align  = Alignment(horizontal="right" if right else "left", vertical="center"),
        border = bdr(PAL["border"]),
    )

def style_total(cell):
    apply(cell,
        font   = Font(bold=True, name="Arial", size=10, color=PAL["total_text"]),
        fill   = PatternFill("solid", fgColor=PAL["total_bg"]),
        align  = Alignment(horizontal="right", vertical="center"),
        border = bdr(PAL["total_text"], "medium"),
    )

def write_sheet(ws, headers, rows, totals, bg, right_cols=None):
    right_cols = right_cols or set()

    # header
    ws.row_dimensions[1].height = 22
    for ci, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=ci, value=h)
        style_header(cell, bg)

    # data
    for ri, row_data in enumerate(rows, 2):
        ws.row_dimensions[ri].height = 16
        for ci, val in enumerate(row_data, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            style_row(cell, ri % 2 == 0, (ci - 1) in right_cols)

    # total row
    if totals:
        tr = len(rows) + 2
        ws.row_dimensions[tr].height = 18
        for ci, val in enumerate(totals, 1):
            cell = ws.cell(row=tr, column=ci, value=val)
            style_total(cell)

    # freeze + widths
    ws.freeze_panes = "A2"
    all_rows = rows + ([totals] if totals else [])
    for ci, h in enumerate(headers, 1):
        max_w = max(
            [len(str(h))] +
            [len(str(r[ci-1])) for r in all_rows if ci-1 < len(r) and r[ci-1] is not None]
        )
        ws.column_dimensions[get_column_letter(ci)].width = min(max_w + 4, 55)

def write_summary(wb, kv, bg, title="Résumé"):
    ws = wb.create_sheet(title)
    ws.row_dimensions[1].height = 22
    for ci, h in enumerate(["Indicateur", "Valeur"], 1):
        style_header(ws.cell(row=1, column=ci, value=h), bg)
    ws.column_dimensions["A"].width = 38
    ws.column_dimensions["B"].width = 24
    ws.freeze_panes = "A2"
    for ri, (k, v) in enumerate(kv, 2):
        ws.row_dimensions[ri].height = 16
        style_row(ws.cell(row=ri, column=1, value=k), ri % 2 == 0, False)
        style_row(ws.cell(row=ri, column=2, value=v), ri % 2 == 0, True)

def stream(wb, filename):
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

def d(v): return round(float(v or 0), 2)
def ds(v): return str(v) if v else "—"

# ── DELIVERIES ─────────────────────────────────────────────────────────────────
# ── DELIVERIES ─────────────────────────────────────────────────────────────────
@router.get("/deliveries")
def export_deliveries(db: Session = Depends(get_db)):  # ← supprime le paramètre day
    items = db.query(models.Delivery).order_by(models.Delivery.date.desc(), models.Delivery.client).all()

    wb = Workbook()
    bg = PAL["deliveries"]

    # Sheet 1 — all lines
    ws1 = wb.active
    ws1.title = "Livraisons"
    h1 = ["Date", "Client", "Adresse", "Produit", "Quantité", "Unité", "Prix Unit. (DH)", "Total (DH)", "Notes"]
    r1 = [
        [ds(i.date), i.client, i.address or "", i.product,
         d(i.quantity), i.unit, d(i.unit_price), d(i.total), i.notes or ""]
        for i in items
    ]
    write_sheet(ws1, h1, r1, None, bg, right_cols={4, 6, 7})

    # Sheet 2 — by client
    by_client = {}
    for i in items:
        bc = by_client.setdefault(i.client, {"total": 0.0, "lines": 0, "prods": set()})
        bc["total"] += i.total; bc["lines"] += 1; bc["prods"].add(i.product)
    total_val = sum(i.total for i in items)

    ws2 = wb.create_sheet("Par Client")
    h2 = ["Client", "Nb Lignes", "Produits distincts", "Total (DH)", "% du total"]
    r2 = [
        [name, v["lines"], len(v["prods"]), d(v["total"]),
         f"{v['total']/total_val*100:.1f}%" if total_val else "0%"]
        for name, v in sorted(by_client.items(), key=lambda x: -x[1]["total"])
    ]
    t2 = ["TOTAL", len(items), "", d(total_val), "100%"]
    write_sheet(ws2, h2, r2, t2, bg, right_cols={1, 2, 3})

    # Sheet 3 — by product
    by_prod = {}
    for i in items:
        bp = by_prod.setdefault(i.product, {"qty": 0.0, "total": 0.0, "unit": i.unit})
        bp["qty"] += i.quantity; bp["total"] += i.total
    ws3 = wb.create_sheet("Par Produit")
    h3 = ["Produit", "Unité", "Qté totale", "Total (DH)"]
    r3 = [
        [name, v["unit"], d(v["qty"]), d(v["total"])]
        for name, v in sorted(by_prod.items(), key=lambda x: -x[1]["total"])
    ]
    t3 = ["TOTAL", "", "", d(total_val)]
    write_sheet(ws3, h3, r3, t3, bg, right_cols={2, 3})

    # Sheet 4 — summary
    top = sorted(by_client.items(), key=lambda x: -x[1]["total"])
    write_summary(wb, [
        ("Période",                    "Toutes dates"),  # ← toujours "Toutes dates"
        ("Nombre de livraisons",       len(items)),
        ("Clients distincts",          len(by_client)),
        ("Produits distincts",         len(by_prod)),
        ("Valeur totale (DH)",         d(total_val)),
        ("Moyenne par livraison (DH)", d(total_val / len(items)) if items else 0),
        ("Meilleur client",            top[0][0] if top else "—"),
        ("Total meilleur client (DH)", d(top[0][1]["total"]) if top else 0),
    ], bg)

    return stream(wb, "livraisons.xlsx")  # ← nom fixe sans suffixe de date


# ── PURCHASES ──────────────────────────────────────────────────────────────────
@router.get("/purchases")
def export_purchases(day: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    q = db.query(models.Purchase)
    if day:
        q = q.filter(models.Purchase.date == day)
    items = q.order_by(models.Purchase.date.desc(), models.Purchase.supplier).all()

    wb = Workbook()
    bg = PAL["purchases"]

    # Sheet 1 — all lines
    ws1 = wb.active
    ws1.title = "Achats"
    h1 = ["Date", "Fournisseur", "Produit", "Quantité", "Unité", "Prix Unit. (DH)", "Total (DH)", "Statut", "Notes"]
    r1 = [
        [ds(i.date), i.supplier, i.product,
         d(i.quantity), i.unit, d(i.unit_price), d(i.total),
         "Payé ✓" if i.paid else "Impayé ⚠", i.notes or ""]
        for i in items
    ]
    write_sheet(ws1, h1, r1, None, bg, right_cols={3, 5, 6})

    # Sheet 2 — by supplier
    by_supp = {}
    for i in items:
        bs = by_supp.setdefault(i.supplier, {"total": 0.0, "paid": 0.0, "lines": 0})
        bs["total"] += i.total; bs["lines"] += 1
        if i.paid: bs["paid"] += i.total
    total_all  = sum(i.total for i in items)
    total_paid = sum(i.total for i in items if i.paid)

    ws2 = wb.create_sheet("Par Fournisseur")
    h2 = ["Fournisseur", "Nb Achats", "Total (DH)", "Payé (DH)", "Impayé (DH)", "% Payé"]
    r2 = [
        [name, v["lines"], d(v["total"]), d(v["paid"]), d(v["total"]-v["paid"]),
         f"{v['paid']/v['total']*100:.1f}%" if v["total"] else "0%"]
        for name, v in sorted(by_supp.items(), key=lambda x: -x[1]["total"])
    ]
    t2 = ["TOTAL", len(items), d(total_all), d(total_paid), d(total_all-total_paid),
          f"{total_paid/total_all*100:.1f}%" if total_all else "0%"]
    write_sheet(ws2, h2, r2, t2, bg, right_cols={1, 2, 3, 4})

    # Sheet 3 — by product
    by_prod = {}
    for i in items:
        bp = by_prod.setdefault(i.product, {"qty": 0.0, "total": 0.0, "unit": i.unit})
        bp["qty"] += i.quantity; bp["total"] += i.total
    ws3 = wb.create_sheet("Par Produit")
    h3 = ["Produit", "Unité", "Qté totale", "Total (DH)"]
    r3 = [
        [name, v["unit"], d(v["qty"]), d(v["total"])]
        for name, v in sorted(by_prod.items(), key=lambda x: -x[1]["total"])
    ]
    t3 = ["TOTAL", "", "", d(total_all)]
    write_sheet(ws3, h3, r3, t3, bg, right_cols={2, 3})

    # Sheet 4 — summary
    write_summary(wb, [
        ("Nombre d'achats",           len(items)),
        ("Fournisseurs distincts",    len(by_supp)),
        ("Produits distincts",        len(by_prod)),
        ("Valeur totale (DH)",        d(total_all)),
        ("Total payé (DH)",           d(total_paid)),
        ("Total impayé (DH)",         d(total_all - total_paid)),
        ("% payé",                    f"{total_paid/total_all*100:.1f}%" if total_all else "0%"),
        ("Moyenne par achat (DH)",    d(total_all / len(items)) if items else 0),
    ], bg)

    return stream(wb, f"achats_{'_'+day if day else 'all'}.xlsx")


# ── CLIENTS ────────────────────────────────────────────────────────────────────
@router.get("/clients")
def export_clients(db: Session = Depends(get_db)):
    clients = db.query(models.Client).order_by(models.Client.name).all()

    wb = Workbook()
    bg = PAL["clients"]

    ws1 = wb.active
    ws1.title = "Clients"
    h1 = ["Code", "Nom", "Adresse", "Téléphone", "Email", "Notes"]
    r1 = [
        [c.code or "", c.name, c.address or "", c.phone or "", c.email or "", c.notes or ""]
        for c in clients
    ]
    write_sheet(ws1, h1, r1, None, bg)

    write_summary(wb, [
        ("Total clients",     len(clients)),
        ("Avec adresse",      sum(1 for c in clients if c.address)),
        ("Avec téléphone",    sum(1 for c in clients if c.phone)),
        ("Avec email",        sum(1 for c in clients if c.email)),
        ("Sans informations", sum(1 for c in clients if not c.address and not c.phone and not c.email)),
    ], bg)

    return stream(wb, "clients.xlsx")


# ── INVOICES ───────────────────────────────────────────────────────────────────
@router.get("/invoices")
def export_invoices(db: Session = Depends(get_db)):
    # joinedload so invoice.items is populated without lazy-load errors
    invoices = (
        db.query(models.Invoice)
        .options(joinedload(models.Invoice.items))
        .order_by(models.Invoice.id.desc())
        .all()
    )

    wb = Workbook()
    bg = PAL["invoices"]

    # Sheet 1 — invoice headers
    ws1 = wb.active
    ws1.title = "Factures"
    h1 = ["N° Facture", "Client", "Code Client", "Type", "Période", "Mode Règlement", "Nb Lignes", "Total (DH)"]
    r1 = []
    for inv in invoices:
        if inv.invoice_type == "single_day":
            period = ds(inv.delivery_date)
        elif inv.invoice_type == "range":
            period = f"{ds(inv.date_from)} → {ds(inv.date_to)}"
        else:
            period = "Toutes livraisons"
        type_label = {"single_day": "Jour unique", "range": "Plage dates"}.get(inv.invoice_type, "Tout temps")
        r1.append([inv.number, inv.client, inv.client_code or "", type_label,
                   period, inv.payment_method or "", len(inv.items), d(inv.total)])
    write_sheet(ws1, h1, r1, None, bg, right_cols={6, 7})

    # Sheet 2 — all invoice lines
    line_rows = []
    for inv in invoices:
        for item in inv.items:
            line_rows.append([
                inv.number, inv.client,
                ds(item.date) if item.date else ds(inv.delivery_date),
                item.ref or "",
                item.product or "",
                d(item.quantity),
                d(item.unit_price),
                d(item.total),
            ])
    if line_rows:
        ws2 = wb.create_sheet("Lignes")
        h2 = ["N° Facture", "Client", "Date", "Réf", "Désignation", "Quantité", "Prix Unit. (DH)", "Total (DH)"]
        write_sheet(ws2, h2, line_rows, None, bg, right_cols={5, 6, 7})

    # Sheet 3 — by client
    by_client = {}
    for inv in invoices:
        bc = by_client.setdefault(inv.client, {"count": 0, "total": 0.0})
        bc["count"] += 1; bc["total"] += inv.total
    total_inv = sum(inv.total for inv in invoices)

    ws3 = wb.create_sheet("Par Client")
    h3 = ["Client", "Nb Factures", "Total Facturé (DH)", "% du total"]
    r3 = [
        [name, v["count"], d(v["total"]),
         f"{v['total']/total_inv*100:.1f}%" if total_inv else "0%"]
        for name, v in sorted(by_client.items(), key=lambda x: -x[1]["total"])
    ]
    t3 = ["TOTAL", len(invoices), d(total_inv), "100%"]
    write_sheet(ws3, h3, r3, t3, bg, right_cols={1, 2})

    # Sheet 4 — summary
    write_summary(wb, [
        ("Nombre de factures",       len(invoices)),
        ("Clients facturés",         len(by_client)),
        ("Total facturé (DH)",       d(total_inv)),
        ("Moyenne par facture (DH)", d(total_inv / len(invoices)) if invoices else 0),
        ("Factures jour unique",     sum(1 for i in invoices if i.invoice_type == "single_day")),
        ("Factures plage dates",     sum(1 for i in invoices if i.invoice_type == "range")),
        ("Factures tout temps",      sum(1 for i in invoices if i.invoice_type == "all_time")),
    ], bg)

    return stream(wb, "factures.xlsx")