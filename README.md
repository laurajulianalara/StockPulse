# StockPulse — AI-Powered Inventory Automation Platform

> Built as a technical proof-of-concept to demonstrate full-stack engineering, API integration, and AI-augmented decision-making for enterprise e-commerce operations.

**Live Demo:** [stockpulse-client.onrender.com](https://stockpulse-client.onrender.com)  
**GitHub:** [github.com/laurajulianalara/StockPulse](https://github.com/laurajulianalara/StockPulse)

---

## The Problem

Mid-market e-commerce brands managing thousands of SKUs across multiple warehouse locations face a painful reality: inventory management is still largely manual. Teams rely on spreadsheets, react to stockouts after they happen, and spend hours every week manually emailing suppliers purchase orders.

For the fictional client **Harlow & Co.** — a premium home décor brand doing $18M ARR with 4,200+ SKUs across 3 warehouses — this meant:

- **Lost revenue** from preventable stockouts
- **624+ hours/year** spent on manual reorder workflows  
- **No visibility** into which products were trending toward zero before they hit critical levels
- **Supplier POs** drafted manually, one email at a time

StockPulse was built to solve all of it.

---

## What StockPulse Does

StockPulse is a real-time inventory intelligence platform that connects directly to Shopify, monitors every product across all warehouse locations, predicts stockouts before they happen, and automates the entire reorder workflow — from alert to purchase order — in under 90 seconds.

### Core Capabilities

**Real-Time Inventory Monitoring**  
Live connection to Shopify Admin API with per-location inventory visibility across Miami, Atlanta, and Dallas warehouses. Products are automatically classified as Critical, Low, or Healthy with visual status indicators that update in real time.

**Predictive At-Risk Detection**  
StockPulse doesn't wait for products to turn red. Using simulated sales velocity data, the platform identifies OK-status products that are projected to hit their reorder threshold within days — surfacing them in a dedicated At Risk panel before any human would notice.

**AI Inventory Forecasting**  
Each critical and low-stock product card displays an AI-generated forecast powered by the Claude API. The forecast analyzes current inventory levels, sales velocity, and warehouse distribution to produce a plain-English prediction including estimated days until stockout and a specific recommended reorder quantity.

Example AI forecast:
> *"At current sales velocity of 2.3 units/day, Linen Throw Pillow will reach zero stock in approximately 4 days across all warehouses. An immediate reorder of 104 units is recommended to restore 45 days of supply."*

**AI Alternative Actions**  
Inside every reorder modal, a 🧠 AI Alternative Actions panel surfaces 3 merchant-context recommendations beyond just reordering — such as raising prices to slow demand, pausing promotions, or limiting availability — each ranked by urgency. This reflects how real operators actually think about low-inventory scenarios.

**AI-Optimized Reorder Quantities**  
When triggering a reorder, admins can toggle AI-recommended quantities that distribute units across warehouses based on current stock levels, sales velocity, and supplier lead times — replacing manual guesswork with data-driven precision.

**Automated Multi-Channel Alerts**  
When inventory drops below trigger thresholds, StockPulse fires simultaneously to:
- Slack (#stockpulse-low-stock) with AI forecast included
- Email via SendGrid with branded HTML template and location breakdown

**Admin Reorder Workflow**  
Behind password-protected admin access, operations teams can configure per-product settings (threshold, reorder quantity, supplier details, lead time), manage auto-reorder toggles, and trigger manual purchase orders with a single click — firing Slack alerts, email notifications, and logging every action to the reorder history.

**Reorder History & Audit Log**  
Every triggered reorder is saved with full context: product, SKU, inventory at time of reorder, quantity ordered per warehouse, supplier details, and timestamp. Filterable by month, status, and search — giving operations teams a complete audit trail.

**Inventory Health Score**  
A real-time health gauge in the dashboard header shows the percentage of products in healthy status, giving leadership an instant read on overall inventory posture.

---

## Technical Architecture

┌─────────────────────────────────────────────────────┐

│                   React + Vite Frontend              │

│              stockpulse-client.onrender.com          │

└─────────────────────┬───────────────────────────────┘

│ REST API

┌─────────────────────▼───────────────────────────────┐

│                  Flask Backend                       │

│              stockpulse-api.onrender.com             │

│                                                      │

│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │

│  │ Shopify API  │  │ Anthropic    │  │ SendGrid  │ │

│  │ (inventory)  │  │ Claude API   │  │  (email)  │ │

│  └──────────────┘  │ (forecasts + │  └───────────┘ │

│                    │  actions)    │                  │

│  ┌──────────────┐  └──────────────┘  ┌───────────┐ │

│  │   Slack      │                    │ JSON file │ │

│  │  Webhooks    │                    │ (settings │ │

│  │  (alerts)    │                    │ /history) │ │

│  └──────────────┘                    └───────────┘ │

└─────────────────────────────────────────────────────┘

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, inline CSS-in-JS |
| Backend | Python, Flask, Flask-CORS |
| AI | Anthropic Claude API (`claude-sonnet-4-5`) |
| E-commerce | Shopify Admin REST API |
| Alerts | Slack Incoming Webhooks, SendGrid |
| Deployment | Render (frontend + backend, free tier) |
| Version Control | GitHub |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | All products with variant support and per-location stock |
| GET | `/api/forecast/:id` | AI-generated stockout forecast for a product |
| GET | `/api/forecast-qty/:id` | AI-optimized reorder quantities per warehouse |
| GET | `/api/actions/:id` | AI alternative merchant actions |
| GET | `/api/settings` | Load reorder rules and supplier config |
| POST | `/api/settings` | Save admin-configured reorder rules |
| POST | `/api/reorder/:id` | Trigger reorder — fires Slack, email, logs history |
| POST | `/api/po/:id` | Send purchase order to supplier |
| GET | `/api/history` | Reorder audit log |

---

## Key Engineering Decisions

**Variant-aware inventory** — The Shopify API returns products with multiple variants (e.g. color options). StockPulse handles this correctly by tracking each variant independently with display titles like "Throw Pillow — Ivory" rather than collapsing variants into a single product entry.

**Dynamic settings inheritance** — When new products are added to Shopify, they automatically receive settings that inherit the current global configuration (auto-reorder toggle, global qty) without any manual setup required.

**Seeded AI consistency** — Simulated sales data uses a hash of the product SKU as a random seed, ensuring each product gets a unique but consistent daily sales velocity across sessions. The same product always shows the same forecast — critical for demo reliability.

**Polling architecture** — A background thread polls Shopify inventory every 15 seconds and fires alerts when stock drops below the trigger threshold, simulating production webhook behavior without requiring Shopify webhook configuration.

---

## Demo Walkthrough

### Inventory Tab
1. **Summary cards** — See live counts of Critical, Low, and Healthy products
2. **⚠️ At Risk banner** — Products currently OK but trending toward stockout, with estimated days remaining
3. **Filter tabs** — Toggle between All, Critical, Low, and OK views
4. **Product cards** — Per-location inventory bars, status badges, and ⚡ AI Forecast panels on any product that needs attention

### Reorder Rules Tab *(password: 0000)*
1. **Auto-Reorder toggle** — Enables automatic PO generation when products turn yellow
2. **Global Reorder Qty** — Sets a universal reorder quantity across all products instantly
3. **Per-product settings** — Configure thresholds, quantities, supplier name, email, lead time
4. **⚡ Reorder button** — Opens the reorder modal for critical and low products only

### Reorder Modal
1. **Product summary** — Current stock, threshold, and total to order
2. **🧠 AI Alternative Actions** — Expand to see 3 merchant-context recommendations with urgency ratings
3. **⚡ AI Qty toggle** — Let AI calculate optimal warehouse distribution
4. **Per-warehouse inputs** — Manually adjust quantities per location
5. **Supplier info** — Pre-filled from admin settings
6. **PO message** — Editable purchase order text
7. **Confirm & Send** — Fires Slack alert, email, and logs to history

### History Tab
- Full reorder audit log with search, month filter, status filter, and sort
- Running total of units ordered across filtered results

---

## Business Impact (Projected for Harlow & Co.)

| Metric | Before StockPulse | After StockPulse |
|--------|-------------------|------------------|
| Time to reorder | 45+ minutes manual | < 90 seconds automated |
| Stockout detection | After the fact | 7+ days in advance |
| Annual ops time saved | — | 624 hours |
| Recovered revenue | — | ~$340K |
| Supplier PO process | Manual email drafting | One-click generation |

---

## About the Developer

Built by **Laura Juliana Lara**, a Solutions Engineer with 8 years of technical pre-sales experience spanning SaaS, AI-native platforms, and enterprise e-commerce. StockPulse was designed to demonstrate the full range of SE skills in a single POC: technical implementation, product thinking, business storytelling, and AI integration.

- **LinkedIn:** [linkedin.com/in/laurajulianalara](https://linkedin.com/in/laurajulianalara)
- **Target roles:** Senior Solutions Engineer, Pre-Sales Engineer, Sales Engineer
- **Specialties:** API integrations, POC development, enterprise automation, AI-powered workflows

---

*StockPulse is a proof-of-concept built for portfolio purposes using a Shopify development store. Harlow & Co. is a fictional client created to provide realistic business context for the demo.*