#!/usr/bin/env python3
"""
Generate Aqiqah Certificate PDF using designer background template.
Uses aqiqah-bg.png as background with dynamic text overlay.

Usage:
  python3 scripts/generate-aqiqah-certificate.py                    # Generate template with placeholders
  python3 scripts/generate-aqiqah-certificate.py --sample            # Generate sample with real data
  python3 scripts/generate-aqiqah-certificate.py --child "Name" --date "March 11, 2026" --id "F1AFE7" --package "girl"
"""

import sys, os, argparse

# Ensure reportlab doesn't need PIL at import time
import types
if 'PIL' not in sys.modules:
    try:
        import PIL
    except ImportError:
        pil_mod = types.ModuleType('PIL')
        pil_img = types.ModuleType('PIL.Image')
        pil_mod.Image = pil_img
        sys.modules['PIL'] = pil_mod
        sys.modules['PIL.Image'] = pil_img

from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
CERT_DIR = os.path.join(PROJECT_DIR, 'src', 'templates', 'certificates')
BG_IMAGE = os.path.join(CERT_DIR, 'aqiqah-bg-ayatal.png')

# Colors matching designer's certificate
DARK_BLUE = HexColor('#1a3a5c')       # Title text
DARK_BROWN = HexColor('#3d2b1f')      # Body text
GOLD_TEXT = HexColor('#8b6914')        # Year, decorative text
MEDIUM_GRAY = HexColor('#555555')      # Subtitle text
DARK_TEXT = HexColor('#2a2a2a')        # General dark text
WARM_BROWN = HexColor('#5a4030')       # Blessing text
BRAND_BLUE = HexColor('#0d5c8f')      # Logo/brand text
RECEIPT_GRAY = HexColor('#666666')     # Small print

# Page dimensions - US Letter Landscape
WIDTH, HEIGHT = landscape(letter)  # 11 x 8.5 inches (792 x 612 points)


def register_fonts():
    """Register custom fonts if available, fall back to built-ins."""
    font_dir = '/System/Library/Fonts'
    supplemental = '/System/Library/Fonts/Supplemental'

    # Try to register nicer fonts
    fonts_registered = {}

    # Try Georgia for elegant serif (title, child name)
    for path in [
        os.path.join(supplemental, 'Georgia.ttf'),
        os.path.join(supplemental, 'Georgia Bold.ttf'),
        os.path.join(supplemental, 'Georgia Italic.ttf'),
    ]:
        name = os.path.basename(path).replace('.ttf', '').replace(' ', '-')
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                fonts_registered[name] = True
            except:
                pass

    return fonts_registered


def get_animal_type(package_type):
    """Get animal description based on package type."""
    if package_type == 'boy':
        return 'TWO SHEEP (BABY BOY)'
    elif package_type == 'girl':
        return 'ONE SHEEP (BABY GIRL)'
    elif package_type == 'adult-male':
        return 'TWO SHEEP (ADULT MALE)'
    elif package_type == 'adult-female':
        return 'ONE SHEEP (ADULT FEMALE)'
    else:
        return 'SHEEP'


def get_hijri_year(gregorian_year):
    """Approximate Hijri year from Gregorian year."""
    # Simple approximation - accurate enough for certificate purposes
    hijri = int((gregorian_year - 622) * (33/32))
    return hijri


def draw_certificate(output_path, child_name, performance_date, certificate_id,
                      animal_type, location="EAST AFRICA", year_text=None):
    """Generate the certificate PDF with background image and text overlay.
    Layout matched to designer's sample - content vertically centered in arch area.
    """

    c = canvas.Canvas(output_path, pagesize=landscape(letter))
    c.setTitle(f"Certificate of Aqiqah - {child_name}")
    c.setAuthor("Qurbani Foundation USA")

    cx = WIDTH / 2  # Center X

    # === BACKGROUND IMAGE ===
    c.drawImage(BG_IMAGE, 0, 0, width=WIDTH, height=HEIGHT,
                preserveAspectRatio=False, mask='auto')

    # Register fonts
    fonts = register_fonts()

    # Font selections
    title_font = 'Georgia-Bold' if 'Georgia-Bold' in fonts else 'Times-Bold'
    name_font = 'Georgia-Italic' if 'Georgia-Italic' in fonts else 'Times-Italic'
    body_font = 'Helvetica'
    body_bold = 'Helvetica-Bold'

    # Logo image path
    logo_path = os.path.join(CERT_DIR, 'qurbani-logo.png')

    # === QURBANI LOGO (actual image, centered) ===
    logo_w = 1.6 * inch
    logo_h = 0.55 * inch
    y = HEIGHT - 1.05 * inch
    if os.path.exists(logo_path):
        c.drawImage(logo_path, cx - logo_w/2, y - logo_h/2,
                    width=logo_w, height=logo_h,
                    preserveAspectRatio=True, mask='auto')

    # === CERTIFICATE OF AQIQAH TITLE ===
    # Small caps style matching designer
    y -= 48
    c.setFillColor(DARK_BROWN)
    c.setFont(title_font, 28)

    # Draw "CERTIFICATE OF AQIQAH" with small caps: C bigger, rest smaller
    title_text = "Certificate of Aqiqah"
    # Use mixed case for elegant look like designer
    c.setFont(title_font, 28)
    # Measure "C" width for small-caps effect
    sc_big = 28
    sc_small = 22

    # Draw small caps manually: "C ERTIFICATE   O F   A QIQAH"
    words = [("C", sc_big, "ERTIFICATE"), ("O", sc_big, "F"), ("A", sc_big, "QIQAH")]
    # Calculate total width
    total_w = 0
    for big_char, big_size, rest in words:
        total_w += c.stringWidth(big_char, title_font, big_size)
        total_w += c.stringWidth(rest, title_font, sc_small)
    total_w += c.stringWidth("  ", title_font, sc_small) * 2  # spaces between words

    x = cx - total_w / 2
    for i, (big_char, big_size, rest) in enumerate(words):
        # Big first letter
        c.setFont(title_font, big_size)
        c.drawString(x, y, big_char)
        x += c.stringWidth(big_char, title_font, big_size)
        # Smaller rest
        c.setFont(title_font, sc_small)
        c.drawString(x, y, rest)
        x += c.stringWidth(rest, title_font, sc_small)
        # Space between words
        if i < len(words) - 1:
            x += c.stringWidth("  ", title_font, sc_small)

    # === Decorative dashes with year ===
    y -= 22
    c.setFillColor(GOLD_TEXT)
    c.setFont("Helvetica", 10)
    year_display = year_text or "2026 CE / 1447 AH"

    year_w = c.stringWidth(year_display, "Helvetica", 10)
    dash_len = 45
    dash_y = y + 3.5
    c.setStrokeColor(GOLD_TEXT)
    c.setLineWidth(0.75)
    c.line(cx - year_w/2 - dash_len - 8, dash_y, cx - year_w/2 - 4, dash_y)
    c.line(cx + year_w/2 + 4, dash_y, cx + year_w/2 + dash_len + 8, dash_y)
    # Arrow tips
    arr = 2.5
    c.line(cx - year_w/2 - dash_len - 8, dash_y, cx - year_w/2 - dash_len - 3, dash_y + arr)
    c.line(cx - year_w/2 - dash_len - 8, dash_y, cx - year_w/2 - dash_len - 3, dash_y - arr)
    c.line(cx + year_w/2 + dash_len + 8, dash_y, cx + year_w/2 + dash_len + 3, dash_y + arr)
    c.line(cx + year_w/2 + dash_len + 8, dash_y, cx + year_w/2 + dash_len + 3, dash_y - arr)
    c.drawCentredString(cx, y, year_display)

    # === THIS IS TO CERTIFY THAT ===
    y -= 24
    c.setFillColor(DARK_TEXT)
    c.setFont(body_font, 10)
    c.drawCentredString(cx, y, "THIS IS TO CERTIFY THAT")

    # === AN AQIQAH OF ... ===
    y -= 20
    fs = 9.5
    line1 = "AN AQIQAH OF "
    line1_bold = animal_type
    line1_end = " HAS BEEN SUCCESSFULLY FULFILLED"

    total_w = (c.stringWidth(line1, body_font, fs) +
               c.stringWidth(line1_bold, body_bold, fs) +
               c.stringWidth(line1_end, body_font, fs))
    x = cx - total_w / 2

    c.setFont(body_font, fs)
    c.drawString(x, y, line1)
    x += c.stringWidth(line1, body_font, fs)
    c.setFont(body_bold, fs)
    c.drawString(x, y, line1_bold)
    x += c.stringWidth(line1_bold, body_bold, fs)
    c.setFont(body_font, fs)
    c.drawString(x, y, line1_end)

    # === on [DATE] in [LOCATION] for ===
    y -= 18
    parts = [
        ("on ", body_font, 10),
        (performance_date, body_bold, 10),
        (" in ", body_font, 10),
        (location, body_bold, 10),
        (" for", body_font, 10),
    ]
    total_w = sum(c.stringWidth(t, f, s) for t, f, s in parts)
    x = cx - total_w / 2
    for text, font, size in parts:
        c.setFont(font, size)
        c.drawString(x, y, text)
        x += c.stringWidth(text, font, size)

    # === CHILD NAME (large, elegant script) ===
    y -= 38
    c.setFillColor(DARK_BROWN)
    name_size = 32
    name_width = c.stringWidth(child_name, name_font, name_size)
    if name_width > WIDTH - 2.5 * inch:
        name_size = 26
    elif name_width > WIDTH - 3 * inch:
        name_size = 28

    c.setFont(name_font, name_size)
    c.drawCentredString(cx, y, child_name)

    # === BLESSING / DUA ===
    y -= 30
    c.setFillColor(WARM_BROWN)
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(cx, y,
        "May Allah make the child a blessing for you and a blessing for the Ummah of")
    y -= 14
    c.drawCentredString(cx, y,
        "Muhammad (Allah bless him & give him peace).")

    # === RECEIPT LINE ===
    y -= 24
    c.setFillColor(RECEIPT_GRAY)
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(cx, y,
        f"CERTIFIED TO BE TRUE COPY OF A CERTIFICATE OF AQIQAH THROUGH QURBANI FOUNDATION")
    y -= 10
    c.drawCentredString(cx, y,
        f"USA (RECEIPT ID: #AQQ-{certificate_id})")

    # === BOTTOM BRANDING (matching designer: "QURBANI FOUNDATION USA | www.qurbani.com") ===
    y -= 22

    # Brand name + website on one line with separator
    c.setFillColor(DARK_BROWN)
    c.setFont(body_bold, 10)
    brand = "QURBANI FOUNDATION USA"
    sep = "  |  "
    website = "www.qurbani.com"

    total_w = (c.stringWidth(brand, body_bold, 10) +
               c.stringWidth(sep, body_font, 10) +
               c.stringWidth(website, body_font, 10))
    x = cx - total_w / 2
    c.setFont(body_bold, 10)
    c.drawString(x, y, brand)
    x += c.stringWidth(brand, body_bold, 10)
    c.setFillColor(RECEIPT_GRAY)
    c.setFont(body_font, 10)
    c.drawString(x, y, sep)
    x += c.stringWidth(sep, body_font, 10)
    c.drawString(x, y, website)

    # Contact info line
    y -= 14
    c.setFillColor(RECEIPT_GRAY)
    c.setFont("Helvetica", 7)
    c.drawCentredString(cx, y,
        "www.qurbani.com  |  1-800-900-0027  |  info@qurbani.com")

    # 501c3 line
    y -= 12
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(cx, y,
        "Qurbani Foundation USA is a registered 501(c)(3) nonprofit organization.")

    c.save()
    print(f"Certificate saved to: {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description='Generate Aqiqah Certificate PDF')
    parser.add_argument('--sample', action='store_true', help='Generate sample with real data')
    parser.add_argument('--child', type=str, help='Child name')
    parser.add_argument('--date', type=str, help='Performance date (e.g., "March 11, 2026")')
    parser.add_argument('--id', type=str, help='Certificate ID')
    parser.add_argument('--package', type=str, choices=['boy', 'girl', 'adult-male', 'adult-female'],
                        help='Package type')
    parser.add_argument('--location', type=str, default='EAST AFRICA', help='Fulfillment location')
    parser.add_argument('--output', type=str, help='Custom output path')

    args = parser.parse_args()

    os.makedirs(CERT_DIR, exist_ok=True)

    if args.sample:
        # Sample certificate with real donation data
        output = args.output or os.path.join(CERT_DIR, 'aqiqah-certificate-sample.pdf')
        draw_certificate(
            output_path=output,
            child_name="Layla Sayed Sughayer",
            performance_date="March 11, 2026",
            certificate_id="F1AFE7",
            animal_type="ONE SHEEP (BABY GIRL)",
            location="EAST AFRICA",
            year_text="2026 CE / 1447 AH"
        )
    elif args.child:
        # Custom certificate
        output = args.output or os.path.join(CERT_DIR, f'aqiqah-certificate-{args.id or "custom"}.pdf')
        animal = get_animal_type(args.package) if args.package else 'SHEEP'
        draw_certificate(
            output_path=output,
            child_name=args.child,
            performance_date=args.date or "DATE",
            certificate_id=args.id or "000000",
            animal_type=animal,
            location=args.location,
        )
    else:
        # Template with placeholders
        output = args.output or os.path.join(CERT_DIR, 'aqiqah-certificate.pdf')
        draw_certificate(
            output_path=output,
            child_name="CHILD_NAME_PLACEHOLDER",
            performance_date="DATE_PLACEHOLDER",
            certificate_id="CERTIFICATE_ID_PLACEHOLDER",
            animal_type="ANIMAL_TYPE_PLACEHOLDER",
            location="LOCATION_PLACEHOLDER",
            year_text="YEAR_PLACEHOLDER"
        )


if __name__ == '__main__':
    main()
