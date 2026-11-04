from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import date
import io, os, copy
from database import get_db
import models, schemas

router = APIRouter(prefix="/invoices", tags=["invoices"])

BUSINESS = {
    "name": "RESTAURANT L'ARTISTE AL HOCAIMA",
    "address": "MARINA AL HOCAIMA 3200",
    "tel": "08 08 51 50 03",
    "rc": "3545",
    "ice": "003155284000007",
    "if": "53303580",
    "taxe_ro": "565036166",
}


def get_next_invoice_number(db: Session) -> str:
    year = date.today().year
    last = (
        db.query(models.Invoice)
        .filter(models.Invoice.number.like(f"F-{year}-%"))
        .order_by(models.Invoice.id.desc())
        .first()
    )
    if last:
        try:
            seq = int(last.number.split("-")[-1]) + 1
        except Exception:
            seq = 1
    else:
        seq = 1
    return f"F-{year}-{seq:04d}"


def number_to_words_fr(n: float) -> str:
    ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
            'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept',
            'dix-huit', 'dix-neuf']
    tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
            'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix']

    def below_1000(num):
        if num == 0: return ''
        elif num < 20: return ones[num]
        elif num < 100:
            t, o = divmod(num, 10)
            if t == 7: return 'soixante-' + ones[10 + o]
            elif t == 9: return 'quatre-vingt-' + ones[o] if o else 'quatre-vingt-dix'
            elif t == 8: return 'quatre-vingts' if o == 0 else 'quatre-vingt-' + ones[o]
            else: return tens[t] + ('-et-' + ones[o] if o == 1 and t not in [8, 9] else ('-' + ones[o] if o else ''))
        else:
            h, r = divmod(num, 100)
            return (ones[h] + ' cent' + ('s' if r == 0 and h > 1 else '')) + (' ' + below_1000(r) if r else '')

    num = int(n)
    if num == 0: return 'zéro'
    if num >= 1000:
        t, r = divmod(num, 1000)
        w = ('mille' if t == 1 else below_1000(t) + ' mille')
        if r: w += ' ' + below_1000(r)
        return w.strip()
    return below_1000(num).strip()


@router.get("/next-number")
def get_next_number(db: Session = Depends(get_db)):
    return {"number": get_next_invoice_number(db)}


@router.get("/", response_model=List[schemas.InvoiceOut])
def get_all(db: Session = Depends(get_db)):
    return db.query(models.Invoice).order_by(models.Invoice.id.desc()).all()


@router.post("/", response_model=schemas.InvoiceOut)
def create(data: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    number = data.number.strip() if data.number and data.number.strip() else get_next_invoice_number(db)
    existing = db.query(models.Invoice).filter(models.Invoice.number == number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Invoice number already exists")

    # Build delivery query based on invoice type
    query = db.query(models.Delivery).filter(models.Delivery.client == data.client)

    if data.invoice_type == "single_day":
        if not data.delivery_date:
            raise HTTPException(status_code=400, detail="delivery_date required for single_day")
        query = query.filter(models.Delivery.date == data.delivery_date)
    elif data.invoice_type == "range":
        if data.date_from:
            query = query.filter(models.Delivery.date >= data.date_from)
        if data.date_to:
            query = query.filter(models.Delivery.date <= data.date_to)
    # all_time: no date filter

    deliveries = query.order_by(models.Delivery.date.asc(), models.Delivery.id.asc()).all()
    if not deliveries:
        raise HTTPException(status_code=404, detail="No deliveries found for this client and period")

    total = sum(d.total for d in deliveries)
    invoice = models.Invoice(
        number=number,
        client=data.client,
        client_code=data.client_code,
        client_address=data.client_address,
        invoice_type=data.invoice_type,
        delivery_date=data.delivery_date,
        date_from=data.date_from,
        date_to=data.date_to,
        total=round(total, 2),
        created_at=date.today(),
        payment_method=data.payment_method,
    )
    db.add(invoice)
    db.flush()

    for i, d in enumerate(deliveries, 1):
        item = models.InvoiceItem(
            invoice_id=invoice.id,
            ref=str(i),
            date=d.date,
            product=d.product,
            address=d.address,
            quantity=d.quantity,
            unit=d.unit,
            unit_price=d.unit_price,
            total=d.total,
        )
        db.add(item)

    db.commit()
    db.refresh(invoice)
    return invoice


@router.delete("/{id}")
def delete(id: int, db: Session = Depends(get_db)):
    inv = db.query(models.Invoice).filter(models.Invoice.id == id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(inv)
    db.commit()
    return {"ok": True}


@router.get("/{id}/pdf")
def export_pdf(id: int, db: Session = Depends(get_db)):
    inv = db.query(models.Invoice).filter(models.Invoice.id == id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    show_date_col = inv.invoice_type in ("range", "all_time")

    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

    PAGE_W, PAGE_H = A4
    MARGIN    = 18 * mm
    CONTENT_W = PAGE_W - 2 * MARGIN
    BOTTOM_H  = 65 * mm

    DARK       = colors.HexColor('#4b5563')
    LIGHT_ROW  = colors.HexColor('#f3f4f6')
    GOLD       = colors.HexColor('#c8a84b')
    GRAY_TEXT  = colors.HexColor('#6b7280')
    BORDER_COL = colors.HexColor('#e5e7eb')

    def sty(name='n', size=10, bold=False, italic=False, align=TA_LEFT, color=colors.black, leading=None):
        fn = 'Helvetica-Bold' if bold else ('Helvetica-Oblique' if italic else 'Helvetica')
        return ParagraphStyle(name, fontSize=size, fontName=fn, alignment=align,
                              textColor=color, leading=leading or size * 1.35)

    # Date label for header
    if inv.invoice_type == "single_day":
        date_label = inv.delivery_date.strftime("%d-%m-%Y") if inv.delivery_date else inv.created_at.strftime("%d-%m-%Y")
        period_label = date_label
    elif inv.invoice_type == "range":
        df = inv.date_from.strftime("%d-%m-%Y") if inv.date_from else "—"
        dt = inv.date_to.strftime("%d-%m-%Y") if inv.date_to else "—"
        date_label = inv.created_at.strftime("%d-%m-%Y")
        period_label = f"{df} → {dt}"
    else:
        date_label = inv.created_at.strftime("%d-%m-%Y")
        period_label = "Toutes les livraisons"

    total_words = number_to_words_fr(inv.total) + " Dirhams"
    total_words = total_words[0].upper() + total_words[1:]

    total_pages = [1]

    def draw_page(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(GRAY_TEXT)
        fy = 10 * mm
        canvas.drawCentredString(PAGE_W/2, fy - 4,
            f"Auto Entrepreneur : {BUSINESS['name']}   |   TEL : {BUSINESS['tel']}   |   Adresse : {BUSINESS['address']}")
        canvas.drawCentredString(PAGE_W/2, fy - 11,
            f"ICE : {BUSINESS['rc']} | {BUSINESS['ice']}   |   IF : {BUSINESS['if']}   |   Taxe professionnelle N° : {BUSINESS['taxe_pro']}")
        canvas.setFont('Helvetica', 8)
        canvas.drawCentredString(PAGE_W/2, fy - 19, f"{doc.page} / {total_pages[0]}")

        if doc.page == total_pages[0]:
            bx = MARGIN
            by = 28 * mm
            canvas.setFont('Helvetica-Bold', 9)
            canvas.setFillColor(colors.black)
            canvas.drawString(bx, by + 38, f"Mode de règlement : {inv.payment_method}")
            canvas.setFont('Helvetica', 9)
            canvas.setFillColor(GRAY_TEXT)
            canvas.drawString(bx, by + 26, f"Echéance de paiement : {date_label}")
            canvas.drawString(bx, by + 14, "Règlement(s)/Acompte(s) :")
            canvas.drawString(bx, by + 2,  "Net à payer :")

            box_w = 80 * mm
            box_x = PAGE_W - MARGIN - box_w
            row_h = 10 * mm
            labels = ['Total HT :', 'Total TTC :', 'Net à payer :']
            values = [f"{inv.total:.2f} Dh", f"{inv.total:.2f} Dh", f"{inv.total:.2f} Dh"]
            for i, (label, value) in enumerate(zip(labels, values)):
                row_y = by + (2 - i) * row_h
                if i == 2:
                    canvas.setFillColor(DARK)
                    canvas.setStrokeColor(DARK)
                    canvas.rect(box_x, row_y, box_w, row_h, fill=1, stroke=0)
                    canvas.setFillColor(colors.white)
                    canvas.setFont('Helvetica-Bold', 9)
                    canvas.drawString(box_x + 6, row_y + 3, label)
                    canvas.drawRightString(box_x + box_w - 6, row_y + 3, value)
                else:
                    canvas.setFillColor(colors.white)
                    canvas.setStrokeColor(BORDER_COL)
                    canvas.rect(box_x, row_y, box_w, row_h, fill=1, stroke=1)
                    canvas.setFillColor(GRAY_TEXT)
                    canvas.setFont('Helvetica', 9)
                    canvas.drawString(box_x + 6, row_y + 3, label)
                    canvas.setFillColor(colors.black)
                    canvas.drawRightString(box_x + box_w - 6, row_y + 3, value)

            # FIX 1: moved up by 8 points (by - 14 instead of by - 6)
            canvas.setFont('Helvetica-Oblique', 8)
            canvas.setFillColor(GRAY_TEXT)
            canvas.drawRightString(PAGE_W - MARGIN, by - 14, f"Net à payer : {total_words}")

        canvas.restoreState()

    elems = []

    # 1. Date top right
    elems.append(Paragraph(f"Le {date_label}", sty('dt', 9, color=GRAY_TEXT, align=TA_RIGHT)))
    elems.append(Spacer(1, 5*mm))

    # 2. Header: Logo | Client
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'logo.png')
    if os.path.exists(logo_path):
        from reportlab.platypus import Image as RLImage
        from PIL import Image as PILImage
        with PILImage.open(logo_path) as pil_img:
            orig_w, orig_h = pil_img.size
        logo_w = 50 * mm
        logo_h = logo_w * (orig_h / orig_w)
        # FIX 2: preserve transparency instead of converting to RGB
        tmp = io.BytesIO()
        with PILImage.open(logo_path) as img:
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                background = PILImage.new('RGBA', img.size, (255, 255, 255, 0))
                img_rgba = img.convert('RGBA')
                background.paste(img_rgba, mask=img_rgba.split()[3])
                background.save(tmp, format='PNG')
            else:
                img.convert('RGBA').save(tmp, format='PNG')
        tmp.seek(0)
        logo_cell = RLImage(tmp, width=logo_w, height=logo_h)
        logo_h_capped = min(logo_h, 50*mm)
    else:
        logo_cell = Paragraph(f'<b>{BUSINESS["name"]}</b>', sty('lg', 18, bold=True, color=GOLD))
        logo_h_capped = 20*mm

    # FIX 3: removed "Code client" line from client block
    client_lines = f'<b>{inv.client}</b>'
    if inv.client_address:
        client_lines += f'<br/><font size="9" color="#6b7280">{inv.client_address}</font>'
    client_cell = Paragraph(client_lines, sty('cn', 12, align=TA_RIGHT))

    header = Table([[logo_cell, client_cell]],
                   colWidths=[55*mm, CONTENT_W - 55*mm], rowHeights=[logo_h_capped])
    header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN',  (1,0), (1,0),   'RIGHT'),
    ]))
    elems.append(header)
    elems.append(Spacer(1, 6*mm))

    # 3. Title bar — show period
    title_t = Table([[
        Paragraph('Facture', sty('ft', 16, bold=True, color=colors.white)),
        Paragraph(inv.number, sty('fn', 13, bold=True, color=colors.white, align=TA_CENTER)),
        Paragraph(f'Code Client : <b>{inv.client_code or "—"}</b>',
                  sty('fc', 10, color=colors.white, align=TA_RIGHT)),
    ]], colWidths=[50*mm, 70*mm, CONTENT_W - 120*mm])
    title_t.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), DARK),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING',   (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0), (-1,-1), 6),
        ('LEFTPADDING',  (0,0), (0,-1),  8),
        ('RIGHTPADDING', (-1,0),(-1,-1), 8),
    ]))
    elems.append(title_t)

    # Period subtitle for range / all_time
    if inv.invoice_type != "single_day":
        elems.append(Spacer(1, 2*mm))
        elems.append(Paragraph(
            f'Période : {period_label}',
            sty('per', 9, color=GRAY_TEXT)
        ))

    elems.append(Spacer(1, 5*mm))

    # 4. Products table
    wh  = sty('wh',  9, bold=True, color=colors.white, align=TA_CENTER)
    whr = sty('whr', 9, bold=True, color=colors.white, align=TA_RIGHT)
    whl = sty('whl', 9, bold=True, color=colors.white, align=TA_LEFT)

    if show_date_col:
        thead = [[
            Paragraph('Réf',         wh),
            Paragraph('Date',        wh),
            Paragraph('Désignation', whl),
            Paragraph('Quantité',    whr),
            Paragraph('PU',          whr),
            Paragraph('Total TTC',   whr),
        ]]
        col_w = [12*mm, 30*mm, CONTENT_W-12*mm-30*mm-22*mm-22*mm-26*mm, 22*mm, 22*mm, 26*mm]
    else:
        thead = [[
            Paragraph('Réf',         wh),
            Paragraph('Désignation', whl),
            Paragraph('Quantité',    whr),
            Paragraph('PU',          whr),
            Paragraph('Total TTC',   whr),
        ]]
        col_w = [12*mm, CONTENT_W-12*mm-22*mm-22*mm-26*mm, 22*mm, 22*mm, 26*mm]

    tbody = []
    for item in inv.items:
        if show_date_col:
            JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
            date_str = (JOURS[item.date.weekday()] + ' ' + item.date.strftime("%d/%m/%Y")) if item.date else "—"
            tbody.append([
                Paragraph(str(item.ref),           sty('r', 9, align=TA_CENTER)),
                Paragraph(date_str,                sty('r', 9, align=TA_CENTER)),
                Paragraph(item.product or '',      sty('r', 9)),
                Paragraph(str(int(item.quantity)) if item.quantity == int(item.quantity) else f"{item.quantity:.2f}", sty('r', 9, align=TA_RIGHT)),
                Paragraph(f"{item.unit_price:.2f}",sty('r', 9, align=TA_RIGHT)),
                Paragraph(f"{item.total:.2f}",     sty('r', 9, bold=True, align=TA_RIGHT)),
            ])
        else:
            tbody.append([
                Paragraph(str(item.ref),           sty('r', 9, align=TA_CENTER)),
                Paragraph(item.product or '',      sty('r', 9)),
                Paragraph(str(int(item.quantity)) if item.quantity == int(item.quantity) else f"{item.quantity:.2f}", sty('r', 9, align=TA_RIGHT)),
                Paragraph(f"{item.unit_price:.2f}",sty('r', 9, align=TA_RIGHT)),
                Paragraph(f"{item.total:.2f}",     sty('r', 9, bold=True, align=TA_RIGHT)),
            ])

    prod_t = Table(thead + tbody, colWidths=col_w, repeatRows=1)
    ts = [
        ('BACKGROUND',    (0,0),  (-1,0),  DARK),
        ('GRID',          (0,0),  (-1,-1), 0.4, BORDER_COL),
        ('LINEBELOW',     (0,0),  (-1,0),  1,   DARK),
        ('VALIGN',        (0,0),  (-1,-1), 'MIDDLE'),
        ('TOPPADDING',    (0,0),  (-1,-1), 4),
        ('BOTTOMPADDING', (0,0),  (-1,-1), 4),
        ('LEFTPADDING',   (0,0),  (-1,-1), 5),
        ('RIGHTPADDING',  (0,0),  (-1,-1), 5),
    ]
    for i in range(len(tbody)):
        if i % 2 == 0:
            ts.append(('BACKGROUND', (0, i+1), (-1, i+1), LIGHT_ROW))
    prod_t.setStyle(TableStyle(ts))
    elems.append(prod_t)

    # Two-pass build
    def make_doc(buf):
        d = BaseDocTemplate(buf, pagesize=A4,
            leftMargin=MARGIN, rightMargin=MARGIN,
            topMargin=MARGIN, bottomMargin=BOTTOM_H)
        f = Frame(MARGIN, BOTTOM_H, CONTENT_W, PAGE_H - MARGIN - BOTTOM_H, id='main')
        d.addPageTemplates([PageTemplate(id='page', frames=[f], onPage=draw_page)])
        return d

    count_buf = io.BytesIO()
    count_doc = make_doc(count_buf)
    count_doc.build(copy.deepcopy(elems))
    total_pages[0] = count_doc.page

    real_buf = io.BytesIO()
    make_doc(real_buf).build(elems)
    real_buf.seek(0)

    return StreamingResponse(
        real_buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=facture-{inv.number}.pdf"}
    )
