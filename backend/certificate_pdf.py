"""Certificate PDF generator using reportlab.

Produces a landscape A4 certificate with navy border, gold accents, elegant
serif typography, a QR code, and an inked stylized signature for the CEO.
"""
from __future__ import annotations

import io
from datetime import datetime

import qrcode
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


NAVY = HexColor("#0B132B")
GOLD = HexColor("#B8860B")
GOLD_LIGHT = HexColor("#D4A24A")
INK = HexColor("#111827")
MUTED = HexColor("#64748B")
CREAM = HexColor("#FBF9F2")
ACCENT = HexColor("#0F2A47")


def _fmt_date(iso: str) -> str:
    try:
        d = datetime.fromisoformat(iso).date()
    except Exception:
        try:
            d = datetime.strptime(iso, "%Y-%m-%d").date()
        except Exception:
            return iso
    return d.strftime("%d %b %Y")


def _qr_image(url: str) -> ImageReader:
    qr = qrcode.QRCode(box_size=6, border=1)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def _draw_border(c: canvas.Canvas, w: float, h: float):
    # Cream background
    c.setFillColor(CREAM)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # Outer navy border
    c.setStrokeColor(NAVY)
    c.setLineWidth(10)
    c.rect(14, 14, w - 28, h - 28, fill=0, stroke=1)

    # Inner gold hairline border
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.rect(30, 30, w - 60, h - 60, fill=0, stroke=1)

    # Corner ornaments (small gold diamonds)
    for (x, y) in [(30, 30), (w - 30, 30), (30, h - 30), (w - 30, h - 30)]:
        c.setFillColor(GOLD)
        c.circle(x, y, 4, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.circle(x, y, 2, fill=1, stroke=0)

    # Watermark ZI monogram (very light)
    c.saveState()
    c.setFillColor(Color(0.85, 0.75, 0.35, alpha=0.06))
    c.setFont("Times-Bold", 340)
    c.drawCentredString(w / 2, h / 2 - 120, "ZI")
    c.restoreState()


def _draw_seal(c: canvas.Canvas, cx: float, cy: float, r: float = 34):
    # Outer ring
    c.setFillColor(GOLD)
    c.circle(cx, cy, r, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.circle(cx, cy, r - 4, fill=1, stroke=0)
    # ZI text
    c.setFillColor(GOLD_LIGHT)
    c.setFont("Times-Bold", 22)
    c.drawCentredString(cx, cy + 2, "ZI")
    c.setFont("Helvetica-Bold", 5.5)
    c.setFillColor(CREAM)
    c.drawCentredString(cx, cy - 12, "VERIFIED")


def _draw_signature(c: canvas.Canvas, cx: float, baseline: float, name: str):
    """Draw a stylized handwritten-looking signature centered on cx."""
    c.saveState()
    # Underline flourish stroke
    c.setStrokeColor(INK)
    c.setLineWidth(1.6)
    # Base signature using italic bold
    c.setFillColor(INK)
    c.setFont("Times-BoldItalic", 26)
    c.drawCentredString(cx, baseline, name)
    # Underline flourish
    c.setLineWidth(1.2)
    c.line(cx - 70, baseline - 6, cx + 70, baseline - 6)
    # Small tail curl
    from reportlab.pdfgen.pathobject import PDFPathObject
    p = c.beginPath()
    p.moveTo(cx + 70, baseline - 6)
    p.curveTo(cx + 82, baseline - 4, cx + 88, baseline + 2, cx + 96, baseline + 10)
    c.drawPath(p, stroke=1, fill=0)
    c.restoreState()


def _draw_signature_image(c: canvas.Canvas, image_bytes: bytes, cx: float, baseline: float) -> bool:
    """Render an uploaded signature without distorting its aspect ratio."""
    try:
        image = ImageReader(io.BytesIO(image_bytes))
        width, height = image.getSize()
        scale = min(180 / width, 58 / height)
        draw_width, draw_height = width * scale, height * scale
        c.drawImage(
            image,
            cx - draw_width / 2,
            baseline - 8,
            width=draw_width,
            height=draw_height,
            mask="auto",
            preserveAspectRatio=True,
            anchor="c",
        )
        return True
    except Exception:
        return False


def build_certificate_pdf(
    intern_name: str,
    area: str,
    start_date: str,
    end_date: str,
    issue_date: str,
    duration_weeks: int,
    certificate_id: str,
    verify_url: str,
    ceo_name: str,
    ceo_title: str,
    signature_image: bytes | None = None,
) -> bytes:
    buf = io.BytesIO()
    page = landscape(A4)
    w, h = page
    c = canvas.Canvas(buf, pagesize=page)

    _draw_border(c, w, h)

    # Header seal at top center
    _draw_seal(c, w / 2, h - 78, r=26)

    # Brand text
    c.setFillColor(NAVY)
    c.setFont("Times-Bold", 12)
    c.drawCentredString(w / 2, h - 118, "Z O O M I N T E R N")

    # Certificate title
    c.setFillColor(NAVY)
    c.setFont("Times-Bold", 44)
    c.drawCentredString(w / 2, h - 170, "CERTIFICATE")

    # Small subtitle with side dashes
    c.setFillColor(GOLD)
    c.setLineWidth(1)
    c.setStrokeColor(GOLD)
    c.line(w / 2 - 110, h - 190, w / 2 - 60, h - 190)
    c.line(w / 2 + 60, h - 190, w / 2 + 110, h - 190)
    c.setFont("Times-Italic", 12)
    c.drawCentredString(w / 2, h - 194, "OF COMPLETION")

    # Presented to
    c.setFillColor(MUTED)
    c.setFont("Times-Italic", 13)
    c.drawCentredString(w / 2, h - 230, "This certificate is proudly presented to")

    # Intern name
    c.setFillColor(NAVY)
    c.setFont("Times-BoldItalic", 38)
    c.drawCentredString(w / 2, h - 275, intern_name)
    # Underline for name
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    c.line(w / 2 - 140, h - 286, w / 2 + 140, h - 286)
    # Tiny diamond in middle
    c.setFillColor(GOLD)
    c.circle(w / 2, h - 286, 2.4, fill=1, stroke=0)

    # Body text (two lines, centered)
    c.setFillColor(INK)
    c.setFont("Helvetica", 12)
    line1 = f"for successfully completing the {duration_weeks}-week Internship Program in {area}"
    line2 = "at ZoomIntern, and demonstrating dedication, professionalism"
    line3 = "and a strong commitment to learning throughout the program."
    c.drawCentredString(w / 2, h - 320, line1)
    c.drawCentredString(w / 2, h - 338, line2)
    c.drawCentredString(w / 2, h - 356, line3)

    # Details row (4 columns)
    row_y = h - 410
    col_w = (w - 200) / 4
    labels = [
        ("INTERNSHIP START", _fmt_date(start_date)),
        ("INTERNSHIP END", _fmt_date(end_date)),
        ("DURATION", f"{duration_weeks} Weeks"),
        ("ISSUE DATE", _fmt_date(issue_date)),
    ]
    for i, (label, value) in enumerate(labels):
        cx = 100 + col_w * i + col_w / 2
        c.setFillColor(GOLD)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawCentredString(cx, row_y, label)
        c.setFillColor(NAVY)
        c.setFont("Times-Bold", 14)
        c.drawCentredString(cx, row_y - 18, value)

    # Footer: QR (left), Seal (center), Signature (right)
    footer_y = 80

    # QR code
    qr_img = _qr_image(verify_url)
    qr_size = 78
    c.drawImage(qr_img, 80, footer_y - 20, width=qr_size, height=qr_size, mask="auto")
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(170, footer_y + 48, "CERTIFICATE ID")
    c.setFillColor(NAVY)
    c.setFont("Times-Bold", 12)
    c.drawString(170, footer_y + 32, certificate_id)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawString(170, footer_y + 18, "Scan the QR to verify this")
    c.drawString(170, footer_y + 8, "certificate instantly")

    # Center seal
    _draw_seal(c, w / 2, footer_y + 25, r=28)

    # Signature (right)
    sig_cx = w - 180
    signature_drawn = bool(signature_image) and _draw_signature_image(c, signature_image, sig_cx, footer_y + 40)
    if not signature_drawn:
        _draw_signature(c, sig_cx, footer_y + 40, ceo_name)
    c.setStrokeColor(NAVY)
    c.setLineWidth(0.6)
    c.line(sig_cx - 110, footer_y + 22, sig_cx + 110, footer_y + 22)
    c.setFillColor(NAVY)
    c.setFont("Times-Bold", 11)
    c.drawCentredString(sig_cx, footer_y + 8, ceo_name)
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(sig_cx, footer_y - 4, ceo_title.upper())

    c.showPage()
    c.save()
    return buf.getvalue()
