from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
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

# Tracks last known quantity per SKU
last_known_qty = {}

def get_status(inventory, threshold):
    if inventory == 0:
        return "critical"
    elif inventory <= threshold * 0.5:
        return "critical"
    elif inventory <= threshold:
        return "low"
    return "ok"

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
        "attachments": [
            {
                "color": color,
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f"{emoji} Low Stock Alert -- {product['title']} dropped to {product['inventory']} units"
                        }
                    },
                    {
                        "type": "section",
                        "fields": [
                            { "type": "mrkdwn", "text": f"*Product:*\n{product['title']}" },
                            { "type": "mrkdwn", "text": f"*SKU:*\n{product['sku']}" },
                            { "type": "mrkdwn", "text": f"*Total Stock:*\n{product['inventory']} units" },
                            { "type": "mrkdwn", "text": f"*Threshold:*\n{product['threshold']} units" }
                        ]
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Inventory by Location:*\n{location_text}"
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Action Required:* *{product['title']}* has dropped to *{product['inventory']} units*. Head to the StockPulse dashboard to trigger a reorder."
                        }
                    }
                ]
            }
        ]
    }
    requests.post(SLACK_LOW_STOCK_WEBHOOK, json=message)

def send_reorder_alert(product):
    if not SLACK_REORDER_WEBHOOK:
        return
    color = "#6366f1"
    location_text = "\n".join([
        f"• {loc['location']}: *{loc['quantity']} units*"
        for loc in product["locations"]
    ])
    message = {
        "attachments": [
            {
                "color": color,
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f"📦 Reorder Triggered -- {product['title']}"
                        }
                    },
                    {
                        "type": "section",
                        "fields": [
                            { "type": "mrkdwn", "text": f"*Product:*\n{product['title']}" },
                            { "type": "mrkdwn", "text": f"*SKU:*\n{product['sku']}" },
                            { "type": "mrkdwn", "text": f"*Current Stock:*\n{product['inventory']} units" },
                            { "type": "mrkdwn", "text": f"*Threshold:*\n{product['threshold']} units" }
                        ]
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Inventory by Location:*\n{location_text}"
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Reorder has been triggered* for *{product['title']}*. Supplier notification sent. Expected restock in 3-5 business days."
                        }
                    }
                ]
            }
        ]
    }
    requests.post(SLACK_REORDER_WEBHOOK, json=message)

def fetch_inventory():
    try:
        products_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/products.json"
        products_res = requests.get(products_url, headers=HEADERS)
        products_data = products_res.json()

        locations_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/locations.json"
        locations_res = requests.get(locations_url, headers=HEADERS)
        locations = { loc["id"]: loc["name"] for loc in locations_res.json()["locations"] }

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

                # Only fire if qty is below 5 AND actually dropped since last check
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
    return jsonify({ "status": "ok", "message": "StockPulse API is running" })

@app.route("/api/inventory")
def get_inventory():
    products_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/products.json"
    products_res = requests.get(products_url, headers=HEADERS)
    products_data = products_res.json()

    locations_url = f"https://{SHOPIFY_STORE_URL}/admin/api/{API_VERSION}/locations.json"
    locations_res = requests.get(locations_url, headers=HEADERS)
    locations_data = locations_res.json()
    locations = { loc["id"]: loc["name"] for loc in locations_data["locations"] }

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

    return jsonify({
        "store": "Harlow & Co.",
        "products": results
    })

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
    locations = { loc["id"]: loc["name"] for loc in locations_res.json()["locations"] }

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
        "message": f"Reorder triggered for {product_data['title']}. Slack alert sent.",
        "product": product_payload
    })

if __name__ == "__main__":
    poll_thread = threading.Thread(target=start_polling, daemon=True)
    poll_thread.start()
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)