import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv

load_dotenv('/workspaces/StockPulse/.env')

def send_email(subject, html_content):
    to_emails = os.getenv('SENDGRID_TO_EMAILS', '').split(',')
    for email in to_emails:
        email = email.strip()
        if not email:
            continue
        message = Mail(
            from_email=os.getenv('SENDGRID_FROM_EMAIL'),
            to_emails=email,
            subject=subject,
            html_content=html_content
        )
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        response = sg.send(message)
        print(f"Sent to {email} — Status: {response.status_code}")

# Test low stock email
send_email(
    subject="🔴 StockPulse Alert — Linen Throw Pillow is CRITICAL",
    html_content="""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#07111a;border-radius:12px;overflow:hidden;">
        <div style="background:rgba(239,68,68,0.1);border-bottom:1px solid rgba(239,68,68,0.3);padding:24px 28px;">
            <span style="font-size:11px;font-weight:500;color:#ef4444;letter-spacing:3px;text-transform:uppercase;">🔴 StockPulse — Low Stock Alert</span>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:500;color:#f1f5f9;">Linen Throw Pillow is CRITICAL</h1>
        </div>
        <div style="padding:24px 28px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
                <div style="background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;">
                    <div style="font-size:10px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Total Stock</div>
                    <div style="font-size:28px;font-weight:500;color:#ef4444;">4</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;">
                    <div style="font-size:10px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Threshold</div>
                    <div style="font-size:28px;font-weight:500;color:#94a3b8;">10</div>
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;margin-bottom:20px;">
                <div style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.08);">
                    <span style="font-size:9px;color:#64748b;letter-spacing:2px;text-transform:uppercase;">Inventory by Location</span>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                    <tr><td style="padding:6px 12px;color:#94a3b8;font-size:13px;">Miami Warehouse — HQ</td><td style="padding:6px 12px;text-align:right;font-weight:500;color:#e2e8f0;font-size:13px;">2 units</td></tr>
                    <tr><td style="padding:6px 12px;color:#94a3b8;font-size:13px;">Atlanta Fulfillment Center</td><td style="padding:6px 12px;text-align:right;font-weight:500;color:#e2e8f0;font-size:13px;">1 unit</td></tr>
                    <tr><td style="padding:6px 12px;color:#94a3b8;font-size:13px;">Dallas Distribution Hub</td><td style="padding:6px 12px;text-align:right;font-weight:500;color:#e2e8f0;font-size:13px;">1 unit</td></tr>
                </table>
            </div>
            <div style="background:rgba(239,68,68,0.08);border:0.5px solid rgba(239,68,68,0.25);border-radius:8px;padding:14px;">
                <p style="margin:0;font-size:13px;color:#e2e8f0;line-height:1.6;"><strong style="color:#ef4444;">Action Required:</strong> Linen Throw Pillow has dropped to 4 units. Please log into the StockPulse dashboard to trigger a reorder immediately.</p>
            </div>
        </div>
        <div style="padding:16px 28px;border-top:0.5px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;color:#334155;letter-spacing:1px;">STOCKPULSE · INVENTORY AUTOMATION · LTP-001</p>
        </div>
    </div>
    """
)

# Test reorder email
send_email(
    subject="📦 StockPulse — Reorder Triggered for Linen Throw Pillow",
    html_content="""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#07111a;border-radius:12px;overflow:hidden;">
        <div style="background:rgba(99,102,241,0.1);border-bottom:1px solid rgba(99,102,241,0.3);padding:24px 28px;">
            <span style="font-size:11px;font-weight:500;color:#818cf8;letter-spacing:3px;text-transform:uppercase;">📦 StockPulse — Reorder Confirmed</span>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:500;color:#f1f5f9;">Reorder Triggered — Linen Throw Pillow</h1>
        </div>
        <div style="padding:24px 28px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
                <div style="background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;">
                    <div style="font-size:10px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Current Stock</div>
                    <div style="font-size:28px;font-weight:500;color:#818cf8;">4</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;">
                    <div style="font-size:10px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">SKU</div>
                    <div style="font-size:18px;font-weight:500;color:#94a3b8;">LTP-001</div>
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;margin-bottom:20px;">
                <div style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.08);">
                    <span style="font-size:9px;color:#64748b;letter-spacing:2px;text-transform:uppercase;">Inventory by Location</span>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                    <tr><td style="padding:6px 12px;color:#94a3b8;font-size:13px;">Miami Warehouse — HQ</td><td style="padding:6px 12px;text-align:right;font-weight:500;color:#e2e8f0;font-size:13px;">2 units</td></tr>
                    <tr><td style="padding:6px 12px;color:#94a3b8;font-size:13px;">Atlanta Fulfillment Center</td><td style="padding:6px 12px;text-align:right;font-weight:500;color:#e2e8f0;font-size:13px;">1 unit</td></tr>
                    <tr><td style="padding:6px 12px;color:#94a3b8;font-size:13px;">Dallas Distribution Hub</td><td style="padding:6px 12px;text-align:right;font-weight:500;color:#e2e8f0;font-size:13px;">1 unit</td></tr>
                </table>
            </div>
            <div style="background:rgba(99,102,241,0.08);border:0.5px solid rgba(99,102,241,0.25);border-radius:8px;padding:14px;">
                <p style="margin:0;font-size:13px;color:#e2e8f0;line-height:1.6;"><strong style="color:#818cf8;">Reorder confirmed</strong> for <strong style="color:#e2e8f0;">Linen Throw Pillow</strong>. Supplier notification has been sent. Expected restock in 3-5 business days.</p>
            </div>
        </div>
        <div style="padding:16px 28px;border-top:0.5px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;color:#334155;letter-spacing:1px;">STOCKPULSE · INVENTORY AUTOMATION · LTP-001</p>
        </div>
    </div>
    """
)

print("Both emails sent! Check your inbox and spam folder.")
