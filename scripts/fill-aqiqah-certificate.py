#!/usr/bin/env python3
"""
Fill Aqiqah Certificate Template with donor data.
Uses the designer's PNG template and overlays dynamic text (date, city, name, receipt ID).
Outputs both PNG and PDF versions.
"""

import os
import sys
import argparse
from PIL import Image, ImageDraw, ImageFont

# Paths
CERT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        'src', 'templates', 'certificates')
GIRL_TEMPLATE = os.path.join(CERT_DIR, 'QF-Girl-Certificate.png')
BOY_TEMPLATE = os.path.join(CERT_DIR, 'QF-Boy-Certificate.png')

# Font paths (macOS)
FONT_DIR = '/System/Library/Fonts/Supplemental'
GEORGIA_BOLD = os.path.join(FONT_DIR, 'Georgia Bold.ttf')
GEORGIA_ITALIC = os.path.join(FONT_DIR, 'Georgia Italic.ttf')
GEORGIA_BOLD_ITALIC = os.path.join(FONT_DIR, 'Georgia Bold Italic.ttf')
GEORGIA = os.path.join(FONT_DIR, 'Georgia.ttf')

# Template dimensions: 3173 x 2115 px
# Text color matching the dark brown on the certificate
DARK_BROWN = (74, 42, 8)  # #4a2a08 — matches the body text
NAME_BROWN = (74, 42, 8)  # Same dark brown for the name
RECEIPT_GRAY = (120, 100, 80)  # Slightly lighter for receipt


def fill_certificate(template_path, output_path, child_name, date_text,
                     city="Pakistan", receipt_id="", output_pdf=True):
    """
    Overlay dynamic text onto the designer's certificate template.

    Args:
        template_path: Path to the blank certificate PNG
        output_path: Output file path (without extension)
        child_name: Child's name to display
        date_text: Performance date string (e.g., "March 11, 2026")
        city: City/country where performed
        receipt_id: Donation receipt/transaction ID
        output_pdf: Also save as PDF
    """
    # Load template
    img = Image.open(template_path).convert('RGBA')
    draw = ImageDraw.Draw(img)
    w, h = img.size  # 3173 x 2115

    # Load fonts at appropriate sizes for the template resolution
    try:
        font_date = ImageFont.truetype(GEORGIA_BOLD, 52)
        font_city = ImageFont.truetype(GEORGIA_BOLD, 52)
        font_name = ImageFont.truetype(GEORGIA_BOLD_ITALIC, 110)
        font_receipt = ImageFont.truetype(GEORGIA, 42)
    except OSError:
        print("Warning: Georgia fonts not found, using default")
        font_date = ImageFont.load_default()
        font_city = ImageFont.load_default()
        font_name = ImageFont.load_default()
        font_receipt = ImageFont.load_default()

    cx = w // 2  # Center X = 1586

    # The template has these fixed lines (top to bottom):
    # 1. Logo + "CERTIFICATE OF AQIQAH" + year  (pre-printed)
    # 2. "THIS IS TO CERTIFY THAT"               (pre-printed)
    # 3. "AN AQIQAH OF ONE SHEEP (BABY GIRL)..."  (pre-printed)
    # 4. "on __________ in __________ for"        (blanks to fill)
    # 5. [CHILD NAME - big blank area]            (to fill)
    # 6. Blessing/dua text                        (pre-printed)
    # 7. Receipt ID: #_______                     (blank to fill)

    # === DATE on the underline after "on" ===
    # "on ___ in ___ for" line — text baseline at y~1090
    # First underline (after "on") center ~x=1000
    date_y = 1098
    date_cx = 1250
    date_bbox = draw.textbbox((0, 0), date_text, font=font_date)
    date_w = date_bbox[2] - date_bbox[0]
    draw.text((date_cx - date_w // 2, date_y), date_text, fill=DARK_BROWN, font=font_date)

    # === CITY on the underline after "in" ===
    # Second underline (after "in") center ~x=1650
    city_cx = 1850
    city_bbox = draw.textbbox((0, 0), city, font=font_city)
    city_w = city_bbox[2] - city_bbox[0]
    draw.text((city_cx - city_w // 2, date_y), city, fill=DARK_BROWN, font=font_city)

    # === CHILD NAME — in the blank area between "for" and the blessing/divider ===
    # Blank area runs from ~y=1140 to ~y=1310 (below "for", above ornament divider)
    # Center name vertically in this space
    name_y = 1230

    # Auto-size: reduce font if name is too wide
    name_font_size = 110
    while True:
        test_font = ImageFont.truetype(GEORGIA_BOLD_ITALIC, name_font_size)
        name_bbox = draw.textbbox((0, 0), child_name, font=test_font)
        name_w = name_bbox[2] - name_bbox[0]
        if name_w < w - 700 or name_font_size <= 60:
            font_name = test_font
            break
        name_font_size -= 5

    name_bbox = draw.textbbox((0, 0), child_name, font=font_name)
    name_w = name_bbox[2] - name_bbox[0]
    draw.text((cx - name_w // 2, name_y), child_name, fill=NAME_BROWN, font=font_name)

    # === RECEIPT ID after the "#" ===
    # "(RECEIPT ID: #___)" line is at approximately y=1730
    if receipt_id:
        receipt_y = 1745
        receipt_text = receipt_id
        # The "#" ends at roughly x=1680, place ID right after
        receipt_x = 1710
        draw.text((receipt_x, receipt_y), receipt_text, fill=DARK_BROWN, font=font_receipt)

    # Save PNG
    png_path = output_path + '.png'
    # Convert to RGB for saving (remove alpha)
    img_rgb = img.convert('RGB')
    img_rgb.save(png_path, 'PNG', dpi=(300, 300))
    print(f"Certificate PNG saved to: {png_path}")

    # Save PDF
    if output_pdf:
        pdf_path = output_path + '.pdf'
        # A4 landscape at 300 DPI: 3508 x 2480, but we'll use the image as-is
        # Scale to US Letter landscape: 11x8.5 inches
        img_rgb.save(pdf_path, 'PDF', resolution=300.0,
                     title=f"Certificate of Aqiqah - {child_name}",
                     author="Qurbani Foundation USA")
        print(f"Certificate PDF saved to: {pdf_path}")

    return png_path, pdf_path if output_pdf else None


def main():
    parser = argparse.ArgumentParser(description='Fill Aqiqah Certificate')
    parser.add_argument('--name', default='Layla Sayed Sughayer',
                        help='Child name')
    parser.add_argument('--date', default='March 11, 2026',
                        help='Aqiqah performance date')
    parser.add_argument('--city', default='Pakistan',
                        help='City/country where performed')
    parser.add_argument('--receipt', default='AQQ-F1AFE7',
                        help='Receipt/transaction ID (e.g. AQQ-F1AFE7)')
    parser.add_argument('--type', default='girl', choices=['girl', 'boy'],
                        help='Package type: girl (1 sheep) or boy (2 sheep)')
    parser.add_argument('--template', default=None,
                        help='Override template PNG path')
    parser.add_argument('--output', default=None,
                        help='Output path (without extension)')
    args = parser.parse_args()

    # Select template based on type
    template = args.template or (BOY_TEMPLATE if args.type == 'boy' else GIRL_TEMPLATE)
    output = args.output or os.path.join(CERT_DIR, 'aqiqah-certificate-filled')

    fill_certificate(
        template_path=template,
        output_path=output,
        child_name=args.name,
        date_text=args.date,
        city=args.city,
        receipt_id=args.receipt,
    )


if __name__ == '__main__':
    main()
