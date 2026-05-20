from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import anthropic
import requests
import os
import threading
import time
import json
from pathlib import Path
from datetime import datetime

load_dotenv()

app = Flask(__name__)
CORS(app)

SHOPIFY_STORE_URL = os.getenv("SHOPIFY_STORE_URL")
SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")
SLACK_LOW_STOCK_WEBHOOK = os.getenv("SLACK_LOW_STOCK_WEBHOOK")
SLACK_REORDER_WEBHOOK = os.getenv("SLACK_REORDER_WEBHOOK")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL")
SENDGRID_TO_EMAILS = os.getenv("SENDGRID_TO_EMAILS", "").split(",")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
API_VERSION = "2025-01"

HEADERS = {
    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
    "Content-Type": "application/json"
}

LOW_STOCK_TRIGGER = 5
POLL_INTERVAL = 15
last_known_qty = {}

SETTINGS_FILE = Path(__file__).parent / "reorder_settings.json"
HISTORY_FILE = Path(__file__).parent / "reorder_history.json"

DEFAULT_PRODUCT_SETTINGS = {
    "LTP-001": { "threshold": 10, "reorder_qty": 50, "supplier_name": "Casa Linen Co.", "supplier_email": "orders@casalinen.com", "lead_time": "5 days", "auto_send": True },
    "CVS-002": { "threshold": 15, "reorder_qty": 30, "supplier_name": "ArtCraft Supply", "supplier_email": "po@artcraftsupply.com", "lead_time": "7 days", "auto_send": False },
    "BPF-003": { "threshold": 10, "reorder_qty": 40, "supplier_name": "EcoFrame Ltd.", "supplier_email": "sales@ecoframe.com", "lead_time": "4 days", "auto_send": True },
    "WSB-004": { "threshold": 5, "reorder_qty": 25, "supplier_name": "Weave & Co.", "supplier_email": "orders@weaveandco.com", "lead_time": "6 days", "auto_send": True },
    "MCS-005": { "threshold": 10, "reorder_qty": 20, "supplier_name": "Stone & Style", "supplier_email": "po@stoneandstyle.com", "lead_time": "8 days", "auto_send": False },
    "LTR-006": { "threshold": 8, "reorder_qty": 35, "supplier_name": "Casa Linen Co.", "supplier_email": "orders@casalinen.com", "lead_time": "5 days", "auto_send": True },
    "RWM-007": { "threshold": 10, "reorder_qty": 15, "supplier_name": "Rattan Works", "supplier_email": "supply@rattanworks.com", "lead_time": "10 days", "auto_send": True },
    "SCS-008": { "threshold": 8, "reorder_qty": 45, "supplier_name": "Pure Wick Co.", "supplier_email": "orders@purewick.com", "lead_time": "3 days", "auto_send": True }
}

DEFAULT_SETTINGS = {
    "auto_reorder_enabled": True,
    "global_reorder_qty": 0,
    "products": DEFAULT_PRODUCT_SETTINGS
}

def get_default_product_setting(auto_reorder_enabled=True, global_reorder_qty=0):
    """Generate default settings for any new product not in the hardcoded list"""
    qty = global_reorder_qty if global_reorder_qty and global_reorder_qty > 0 else 20
    return {
        "threshold": 10,
        "reorder_qty": qty,
        "supplier_name": "",
        "supplier_email": "",
        "lead_time": "5-7 days",
        "auto_send": auto_reorder_enabled
    }

def load_settings():
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r") as f:
            return json.load(f)
    return DEFAULT_SETTINGS.copy()

def save_settings_to_file(settings):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=2)

def load_history():
    if HISTORY_FILE.exists():
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    return []

def save_history(entry):
    history = load_history()
    history.insert(0, entry)
    history = history[:100]
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)

def get_status(inventory, threshold):
    if inventory == 0:
        return "critical"
    elif inventory <= threshold * 0.5:
        return "critical"
    elif inventory <= threshold:
        return "low"
    return "ok"

def build_display_title(product_title, variant_title):
    """Build display title with variant if it's not the default single variant"""
    if not variant_title or variant_title.lower() in ["default title", "default"]:
        return product_title
    return f"{product_title} — {variant_title}"

def ensure_product_in_settings(settings, sku):
    """Ensure any new product has settings, inheriting global defaults"""
    if sku not in settings["products"]:
        settings["products"][sku] = get_default_product_setting(
            auto_reorder_enabled=settings.get("auto_reorder_enabled", True),
            global_reorder_qty=settings.get("global_reorder_qty", 0)
        )
        save_settings_to_file(settings)
    return settings

def get_ai_forecast(product):
    print(f"[StockPulse] Getting AI forecast for {product['title']}, API key present: {bool(ANTHROPIC_API_KEY)}")
    if not ANTHROPIC_API_KEY:
        print("[StockPulse] No Anthropic API key found")
        return None
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        location_text = ", ".join([f"{loc['location']}: {loc['quantity']} units" for loc in product["locations"]])
        status = product["status"]
        inventory = product["inventory"]
        threshold = product["threshold"]

        if inventory == 0:
            urgency = "completely out of stock across all warehouses"
        elif status == "critical":
            urgency = f"critically low at {inventory} units, which is less than 50% of the reorder threshold"
        else:
            urgency = f"below the reorder threshold at {inventory} units"

        prompt = f"""You are an inventory analyst for Harlow & Co., a premium home décor retailer with 3 warehouses.

Product: {product['title']} (SKU: {product['sku']})
Current Total Stock: {inventory} units
Reorder Threshold: {threshold} units
Status: {status.upper()} — {urgency}
Stock by Location: {location_text}

Note: We don't have historical sales data, but based on the inventory levels and typical home décor retail patterns, provide a practical 1-2 sentence forecast. Assume this is a mid-velocity product selling 1-3 units per day across all locations. Be direct and actionable — mention estimated days until stockout and a recommended reorder quantity to cover 30-45 days of demand. Do not use bullet points or hedging language."""

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}]
        )
        forecast = message.content[0].text
        print(f"[StockPulse] AI forecast success: {forecast[:60]}...")
        return forecast
    except Exception as e:
        print(f"[StockPulse] AI forecast error: {type(e).__name__}: {e}")
        return None

def get_ai_qty_recommendation(product, settings):
    if not ANTHROPIC_API_KEY:
        return None
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        ps = settings.get("products", {}).get(product["sku"], {})
        lead_time = ps.get("lead_time", "5-7 days")
        location_text = ", ".join([f"{loc['location']}: {loc['quantity']} units" for loc in product["locations"]])
        location_names = {loc["location"]: loc["quantity"] for loc in product["locations"]}

        prompt = f"""You are an inventory analyst for Harlow & Co., a premium home décor retailer.

Product: {product['title']} (SKU: {product['sku']})
Current Total Stock: {product['inventory']} units
Reorder Threshold: {product['threshold']} units
Status: {product['status'].upper()}
Stock by Location: {location_text}
Supplier Lead Time: {lead_time}

Recommend a reorder quantity per warehouse to cover 45 days of demand. Assume 1-3 units sold per day total across all locations. Distribute evenly across warehouses unless current stock imbalance suggests otherwise.

Respond ONLY with valid JSON, no other text:
{{"total_qty": 45, "per_warehouse": {json.dumps({k: 15 for k in location_names})}, "reasoning": "One sentence explanation of the recommendation"}}"""

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=250,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        print(f"[StockPulse] AI qty raw: {raw}")
        data = json.loads(raw)
        return data
    except Exception as e:
        print(f"[StockPulse] AI qty error: {type(e).__name__}: {e}")
        return None

def send_email(subject, html_content):
    if not SENDGRID_API_KEY or not SENDGRID_FROM_EMAIL:
        return
    try:
        for to_email in SENDGRID_TO_EMAILS:
            to_email = to_email.strip()
            if not to_email:
                continue
            message = Mail(from_email=SENDGRID_FROM_EMAIL, to_emails=to_email, subject=subject, html_content=html_content)
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            sg.send(message)
            print(f"[StockPulse] Email sent to {to_email}")
    except Exception as e:
        print(f"[StockPulse] Email error: {e}")

def build_low_stock_email(product, forecast=None):
    status = product["status"]
    color = "#ef4444" if status == "critical" else "#f97316"
    emoji = "🔴" if status == "critical" else "🟡"
    status_label = "Critical Stock Alert" if status == "critical" else "Low Stock Alert"
    location_rows = "".join([
        f"<tr><td style='padding:8px 0;color:rgba(255,255,255,0.45);font-size:12px;'>{loc['location']}</td><td style='padding:8px 0;text-align:right;'><span style='font-size:12px;font-weight:500;color:rgba(255,255,255,0.65);'>{loc['quantity']}</span></td></tr>"
        for loc in product["locations"]
    ])
    ai_section = ""
    if forecast:
        ai_section = f"""<tr><td style="padding:0 28px 20px;">
            <div style="background:rgba(100,200,220,0.08);border:0.5px solid rgba(100,200,220,0.2);border-radius:10px;padding:14px 16px;">
                <div style="font-size:8px;color:rgba(100,200,220,0.6);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">⚡ AI Forecast</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.75);line-height:1.6;">{forecast}</div>
            </div>
        </td></tr>"""
    return f"""<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#07111a;border-radius:16px;overflow:hidden;border:0.5px solid rgba(255,255,255,0.08);">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:18px 28px;border-bottom:0.5px solid rgba(255,255,255,0.06);">
                <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:10px;color:rgba(255,255,255,0.55);letter-spacing:4px;text-transform:uppercase;">StockPulse</td>
                    <td style="text-align:right;font-size:9px;color:rgba(255,255,255,0.22);letter-spacing:2px;text-transform:uppercase;">Harlow &amp; Co.</td>
                </tr></table>
            </td></tr>
            <tr><td style="padding:36px 28px 28px;text-align:center;">
                <div style="font-size:44px;margin-bottom:14px;">{emoji}</div>
                <div style="font-size:22px;font-weight:500;color:rgba(255,255,255,0.92);margin-bottom:6px;">{status_label}</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.32);letter-spacing:1px;">{product['title']} &middot; {product['sku']}</div>
            </td></tr>
            <tr><td style="padding:0 28px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
                    <tr><td style="padding:10px 16px;border-bottom:0.5px solid rgba(255,255,255,0.06);"><span style="font-size:8px;color:rgba(255,255,255,0.28);letter-spacing:2px;text-transform:uppercase;">Inventory Summary</span></td></tr>
                    <tr><td><table width="100%" cellpadding="0" cellspacing="0"><tr>
                        <td width="33%" style="padding:16px;border-right:0.5px solid rgba(255,255,255,0.06);"><div style="font-size:8px;color:rgba(255,255,255,0.28);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Total Stock</div><div style="font-size:24px;font-weight:500;color:{color};">{product['inventory']}</div></td>
                        <td width="33%" style="padding:16px;border-right:0.5px solid rgba(255,255,255,0.06);"><div style="font-size:8px;color:rgba(255,255,255,0.28);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Threshold</div><div style="font-size:24px;font-weight:500;color:rgba(255,255,255,0.35);">{product['threshold']}</div></td>
                        <td width="33%" style="padding:16px;"><div style="font-size:8px;color:rgba(255,255,255,0.28);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Status</div><div style="font-size:13px;font-weight:500;color:{color};text-transform:uppercase;">{status}</div></td>
                    </tr></table></td></tr>
                </table>
            </td></tr>
            <tr><td style="padding:0 28px 20px;">
                <div style="font-size:8px;color:rgba(255,255,255,0.25);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">By Location</div>
                <table width="100%" cellpadding="0" cellspacing="0">{location_rows}</table>
            </td></tr>
            {ai_section}
            <tr><td style="padding:0 28px 28px;">
                <div style="background:{color}12;border:0.5px solid {color}30;border-radius:10px;padding:14px;text-align:center;">
                    <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:{color};">Log into StockPulse to trigger a reorder</span>
                </div>
            </td></tr>
            <tr><td style="padding:14px 28px;border-top:0.5px solid rgba(255,255,255,0.05);text-align:center;">
                <span style="font-size:9px;color:rgba(255,255,255,0.18);letter-spacing:1.5px;text-transform:uppercase;">StockPulse &middot; Inventory Automation &middot; 2026</span>
            </td></tr>
        </table>
    </div>"""

def build_reorder_email(product):
    location_rows = "".join([
        f"<tr><td style='padding:8px 0;color:rgba(255,255,255,0.45);font-size:12px;'>{loc['location']}</td><td style='padding:8px 0;text-align:right;'><span style='font-size:12px;font-weight:500;color:rgba(255,255,255,0.65);'>{loc['quantity']}</span></td></tr>"
        for loc in product["locations"]
    ])
    return f"""<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#07111a;border-radius:16px;overflow:hidden;border:0.5px solid rgba(255,255,255,0.08);">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:18px 28px;border-bottom:0.5px solid rgba(255,255,255,0.06);">
                <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:10px;color:rgba(255,255,255,0.55);letter-spacing:4px;text-transform:uppercase;">StockPulse</td>
                    <td style="text-align:right;font-size:9px;color:rgba(255,255,255,0.22);letter-spacing:2px;text-transform:uppercase;">Harlow &amp; Co.</td>
                </tr></table>
            </td></tr>
            <tr><td style="padding:36px 28px 28px;text-align:center;">
                <div style="font-size:44px;margin-bottom:14px;">📦</div>
                <div style="font-size:22px;font-weight:500;color:rgba(255,255,255,0.92);margin-bottom:6px;">Reorder Confirmed</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.32);letter-spacing:1px;">{product['title']} &middot; {product['sku']}</div>
            </td></tr>
            <tr><td style="padding:0 28px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
                    <tr><td style="padding:10px 16px;border-bottom:0.5px solid rgba(255,255,255,0.06);"><span style="font-size:8px;color:rgba(255,255,255,0.28);letter-spacing:2px;text-transform:uppercase;">Reorder Summary</span></td></tr>
                    <tr><td><table width="100%" cellpadding="0" cellspacing="0"><tr>
                        <td width="33%" style="padding:16px;border-right:0.5px solid rgba(255,255,255,0.06);"><div style="font-size:8px;color:rgba(255,255,255,0.28);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Current Stock</div><div style="font-size:24px;font-weight:500;color:#818cf8;">{product['inventory']}</div></td>
                        <td width="33%" style="padding:16px;border-right:0.5px solid rgba(255,255,255,0.06);"><div style="font-size:8px;color:rgba(255,255,255,0.28);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">SKU</div><div style="font-size:14px;font-weight:500;color:rgba(255,255,255,0.4);padding-top:4px;">{product['sku']}</div></td>
                        <td width="33%" style="padding:16px;"><div style="font-size:8px;color:rgba(255,255,255,0.28);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">ETA</div><div style="font-size:13px;font-weight:500;color:#818cf8;padding-top:4px;">3-5 days</div></td>
                    </tr></table></td></tr>
                </table>
            </td></tr>
            <tr><td style="padding:0 28px 20px;">
                <div style="font-size:8px;color:rgba(255,255,255,0.25);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">By Location</div>
                <table width="100%" cellpadding="0" cellspacing="0">{location_rows}</table>
            </td></tr>
            <tr><td style="padding:0 28px 28px;">
                <div style="background:rgba(99,102,241,0.08);border:0.5px solid rgba(99,102,241,0.2);border-radius:10px;padding:14px;text-align:center;">
                    <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#818cf8;">Supplier notified &middot; Restock in 3-5 business days</span>
                </div>
            </td></tr>
            <tr><td style="padding:14px 28px;border-top:0.5px solid rgba(255,255,255,0.05);text-align:center;">
                <span style="font-size:9px;color:rgba(255,255,255,0.18);letter-spacing:1.5px;text-transform:uppercase;">StockPulse &middot; Inventory Automation &middot; 2026</span>
            </td></tr>
        </table>
    </div>"""

def send_low_stock_alert(product):
    if not SLACK_LOW_STOCK_WEBHOOK:
        return
    forecast = get_ai_forecast(product)
    status = product["status"]
    emoji = "🔴" if status == "critical" else "🟡"
    color = "#ef4444" if status == "critical" else "#f97316"
    location_text = "\n".join([f"• {loc['location']}: *{loc['quantity']} units*" for loc in product["locations"]])
    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f"{emoji} Low Stock Alert -- {product['title']} dropped to {product['inventory']} units"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Product:*\n{product['title']}"},
            {"type": "mrkdwn", "text": f"*SKU:*\n{product['sku']}"},
            {"type": "mrkdwn", "text": f"*Total Stock:*\n{product['inventory']} units"},
            {"type": "mrkdwn", "text": f"*Threshold:*\n{product['threshold']} units"}
        ]},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Inventory by Location:*\n{location_text}"}},
    ]
    if forecast:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f"*⚡ AI Forecast:*\n{forecast}"}})
    blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": "*Action Required:* Head to the StockPulse dashboard to trigger a reorder."}})
    requests.post(SLACK_LOW_STOCK_WEBHOOK, json={"attachments": [{"color": color, "blocks": blocks}]})
    send_email(subject=f"🔴 StockPulse Alert — {product['title']} is {status.upper()}", html_content=build_low_stock_email(product, forecast))

def send_reorder_alert(product):
    if not SLACK_REORDER_WEBHOOK:
        return
    location_text = "\n".join([f"• {loc['location']}: *{loc['quantity']} units*" for loc in product["locations"]])
    requests.post(SLACK_REORDER_WEBHOOK, json={"attachments": [{"color": "#6366f1", "blocks": [
        {"type": "header", "text": {"type": "plain_text", "text": f"📦 Reorder Triggered -- {product['title']}"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Product:*\n{product['title']}"},
            {"type": "mrkdwn", "text": f"*SKU:*\n{product['sku']}"},
            {"type": "mrkdwn", "text": f"*Current Stock:*\n{product['inventory']} units"},
            {"type": "mrkdwn", "text": f"*Threshold:*\n{product['threshold']} units"}
        ]},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Inventory by Location:*\n{location_text}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Reorder triggered* for *{product['title']}*. Supplier notification sent."}}
    ]}]})
    send_email(subject=f"📦 StockPulse — Reorder Triggered for {product['title']}", html_content=build_reorder_email(product))

def fetch_products_with_variants():
    """Fetch all products and return one entry per variant with proper display title"""
    settings = load_settings()
    products_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/products.json?limit=250", headers=HEADERS).json()
    locations_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/locations.json", headers=HEADERS).json()
    locations = {loc["id"]: loc["name"] for loc in locations_data["locations"]}
    results = []

    for product in products_data.get("products", []):
        for variant in product["variants"]:
            sku = variant["sku"] or f"VAR-{variant['id']}"
            display_title = build_display_title(product["title"], variant["title"])
            settings = ensure_product_in_settings(settings, sku)
            threshold = settings["products"][sku].get("threshold", 10)

            inv_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/inventory_levels.json?inventory_item_ids={variant['inventory_item_id']}", headers=HEADERS).json()
            location_breakdown = []
            total_inventory = 0
            for level in inv_data.get("inventory_levels", []):
                qty = level["available"] or 0
                total_inventory += qty
                location_breakdown.append({"location": locations.get(level["location_id"], "Unknown"), "quantity": qty})

            results.append({
                "id": variant["id"],
                "product_id": product["id"],
                "title": display_title,
                "sku": sku,
                "inventory": total_inventory,
                "threshold": threshold,
                "status": get_status(total_inventory, threshold),
                "locations": location_breakdown
            })

    return results

def fetch_inventory():
    try:
        results = fetch_products_with_variants()
        settings = load_settings()
        for item in results:
            sku = item["sku"]
            prev_qty = last_known_qty.get(sku)
            if item["inventory"] < LOW_STOCK_TRIGGER:
                if prev_qty is not None and item["inventory"] < prev_qty:
                    print(f"[StockPulse] Alert: {item['title']} dropped to {item['inventory']} units")
                    send_low_stock_alert(item)
            last_known_qty[sku] = item["inventory"]
    except Exception as e:
        print(f"[StockPulse] Polling error: {e}")

def start_polling():
    print(f"[StockPulse] Starting inventory polling every {POLL_INTERVAL} seconds...")
    while True:
        fetch_inventory()
        time.sleep(POLL_INTERVAL)

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "StockPulse API is running"})

@app.route("/api/inventory")
def get_inventory():
    try:
        results = fetch_products_with_variants()
        return jsonify({"store": "Harlow & Co.", "products": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/forecast/<int:variant_id>", methods=["GET"])
def get_forecast(variant_id):
    try:
        settings = load_settings()
        locations_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/locations.json", headers=HEADERS).json()
        locations = {loc["id"]: loc["name"] for loc in locations_data["locations"]}

        # Find the variant across all products
        products_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/products.json?limit=250", headers=HEADERS).json()
        found_variant = None
        found_product = None
        for product in products_data.get("products", []):
            for variant in product["variants"]:
                if variant["id"] == variant_id:
                    found_variant = variant
                    found_product = product
                    break
            if found_variant:
                break

        if not found_variant:
            return jsonify({"success": False, "error": "Variant not found"}), 404

        sku = found_variant["sku"] or f"VAR-{found_variant['id']}"
        display_title = build_display_title(found_product["title"], found_variant["title"])
        threshold = settings["products"].get(sku, {}).get("threshold", 10)

        inv_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/inventory_levels.json?inventory_item_ids={found_variant['inventory_item_id']}", headers=HEADERS).json()
        location_breakdown = []
        total_inventory = 0
        for level in inv_data.get("inventory_levels", []):
            qty = level["available"] or 0
            total_inventory += qty
            location_breakdown.append({"location": locations.get(level["location_id"], "Unknown"), "quantity": qty})

        product_payload = {
            "id": found_variant["id"], "title": display_title, "sku": sku,
            "inventory": total_inventory, "threshold": threshold,
            "status": get_status(total_inventory, threshold),
            "locations": location_breakdown
        }
        forecast = get_ai_forecast(product_payload)
        return jsonify({"success": True, "forecast": forecast, "product": product_payload})
    except Exception as e:
        print(f"[StockPulse] Forecast error: {type(e).__name__}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/forecast-qty/<int:variant_id>", methods=["GET"])
def get_forecast_qty(variant_id):
    try:
        settings = load_settings()
        locations_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/locations.json", headers=HEADERS).json()
        locations = {loc["id"]: loc["name"] for loc in locations_data["locations"]}

        products_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/products.json?limit=250", headers=HEADERS).json()
        found_variant = None
        found_product = None
        for product in products_data.get("products", []):
            for variant in product["variants"]:
                if variant["id"] == variant_id:
                    found_variant = variant
                    found_product = product
                    break
            if found_variant:
                break

        if not found_variant:
            return jsonify({"success": False, "error": "Variant not found"}), 404

        sku = found_variant["sku"] or f"VAR-{found_variant['id']}"
        display_title = build_display_title(found_product["title"], found_variant["title"])
        threshold = settings["products"].get(sku, {}).get("threshold", 10)

        inv_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/inventory_levels.json?inventory_item_ids={found_variant['inventory_item_id']}", headers=HEADERS).json()
        location_breakdown = []
        total_inventory = 0
        for level in inv_data.get("inventory_levels", []):
            qty = level["available"] or 0
            total_inventory += qty
            location_breakdown.append({"location": locations.get(level["location_id"], "Unknown"), "quantity": qty})

        product_payload = {
            "id": found_variant["id"], "title": display_title, "sku": sku,
            "inventory": total_inventory, "threshold": threshold,
            "status": get_status(total_inventory, threshold),
            "locations": location_breakdown
        }
        recommendation = get_ai_qty_recommendation(product_payload, settings)
        return jsonify({"success": True, "recommendation": recommendation})
    except Exception as e:
        print(f"[StockPulse] Forecast qty error: {type(e).__name__}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/history", methods=["GET"])
def get_history():
    return jsonify(load_history())

@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify(load_settings())

@app.route("/api/settings", methods=["POST"])
def update_settings():
    data = request.get_json()
    save_settings_to_file(data)
    return jsonify({"success": True, "message": "Settings saved"})

@app.route("/api/reorder/<int:variant_id>", methods=["POST"])
def trigger_reorder(variant_id):
    try:
        settings = load_settings()
        locations_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/locations.json", headers=HEADERS).json()
        locations = {loc["id"]: loc["name"] for loc in locations_data["locations"]}

        products_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/products.json?limit=250", headers=HEADERS).json()
        found_variant = None
        found_product = None
        for product in products_data.get("products", []):
            for variant in product["variants"]:
                if variant["id"] == variant_id:
                    found_variant = variant
                    found_product = product
                    break
            if found_variant:
                break

        if not found_variant:
            return jsonify({"success": False, "error": "Variant not found"}), 404

        sku = found_variant["sku"] or f"VAR-{found_variant['id']}"
        display_title = build_display_title(found_product["title"], found_variant["title"])
        threshold = settings["products"].get(sku, {}).get("threshold", 10)

        inv_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/inventory_levels.json?inventory_item_ids={found_variant['inventory_item_id']}", headers=HEADERS).json()
        location_breakdown = []
        total_inventory = 0
        for level in inv_data.get("inventory_levels", []):
            qty = level["available"] or 0
            total_inventory += qty
            location_breakdown.append({"location": locations.get(level["location_id"], "Unknown"), "quantity": qty})

        product_payload = {
            "id": found_variant["id"], "title": display_title, "sku": sku,
            "inventory": total_inventory, "threshold": threshold,
            "status": get_status(total_inventory, threshold),
            "locations": location_breakdown
        }

        send_reorder_alert(product_payload)
        body = request.get_json() or {}
        save_history({
            "id": found_variant["id"],
            "title": display_title,
            "sku": sku,
            "inventory_at_reorder": total_inventory,
            "total_qty_ordered": body.get("total_qty", settings["products"].get(sku, {}).get("reorder_qty", 0)),
            "qty_per_warehouse": body.get("qty_per_warehouse", {}),
            "supplier_name": settings["products"].get(sku, {}).get("supplier_name", ""),
            "supplier_email": settings["products"].get(sku, {}).get("supplier_email", ""),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": get_status(total_inventory, threshold)
        })
        return jsonify({"success": True, "message": f"Reorder triggered for {display_title}.", "product": product_payload})
    except Exception as e:
        print(f"[StockPulse] Reorder error: {type(e).__name__}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/po/<int:variant_id>", methods=["POST"])
def send_purchase_order(variant_id):
    try:
        settings = load_settings()
        products_data = requests.get(f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/products.json?limit=250", headers=HEADERS).json()
        found_variant = None
        found_product = None
        for product in products_data.get("products", []):
            for variant in product["variants"]:
                if variant["id"] == variant_id:
                    found_variant = variant
                    found_product = product
                    break
            if found_variant:
                break

        if not found_variant:
            return jsonify({"success": False, "error": "Variant not found"}), 404

        sku = found_variant["sku"] or f"VAR-{found_variant['id']}"
        display_title = build_display_title(found_product["title"], found_variant["title"])
        ps = settings["products"].get(sku, {})
        supplier_email = ps.get("supplier_email")
        supplier_name = ps.get("supplier_name", "Supplier")
        reorder_qty = ps.get("reorder_qty", 20)
        lead_time = ps.get("lead_time", "5-7 days")

        if not supplier_email:
            return jsonify({"success": False, "message": "No supplier email configured"}), 400

        po_html = f"""<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#07111a;border-radius:16px;padding:28px;border:0.5px solid rgba(255,255,255,0.08);">
            <p style="color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;">StockPulse &middot; Purchase Order</p>
            <h2 style="color:rgba(255,255,255,0.9);margin:12px 0;">PO Request — {display_title}</h2>
            <p style="color:rgba(255,255,255,0.6);font-size:13px;">SKU: {sku} &middot; Qty: {reorder_qty} units &middot; Lead Time: {lead_time}</p>
            <p style="color:rgba(255,255,255,0.6);font-size:13px;">Supplier: {supplier_name}</p>
            <p style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:20px;">Please confirm receipt and expected ship date. &mdash; Harlow &amp; Co. Operations</p>
        </div>"""

        send_email(subject=f"📋 PO Sent — {display_title} ({reorder_qty} units)", html_content=po_html)
        try:
            msg = Mail(from_email=SENDGRID_FROM_EMAIL, to_emails=supplier_email, subject=f"PO Request from Harlow & Co. — {display_title} ({reorder_qty} units)", html_content=po_html)
            SendGridAPIClient(SENDGRID_API_KEY).send(msg)
        except Exception as e:
            print(f"[StockPulse] PO email error: {e}")

        return jsonify({"success": True, "message": f"PO sent to {supplier_name}"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    poll_thread = threading.Thread(target=start_polling, daemon=True)
    poll_thread.start()
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)