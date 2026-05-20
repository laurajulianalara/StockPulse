import { useState, useEffect } from "react"

const API_BASE = import.meta.env.VITE_API_URL || ""
const ADMIN_PASSWORD = "0000"

const gradientBg = `
  radial-gradient(ellipse at 20% 20%, rgba(100,180,200,0.25) 0%, transparent 50%),
  radial-gradient(ellipse at 80% 80%, rgba(60,140,160,0.2) 0%, transparent 50%),
  radial-gradient(ellipse at 60% 10%, rgba(120,190,210,0.15) 0%, transparent 40%),
  #07111a
`

const grainStyle1 = {
  position: "fixed", inset: 0,
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
  backgroundSize: "180px", opacity: 0.9, mixBlendMode: "overlay", pointerEvents: "none", zIndex: 0
}

const grainStyle2 = {
  position: "fixed", inset: 0,
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='6' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n2)'/%3E%3C/svg%3E")`,
  backgroundSize: "120px", opacity: 0.55, mixBlendMode: "soft-light", pointerEvents: "none", zIndex: 0
}

function ReorderModal({ product, settings, onClose, onConfirm, sending, success }) {
  const ps = settings?.products?.[product.sku] || {}
  const [qtyPerWarehouse, setQtyPerWarehouse] = useState(
    product.locations.reduce((acc, loc) => {
      acc[loc.location] = ps.reorder_qty ? Math.round(ps.reorder_qty / product.locations.length) : 10
      return acc
    }, {})
  )
  const [poMessage, setPoMessage] = useState(
    `Dear ${ps.supplier_name || "Supplier"},\n\nWe would like to place a reorder for the following product due to low inventory levels.\n\nPlease confirm receipt and expected ship date.\n\nThank you,\nHarlow & Co. Operations Team`
  )
  const totalQty = Object.values(qtyPerWarehouse).reduce((a, b) => a + (parseInt(b) || 0), 0)
  const color = product.status === "critical" ? "#ef4444" : "#f97316"

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#0d1e2a", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 18, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "22px 28px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 16, fontWeight: 500 }}>Trigger Reorder</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>Review details before sending</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, width: 32, height: 32, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "rgba(255,255,255,0.04)", border: `0.5px solid ${color}30`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{product.title}</div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 2 }}>{product.sku}</div>
              </div>
              <span style={{ background: color + "18", color, border: `0.5px solid ${color}40`, borderRadius: 100, padding: "3px 10px", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>{product.status}</span>
            </div>
            <div style={{ display: "flex", gap: 24, marginTop: 12, paddingTop: 12, borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
              <div><div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Current Stock</div><div style={{ color, fontSize: 22, fontWeight: 500 }}>{product.inventory}</div></div>
              <div><div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Threshold</div><div style={{ color: "rgba(255,255,255,0.4)", fontSize: 22 }}>{product.threshold}</div></div>
              <div><div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Total to Order</div><div style={{ color: "rgba(100,200,220,0.9)", fontSize: 22, fontWeight: 500 }}>{totalQty}</div></div>
            </div>
          </div>
          <div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Quantity to Order Per Warehouse</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {product.locations.map((loc, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "10px 14px" }}>
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{loc.location}</div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 1 }}>Current: {loc.quantity} units</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>Order qty:</div>
                    <input type="number" min="0" value={qtyPerWarehouse[loc.location] || ""} onChange={e => setQtyPerWarehouse(prev => ({ ...prev, [loc.location]: parseInt(e.target.value) || 0 }))} style={{ width: 64, background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.15)", borderRadius: 7, padding: "6px 10px", color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500, outline: "none", textAlign: "center" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Supplier Information</div>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ padding: "12px 16px", borderRight: "0.5px solid rgba(255,255,255,0.06)", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Supplier Name</div>
                  <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{ps.supplier_name || "—"}</div>
                </div>
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Supplier Email</div>
                  <div style={{ color: "rgba(100,200,220,0.8)", fontSize: 12 }}>{ps.supplier_email || "—"}</div>
                </div>
                <div style={{ padding: "12px 16px", borderRight: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Lead Time</div>
                  <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{ps.lead_time || "—"}</div>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Total Units</div>
                  <div style={{ color: "rgba(100,200,220,0.9)", fontSize: 12, fontWeight: 500 }}>{totalQty} units</div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Message to Include in PO</div>
            <textarea value={poMessage} onChange={e => setPoMessage(e.target.value)} rows={5} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", color: "rgba(255,255,255,0.7)", fontSize: 12, outline: "none", resize: "vertical", lineHeight: 1.6, fontFamily: "sans-serif" }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px", color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Cancel</button>
            <button onClick={() => onConfirm(product, qtyPerWarehouse, poMessage, totalQty)} disabled={sending} style={{ flex: 2, background: success ? "rgba(34,197,94,0.2)" : color + "20", border: `1px solid ${success ? "rgba(34,197,94,0.5)" : color + "50"}`, borderRadius: 10, padding: "12px", color: success ? "#22c55e" : color, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: sending ? "not-allowed" : "pointer", transition: "all 0.3s" }}>
              {sending ? "⏳ Sending Reorder..." : success ? "✅ Reorder Sent!" : "⚡ Confirm & Send Reorder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [tab, setTab] = useState("inventory")
  const [inventory, setInventory] = useState([])
  const [store, setStore] = useState("")
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [adminFilter, setAdminFilter] = useState("all")
  const [authenticated, setAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [passwordError, setPasswordError] = useState(false)
  const [settings, setSettings] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [modalProduct, setModalProduct] = useState(null)
  const [modalSending, setModalSending] = useState(false)
  const [modalSuccess, setModalSuccess] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/inventory`)
      .then(res => res.json())
      .then(data => {
        setInventory(data.products)
        setStore(data.store)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (authenticated && !settings) {
      fetch(`${API_BASE}/api/settings`)
        .then(res => res.json())
        .then(data => setSettings(data))
    }
  }, [authenticated])

  const handlePassword = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthenticated(true)
      setPasswordError(false)
    } else {
      setPasswordError(true)
    }
  }

  const handleGlobalToggle = () => {
    setSettings(prev => {
      const newValue = !prev.auto_reorder_enabled
      const updatedProducts = {}
      Object.keys(prev.products).forEach(sku => {
        const product = inventory.find(p => p.sku === sku)
        const isLowOrCritical = product && (product.status === "low" || product.status === "critical")
        updatedProducts[sku] = {
          ...prev.products[sku],
          auto_send: isLowOrCritical ? newValue : false
        }
      })
      return { ...prev, auto_reorder_enabled: newValue, products: updatedProducts }
    })
  }

  const handleGlobalQtyChange = (qty) => {
    const parsed = parseInt(qty) || 0
    setSettings(prev => {
      const updatedProducts = {}
      Object.keys(prev.products).forEach(sku => {
        updatedProducts[sku] = { ...prev.products[sku], reorder_qty: parsed }
      })
      return { ...prev, global_reorder_qty: parsed, products: updatedProducts }
    })
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    await fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    })
    setSavingSettings(false)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 3000)
  }

  const handleModalConfirm = async (product, qtyPerWarehouse, poMessage, totalQty) => {
    setModalSending(true)
    try {
      const res = await fetch(`${API_BASE}/api/reorder/${product.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty_per_warehouse: qtyPerWarehouse, po_message: poMessage, total_qty: totalQty })
      })
      const data = await res.json()
      if (data.success) {
        setModalSuccess(true)
        setTimeout(() => { setModalSuccess(false); setModalProduct(null) }, 2500)
      }
    } catch (err) {
      console.error("Reorder failed", err)
    }
    setModalSending(false)
  }

  const statusColor = (status) => {
    if (status === "critical") return "#ef4444"
    if (status === "low") return "#f97316"
    return "#22c55e"
  }

  const updateProductSetting = (sku, field, value) => {
    setSettings(prev => ({
      ...prev,
      products: { ...prev.products, [sku]: { ...prev.products[sku], [field]: value } }
    }))
  }

  const filtered = filter === "all" ? inventory : inventory.filter(p => p.status === filter)
  const adminFiltered = adminFilter === "all" ? inventory : inventory.filter(p => p.status === adminFilter)
  const critical = inventory.filter(p => p.status === "critical").length
  const low = inventory.filter(p => p.status === "low").length
  const ok = inventory.filter(p => p.status === "ok").length

  if (loading) return (
    <div style={{ minHeight: "100vh", background: gradientBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "4px", fontSize: 12, textTransform: "uppercase" }}>Loading inventory...</div>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", background: gradientBg, fontFamily: "sans-serif", position: "relative" }}>
      <div style={grainStyle1}></div>
      <div style={grainStyle2}></div>

      {modalProduct && (
        <ReorderModal
          product={modalProduct}
          settings={settings}
          onClose={() => { setModalProduct(null); setModalSuccess(false) }}
          onConfirm={handleModalConfirm}
          sending={modalSending}
          success={modalSuccess}
        />
      )}

      {/* Header */}
      <div style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)", padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, border: "0.5px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 64 64"><polyline points="8,32 16,32 20,18 25,46 30,24 35,38 39,28 44,32 56,32" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.12)" }}></div>
          <span style={{ color: "rgba(255,255,255,0.88)", fontSize: 16, fontWeight: 100, letterSpacing: 6, textTransform: "uppercase" }}>StockPulse</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 14, fontWeight: 500 }}>{store}</div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2, letterSpacing: 1 }}>Live Inventory · 3 Warehouses</div>
        </div>
      </div>

      <div style={{ padding: "28px 40px", position: "relative", zIndex: 2 }}>

        {/* Nav tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {["inventory", "reorder rules"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? "rgba(255,255,255,0.1)" : "transparent", border: `0.5px solid ${tab === t ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: 100, padding: "6px 18px", color: tab === t ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── INVENTORY TAB ── */}
        {tab === "inventory" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
              {[
                { label: "Critical", count: critical, color: "#ef4444", desc: "Immediate reorder needed" },
                { label: "Low Stock", count: low, color: "#f97316", desc: "Below threshold" },
                { label: "In Stock", count: ok, color: "#22c55e", desc: "Healthy inventory" }
              ].map(s => (
                <div key={s.label} style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", border: `0.5px solid ${s.color}30`, borderRadius: 14, padding: "20px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div>
                      <div style={{ color: s.color, fontSize: 36, fontWeight: 500, lineHeight: 1 }}>{s.count}</div>
                      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 6 }}>{s.desc}</div>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, marginTop: 4 }}></div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {["all", "critical", "low", "ok"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? "rgba(255,255,255,0.1)" : "transparent", border: `0.5px solid ${filter === f ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: 100, padding: "6px 16px", color: filter === f ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                  {f}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
              {filtered.map(product => (
                <div key={product.id} style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", border: `0.5px solid ${product.status === "ok" ? "rgba(255,255,255,0.1)" : statusColor(product.status) + "30"}`, borderRadius: 14, padding: 22, minHeight: 320 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 18 }}>
                    <div>
                      <div style={{ color: "rgba(255,255,255,0.88)", fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{product.title}</div>
                      <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, letterSpacing: 2 }}>{product.sku}</div>
                    </div>
                    <span style={{ background: statusColor(product.status) + "18", color: statusColor(product.status), border: `0.5px solid ${statusColor(product.status)}40`, borderRadius: 100, padding: "3px 10px", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      {product.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 18 }}>
                    <div>
                      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Total Stock</div>
                      <div style={{ color: statusColor(product.status), fontSize: 32, fontWeight: 500, lineHeight: 1 }}>{product.inventory}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Threshold</div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 20 }}>{product.threshold}</div>
                    </div>
                  </div>
                  <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
                    <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>By Location</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {product.locations.map((loc, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{loc.location}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 60, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                              <div style={{ width: `${Math.min((loc.quantity / product.threshold) * 100, 100)}%`, height: "100%", background: statusColor(product.status), borderRadius: 2 }}></div>
                            </div>
                            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 500, minWidth: 16, textAlign: "right" }}>{loc.quantity}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── REORDER RULES TAB ── */}
        {tab === "reorder rules" && (
          <>
            {!authenticated ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
                <div style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "40px 48px", textAlign: "center", maxWidth: 380 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, border: "0.5px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Admin Access Required</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 20 }}>Enter your admin password to access Reorder Rules</div>
                  <div style={{ background: "rgba(100,180,200,0.1)", border: "0.5px solid rgba(100,180,200,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                    <div style={{ fontSize: 9, color: "rgba(100,180,200,0.55)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>Demo Access Password</div>
                    <div style={{ fontSize: 22, color: "rgba(100,180,200,0.95)", fontWeight: 600, letterSpacing: 10 }}>0000</div>
                  </div>
                  <input type="password" placeholder="Enter password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handlePassword()} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `0.5px solid ${passwordError ? "#ef4444" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "10px 14px", color: "rgba(255,255,255,0.8)", fontSize: 13, outline: "none", marginBottom: passwordError ? 8 : 16, textAlign: "center", letterSpacing: 4 }} />
                  {passwordError && <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 12 }}>Incorrect password</div>}
                  <button onClick={handlePassword} style={{ width: "100%", background: "rgba(100,180,200,0.1)", border: "0.5px solid rgba(100,180,200,0.25)", borderRadius: 8, padding: "10px", color: "rgba(100,180,200,0.85)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Unlock</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Reorder Rules</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Configure reorder quantities, thresholds, and supplier details</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 100, padding: "5px 12px" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase" }}>Admin Access</span>
                  </div>
                </div>

                {/* Auto reorder toggle */}
                {settings && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(249,115,22,0.06)", border: "0.5px solid rgba(249,115,22,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(249,115,22,0.12)", border: "0.5px solid rgba(249,115,22,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                      </div>
                      <div>
                        <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: 500, marginBottom: 2 }}>Auto-Reorder on Low Stock</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>Automatically enables reorder for all critical and low stock products only</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div onClick={handleGlobalToggle} style={{ width: 42, height: 24, borderRadius: 100, background: settings.auto_reorder_enabled ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.08)", border: `0.5px solid ${settings.auto_reorder_enabled ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.12)"}`, cursor: "pointer", position: "relative", transition: "all 0.3s" }}>
                        <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: settings.auto_reorder_enabled ? "#f97316" : "rgba(255,255,255,0.4)", top: 3, left: settings.auto_reorder_enabled ? 22 : 4, transition: "all 0.3s" }}></div>
                      </div>
                      <span style={{ fontSize: 9, color: settings.auto_reorder_enabled ? "#f97316" : "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                        {settings.auto_reorder_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Global default reorder qty */}
                {settings && (
                  <div style={{ background: "rgba(99,102,241,0.06)", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "14px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(99,102,241,0.12)", border: "0.5px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
                      </div>
                      <div>
                        <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: 500, marginBottom: 2 }}>Global Default Reorder Quantity</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>Sets reorder qty universally for all products — updates all individual quantities below</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="number" min="1" value={settings.global_reorder_qty || ""} onChange={e => handleGlobalQtyChange(e.target.value)} placeholder="e.g. 50" style={{ width: 80, background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 8, padding: "7px 10px", color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500, outline: "none", textAlign: "center" }} />
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1, textTransform: "uppercase" }}>units</span>
                    </div>
                  </div>
                )}

                {/* Admin filter tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {["all", "critical", "low", "ok"].map(f => (
                    <button key={f} onClick={() => setAdminFilter(f)} style={{ background: adminFilter === f ? "rgba(255,255,255,0.1)" : "transparent", border: `0.5px solid ${adminFilter === f ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: 100, padding: "6px 16px", color: adminFilter === f ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                      {f}
                    </button>
                  ))}
                </div>

                {settings && (
                  <div style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {["Product", "Status", "Threshold", "Reorder Qty", "Supplier Name", "Supplier Email", "Lead Time", "Auto-Send", "Trigger Reorder"].map(h => (
                              <th key={h} style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 2, textTransform: "uppercase", padding: "14px 12px", textAlign: "left", fontWeight: 400, borderBottom: "0.5px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {adminFiltered.map((product, i) => {
                            const ps = settings.products[product.sku] || {}
                            const isActionable = product.status === "critical" || product.status === "low"
                            return (
                              <tr key={product.id} style={{ borderTop: i === 0 ? "none" : "0.5px solid rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "12px" }}>
                                  <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: 500, marginBottom: 2, whiteSpace: "nowrap" }}>{product.title}</div>
                                  <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 9, letterSpacing: 1.5 }}>{product.sku}</div>
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <span style={{ background: statusColor(product.status) + "18", color: statusColor(product.status), border: `0.5px solid ${statusColor(product.status)}40`, borderRadius: 100, padding: "2px 8px", fontSize: 8, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>{product.status}</span>
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <input value={ps.threshold || ""} onChange={e => updateProductSetting(product.sku, "threshold", parseInt(e.target.value))} style={{ width: 56, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 8px", color: "rgba(255,255,255,0.7)", fontSize: 11, outline: "none" }} />
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <input value={ps.reorder_qty || ""} onChange={e => updateProductSetting(product.sku, "reorder_qty", parseInt(e.target.value))} style={{ width: 60, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 8px", color: "rgba(255,255,255,0.7)", fontSize: 11, outline: "none" }} />
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <input value={ps.supplier_name || ""} onChange={e => updateProductSetting(product.sku, "supplier_name", e.target.value)} style={{ width: 120, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 8px", color: "rgba(255,255,255,0.7)", fontSize: 11, outline: "none" }} />
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <input value={ps.supplier_email || ""} onChange={e => updateProductSetting(product.sku, "supplier_email", e.target.value)} style={{ width: 150, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 8px", color: "rgba(255,255,255,0.7)", fontSize: 11, outline: "none" }} />
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <input value={ps.lead_time || ""} onChange={e => updateProductSetting(product.sku, "lead_time", e.target.value)} style={{ width: 70, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 8px", color: "rgba(255,255,255,0.7)", fontSize: 11, outline: "none" }} />
                                </td>

                                {/* Auto-Send toggle — only for critical and low */}
                                <td style={{ padding: "12px" }}>
                                  {isActionable ? (
                                    <div onClick={() => updateProductSetting(product.sku, "auto_send", !ps.auto_send)}
                                      style={{ width: 36, height: 20, borderRadius: 100, background: ps.auto_send ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.07)", border: `0.5px solid ${ps.auto_send ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.1)"}`, cursor: "pointer", position: "relative", transition: "all 0.3s" }}>
                                      <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: ps.auto_send ? "#f97316" : "rgba(255,255,255,0.35)", top: 2.5, left: ps.auto_send ? 18 : 3, transition: "all 0.3s" }}></div>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", letterSpacing: 1 }}>—</span>
                                  )}
                                </td>

                                {/* Trigger Reorder button — only for critical and low */}
                                <td style={{ padding: "12px" }}>
                                  {isActionable ? (
                                    <button onClick={() => setModalProduct(product)} style={{ background: statusColor(product.status) + "25", border: `1px solid ${statusColor(product.status)}60`, borderRadius: 7, padding: "7px 12px", color: statusColor(product.status), fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
                                      ⚡ Reorder
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", letterSpacing: 1 }}>—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: 1 }}>Changes are not saved until you click Save</div>
                      <button onClick={handleSaveSettings} disabled={savingSettings} style={{ background: settingsSaved ? "rgba(34,197,94,0.12)" : "rgba(100,180,200,0.1)", border: `0.5px solid ${settingsSaved ? "rgba(34,197,94,0.3)" : "rgba(100,180,200,0.25)"}`, borderRadius: 8, padding: "8px 20px", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: settingsSaved ? "#22c55e" : "rgba(100,180,200,0.85)", cursor: "pointer" }}>
                        {savingSettings ? "Saving..." : settingsSaved ? "✓ Saved!" : "Save All Changes"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App