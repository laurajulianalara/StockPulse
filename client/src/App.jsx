import { useState, useEffect } from "react"

const API_BASE = import.meta.env.VITE_API_URL || ""
const ADMIN_PASSWORD = "stockpulse2026"

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

function App() {
  const [tab, setTab] = useState("inventory")
  const [inventory, setInventory] = useState([])
  const [store, setStore] = useState("")
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [authenticated, setAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [passwordError, setPasswordError] = useState(false)
  const [settings, setSettings] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [sendingPO, setSendingPO] = useState(null)
  const [poSuccess, setPoSuccess] = useState(null)
  const [reordering, setReordering] = useState(null)
  const [reorderSuccess, setReorderSuccess] = useState(null)

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
          auto_send: isLowOrCritical ? newValue : prev.products[sku].auto_send
        }
      })
      return { ...prev, auto_reorder_enabled: newValue, products: updatedProducts }
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

  const handleSendPO = async (product) => {
    setSendingPO(product.id)
    try {
      const res = await fetch(`${API_BASE}/api/po/${product.id}`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setPoSuccess(product.id)
        setTimeout(() => setPoSuccess(null), 4000)
      }
    } catch (err) {
      console.error("PO failed", err)
    }
    setSendingPO(null)
  }

  const handleReorder = async (product) => {
    setReordering(product.id)
    try {
      const res = await fetch(`${API_BASE}/api/reorder/${product.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
      const data = await res.json()
      if (data.success) {
        setReorderSuccess(product.id)
        setTimeout(() => setReorderSuccess(null), 4000)
      }
    } catch (err) {
      console.error("Reorder failed", err)
    }
    setReordering(null)
  }

  const statusColor = (status) => {
    if (status === "critical") return "#ef4444"
    if (status === "low") return "#f97316"
    return "#22c55e"
  }

  const updateProductSetting = (sku, field, value) => {
    setSettings(prev => ({
      ...prev,
      products: {
        ...prev.products,
        [sku]: { ...prev.products[sku], [field]: value }
      }
    }))
  }

  const filtered = filter === "all" ? inventory : inventory.filter(p => p.status === filter)
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

            {/* Product grid — visibility only */}
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
                <div style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "40px 48px", textAlign: "center", maxWidth: 360 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, border: "0.5px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Admin Access Required</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 24 }}>Enter your admin password to access Reorder Rules</div>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handlePassword()}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `0.5px solid ${passwordError ? "#ef4444" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "10px 14px", color: "rgba(255,255,255,0.8)", fontSize: 13, outline: "none", marginBottom: passwordError ? 8 : 16, textAlign: "center", letterSpacing: 4 }}
                  />
                  {passwordError && <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 12 }}>Incorrect password</div>}
                  <button onClick={handlePassword} style={{ width: "100%", background: "rgba(100,180,200,0.1)", border: "0.5px solid rgba(100,180,200,0.25)", borderRadius: 8, padding: "10px", color: "rgba(100,180,200,0.85)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                    Unlock
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Reorder Rules</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Configure reorder quantities, thresholds, supplier details and trigger reorders</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 100, padding: "5px 12px" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase" }}>Admin Access</span>
                  </div>
                </div>

                {settings && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(249,115,22,0.06)", border: "0.5px solid rgba(249,115,22,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(249,115,22,0.12)", border: "0.5px solid rgba(249,115,22,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                      </div>
                      <div>
                        <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: 500, marginBottom: 2 }}>Auto-Reorder on Low Stock</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>When enabled, POs fire automatically when any product turns yellow — no manual trigger needed</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div onClick={handleGlobalToggle}
                        style={{ width: 42, height: 24, borderRadius: 100, background: settings.auto_reorder_enabled ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.08)", border: `0.5px solid ${settings.auto_reorder_enabled ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.12)"}`, cursor: "pointer", position: "relative", transition: "all 0.3s" }}>
                        <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: settings.auto_reorder_enabled ? "#f97316" : "rgba(255,255,255,0.4)", top: 3, left: settings.auto_reorder_enabled ? 22 : 4, transition: "all 0.3s" }}></div>
                      </div>
                      <span style={{ fontSize: 9, color: settings.auto_reorder_enabled ? "#f97316" : "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                        {settings.auto_reorder_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                )}

                {settings && (
                  <div style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {["Product", "Status", "Threshold", "Reorder Qty", "Supplier Name", "Supplier Email", "Lead Time", "Auto-Send", "Trigger Reorder", "Send PO"].map(h => (
                              <th key={h} style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 2, textTransform: "uppercase", padding: "14px 12px", textAlign: "left", fontWeight: 400, borderBottom: "0.5px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {inventory.map((product, i) => {
                            const ps = settings.products[product.sku] || {}
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
                                <td style={{ padding: "12px" }}>
                                  <div onClick={() => updateProductSetting(product.sku, "auto_send", !ps.auto_send)}
                                    style={{ width: 36, height: 20, borderRadius: 100, background: ps.auto_send ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.07)", border: `0.5px solid ${ps.auto_send ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.1)"}`, cursor: "pointer", position: "relative", transition: "all 0.3s" }}>
                                    <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: ps.auto_send ? "#f97316" : "rgba(255,255,255,0.35)", top: 2.5, left: ps.auto_send ? 18 : 3, transition: "all 0.3s" }}></div>
                                  </div>
                                </td>
                                <td style={{ padding: "12px" }}>
                                  {product.status !== "ok" && (
                                    <button onClick={() => handleReorder(product)} disabled={reordering === product.id} style={{ background: reorderSuccess === product.id ? "rgba(34,197,94,0.12)" : statusColor(product.status) + "12", border: `0.5px solid ${reorderSuccess === product.id ? "rgba(34,197,94,0.3)" : statusColor(product.status) + "30"}`, borderRadius: 7, padding: "5px 10px", color: reorderSuccess === product.id ? "#22c55e" : statusColor(product.status), fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
                                      {reordering === product.id ? "Sending..." : reorderSuccess === product.id ? "✓ Sent!" : "Trigger"}
                                    </button>
                                  )}
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <button onClick={() => handleSendPO(product)} disabled={sendingPO === product.id} style={{ background: poSuccess === product.id ? "rgba(34,197,94,0.12)" : "rgba(99,102,241,0.12)", border: `0.5px solid ${poSuccess === product.id ? "rgba(34,197,94,0.3)" : "rgba(99,102,241,0.25)"}`, borderRadius: 7, padding: "5px 10px", color: poSuccess === product.id ? "#22c55e" : "#818cf8", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
                                    {sendingPO === product.id ? "Sending..." : poSuccess === product.id ? "✓ Sent!" : "Send PO"}
                                  </button>
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