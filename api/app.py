from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import requests
import os
import threading
import time

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
API_VERSION = "2025-01"

HEADERS = {
    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
    "Content-Type": "application/json"
}

THRESHOLDS = {
    "LTP-001": 10,
    "CVS-002": 15,
    "BPF-003": 10,
    "WSB-004": 5,
    "MCS-005": 10,
    "LTR-006": 8,
    "RWM-007": 10,
    "SCS-008": 8
}

LOW_STOCK_TRIGGER = 5
POLL_INTERVAL = 15

last_known_qty = {}

def get_status(inventory, threshold):
    if inventory == 0:
        return "critical"
    elif inventory <= threshold * 0.5:
        return "critical"
    elif inventory <= threshold:
        return "low"
    return "ok"

def send_email(subject, html_content):
    if not SENDGRID_API_KEY or not SENDGRID_FROM_EMAIL or not SENDGRID_TO_EMAILS:
        return
    try:
        for to_email in SENDGRID_TO_EMAILS:
            to_email = to_email.strip()
            if not to_email:
                continue
            message = Mail(
                from_email=SENDGRID_FROM_EMAIL,
                to_emails=to_email,
                subject=subject,
                html_content=html_content
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            sg.send(message)
            print(f"[StockPulse] Email sent to {to_email}")
    except Exception as e:
        print(f"[StockPulse] Email error: {e}")

def build_low_stock_email(product):
    status = product["status"]
    color = "#ef4444" if status == "critical" else "#f97316"
    emoji = "🔴" if status == "critical" else "🟡"
    location_rows = "".join([
        f"<tr><td style='padding:6px 12px;color:#94a3b8;font-size:13px;'>{loc['location']}</td><td style='padding:6px 12px;text-align:right;font-weight:500;color:#e2e8f0;font-size:13px;'>{loc['quantity']} units</td></tr>"
        for loc in product["locations"]
    ])
    return f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#07111a;border-radius:12px;overflow:hidden;">
        <div style="background:{color}18;border-bottom:1px solid {color}40;padding:24px 28px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
                <span style="font-size:20px;">{emoji}</span>
                <span style="font-size:11px;font-weight:500;color:{color};letter-spacing:3px;text-transform:uppercase;">StockPulse Alert</span>
            </div>
            <h1 style="margin:0;font-size:22px;font-weight:500;color:#f1f5f9;">{product['title']} is {status.upper()}</h1>
        </div>
        <div style="padding:24px 28px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
                <div style="background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;">
                    <div style="font-size:10px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Total Stock</div>
                    <div style="font-size:28px;font-weight:500;color:{color};">{product['inventory']}</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;">
                    <div style="font-size:10px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Threshold</div>
                    <div style="font-size:28px;font-weight:500;color:#94a3b8;">{product['threshold']}</div>
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;margin-bottom:20px;">
                <div style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.08);">
                    <span style="font-size:9px;color:#64748b;letter-spacing:2px;text-transform:uppercase;">Inventory by Location</span>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                    {location_rows}
                </table>
            </div>
            <div style="background:{color}10;border:0.5px solid {color}30;border-radius:8px;padding:14px;">
                <p style="margin:0;font-size:13px;color:#e2e8f0;line-height:1.6;"><strong style="color:{color};">Action Required:</strong> {product['title']} has dropped to {product['inventory']} units. Please log into the StockPulse dashboard to trigger a reorder immediately.</p>
            </div>
        </div>
        <div style="padding:16px 28px;border-top:0.5px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;color:#334155;letter-spacing:1px;">STOCKPULSE · INVENTORY AUTOMATION · {product['sku']}</p>
        </div>
    </div>
    """

def build_reorder_email(product):
    location_rows = "".join([
        f"<tr><td style='padding:6px 12px;color:#94a3b8;font-size:13px;'>{loc['location']}</td><td style='padding:6px 12px;text-align:right;font-weight:500;color:#e2e8f0;font-size:13px;'>{loc['quantity']} units</td></tr>"
        for loc in product["locations"]
    ])
    return f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#07111a;border-radius:12px;overflow:hidden;">
        <div style="background:rgba(99,102,241,0.1);border-bottom:1px solid rgba(99,102,241,0.3);padding:24px 28px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
                <span style="font-size:20px;">📦</span>
                <span style="font-size:11px;font-weight:500;color:#818cf8;letter-spacing:3px;text-transform:uppercase;">StockPulse · Reorder</span>
            </div>
            <h1 style="margin:0;font-size:22px;font-weight:500;color:#f1f5f9;">Reorder Triggered — {product['title']}</h1>
        </div>
        <div style="padding:24px 28px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
                <div style="background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;">
                    <div style="font-size:10px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Current Stock</div>
                    <div style="font-size:28px;font-weight:500;color:#818cf8;">{product['inventory']}</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;">
                    <div style="font-size:10px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">SKU</div>
                    <div style="font-size:18px;font-weight:500;color:#94a3b8;">{product['sku']}</div>
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;margin-bottom:20px;">
                <div style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.08);">
                    <span style="font-size:9px;color:#64748b;letter-spacing:2px;text-transform:uppercase;">Inventory by Location</span>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                    {location_rows}
                </table>
            </div>
            <div style="background:rgba(99,102,241,0.08);border:0.5px solid rgba(99,102,241,0.25);border-radius:8px;padding:14px;">
                <p style="margin:0;font-size:13px;color:#e2e8f0;line-height:1.6;"><strong style="color:#818cf8;">Reorder confirmed</strong> for <strong style="color:#e2e8f0;">{product['title']}</strong>. Supplier notification has been sent. Expected restock in 3-5 business days.</p>
            </div>
        </div>
        <div style="padding:16px 28px;border-top:0.5px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;color:#334155;letter-spacing:1px;">STOCKPULSE · INVENTORY AUTOMATION · {product['sku']}</p>
        </div>
    </div>
    """

def send_low_stock_alert(product):
    if not SLACK_LOW_STOCK_WEBHOOK:
        return
    status = product["status"]
    emoji = "🔴" if status == "critical" else "🟡"
    color = "#ef4444" if status == "critical" else "#f97316"
    location_text = "\n".join([
        f"• {loc['location']}: *{loc['quantity']} units*"
        for loc in product["locations"]
    ])
    message = {
        "attachments": [{
            "color": color,
            "blocks": [
                {"type": "header", "text": {"type": "plain_text", "text": f"{emoji} Low Stock Alert -- {product['title']} dropped to {product['inventory']} units"}},
                {"type": "section", "fields": [
                    {"type": "mrkdwn", "text": f"*Product:*\n{product['title']}"},
                    {"type": "mrkdwn", "text": f"*SKU:*\n{product['sku']}"},
                    {"type": "mrkdwn", "text": f"*Total Stock:*\n{product['inventory']} units"},
                    {"type": "mrkdwn", "text": f"*Threshold:*\n{product['threshold']} units"}
                ]},
                {"type": "section", "text": {"type": "mrkdwn", "text": f"*Inventory by Location:*\n{location_text}"}},
                {"type": "section", "text": {"type": "mrkdwn", "text": f"*Action Required:* *{product['title']}* has dropped to *{product['inventory']} units*. Head to the StockPulse dashboard to trigger a reorder."}}
            ]
        }]
    }
    requests.post(SLACK_LOW_STOCK_WEBHOOK, json=message)
    # Send email
    send_email(
        subject=f"🔴 StockPulse Alert — {product['title']} is {product['status'].upper()}",
        html_content=build_low_stock_email(product)
    )

def send_reorder_alert(product):
    if not SLACK_REORDER_WEBHOOK:
        return
    location_text = "\n".join([
        f"• {loc['location']}: *{loc['quantity']} units*"
        for loc in product["locations"]
    ])
    message = {
        "attachments": [{
            "color": "#6366f1",
            "blocks": [
                {"type": "header", "text": {"type": "plain_text", "text": f"📦 Reorder Triggered -- {product['title']}"}},
                {"type": "section", "fields": [
                    {"type": "mrkdwn", "text": f"*Product:*\n{product['title']}"},
                    {"type": "mrkdwn", "text": f"*SKU:*\n{product['sku']}"},
                    {"type": "mrkdwn", "text": f"*Current Stock:*\n{product['inventory']} units"},
                    {"type": "mrkdwn", "text": f"*Threshold:*\n{product['threshold']} units"}
                ]},
                {"type": "section", "text": {"type": "mrkdwn", "text": f"*Inventory by Location:*\n{location_text}"}},
                {"type": "section", "text": {"type": "mrkdwn", "text": f"*Reorder has been triggered* for *{product['title']}*. Supplier notification sent. Expected restock in 3-5 business days."}}
            ]
        }]
    }
    requests.post(SLACK_REORDER_WEBHOOK, json=message)
    # Send email
    send_email(
        subject=f"📦 StockPulse — Reorder Triggered for {product['title']}",
        html_content=build_reorder_email(product)
    )

def fetch_inventory():
    try:
        products_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/products.json"
        products_res = requests.get(products_url, headers=HEADERS)
        products_data = products_res.json()

        locations_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/locations.json"
        locations_res = requests.get(locations_url, headers=HEADERS)
        locations = {loc["id"]: loc["name"] for loc in locations_res.json()["locations"]}

        for product in products_data["products"]:
            for variant in product["variants"]:
                sku = variant["sku"]
                threshold = THRESHOLDS.get(sku, 10)

                inventory_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/inventory_levels.json?inventory_item_ids={variant['inventory_item_id']}"
                inv_res = requests.get(inventory_url, headers=HEADERS)
                inv_data = inv_res.json()

                location_breakdown = []
                total_inventory = 0
                for level in inv_data.get("inventory_levels", []):
                    qty = level["available"] or 0
                    total_inventory += qty
                    location_breakdown.append({
                        "location": locations.get(level["location_id"], "Unknown"),
                        "quantity": qty
                    })

                product_data = {
                    "id": product["id"],
                    "title": product["title"],
                    "sku": sku,
                    "inventory": total_inventory,
                    "threshold": threshold,
                    "status": get_status(total_inventory, threshold),
                    "locations": location_breakdown
                }

                prev_qty = last_known_qty.get(sku)
                if total_inventory < LOW_STOCK_TRIGGER:
                    if prev_qty is not None and total_inventory < prev_qty:
                        print(f"[StockPulse] Alert: {product['title']} dropped to {total_inventory} units")
                        send_low_stock_alert(product_data)

                last_known_qty[sku] = total_inventory

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
    products_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/products.json"
    products_res = requests.get(products_url, headers=HEADERS)
    products_data = products_res.json()

    locations_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/locations.json"
    locations_res = requests.get(locations_url, headers=HEADERS)
    locations_data = locations_res.json()
    locations = {loc["id"]: loc["name"] for loc in locations_data["locations"]}

    results = []
    for product in products_data["products"]:
        for variant in product["variants"]:
            sku = variant["sku"]
            threshold = THRESHOLDS.get(sku, 10)

            inventory_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/inventory_levels.json?inventory_item_ids={variant['inventory_item_id']}"
            inv_res = requests.get(inventory_url, headers=HEADERS)
            inv_data = inv_res.json()

            location_breakdown = []
            total_inventory = 0
            for level in inv_data.get("inventory_levels", []):
                qty = level["available"] or 0
                total_inventory += qty
                location_breakdown.append({
                    "location": locations.get(level["location_id"], "Unknown"),
                    "quantity": qty
                })

            results.append({
                "id": product["id"],
                "title": product["title"],
                "sku": sku,
                "inventory": total_inventory,
                "threshold": threshold,
                "status": get_status(total_inventory, threshold),
                "locations": location_breakdown
            })

    return jsonify({"store": "Harlow & Co.", "products": results})

@app.route("/api/reorder/<int:product_id>", methods=["POST"])
def trigger_reorder(product_id):
    products_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/products/{product_id}.json"
    product_res = requests.get(products_url, headers=HEADERS)
    product_data = product_res.json()["product"]

    variant = product_data["variants"][0]
    sku = variant["sku"]
    threshold = THRESHOLDS.get(sku, 10)

    locations_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/locations.json"
    locations_res = requests.get(locations_url, headers=HEADERS)
    locations = {loc["id"]: loc["name"] for loc in locations_res.json()["locations"]}

    inventory_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/inventory_levels.json?inventory_item_ids={variant['inventory_item_id']}"
    inv_res = requests.get(inventory_url, headers=HEADERS)
    inv_data = inv_res.json()

    location_breakdown = []
    total_inventory = 0
    for level in inv_data.get("inventory_levels", []):
        qty = level["available"] or 0
        total_inventory += qty
        location_breakdown.append({
            "location": locations.get(level["location_id"], "Unknown"),
            "quantity": qty
        })

    product_payload = {
        "id": product_data["id"],
        "title": product_data["title"],
        "sku": sku,
        "inventory": total_inventory,
        "threshold": threshold,
        "status": get_status(total_inventory, threshold),
        "locations": location_breakdown
    }

    send_reorder_alert(product_payload)

    return jsonify({
        "success": True,
        "message": f"Reorder triggered for {product_data['title']}. Slack and email alerts sent.",
        "product": product_payload
    })

if __name__ == "__main__":
    poll_thread = threading.Thread(target=start_polling, daemon=True)
    poll_thread.start()
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)