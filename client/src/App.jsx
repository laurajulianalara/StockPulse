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

function getSimulatedDailySales(sku) {
  let hash = 0
  for (let i = 0; i < sku.length; i++) hash = ((hash << 5) - hash) + sku.charCodeAt(i)
  const seed = Math.abs(hash) % 1000
  const x = Math.sin(seed) * 10000
  const rand = x - Math.floor(x)
  return Math.round((1.5 + rand * 3.0) * 10) / 10
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
  const [useAiQty, setUseAiQty] = useState(false)
  const [aiQtyLoading, setAiQtyLoading] = useState(false)
  const [aiQtyData, setAiQtyData] = useState(null)
  const [aiQtyError, setAiQtyError] = useState(false)
  const [actions, setActions] = useState(null)
  const [actionsLoading, setActionsLoading] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const totalQty = Object.values(qtyPerWarehouse).reduce((a, b) => a + (parseInt(b) || 0), 0)
  const color = product.status === "critical" ? "#ef4444" : "#f97316"

  const fetchAiQty = async () => {
    if (aiQtyData) return
    setAiQtyLoading(true)
    setAiQtyError(false)
    try {
      const res = await fetch(`${API_BASE}/api/forecast-qty/${product.id}`)
      const data = await res.json()
      if (data.success && data.recommendation) {
        setAiQtyData(data.recommendation)
        setQtyPerWarehouse(data.recommendation.per_warehouse)
      } else {
        setAiQtyError(true)
      }
    } catch (err) {
      setAiQtyError(true)
    }
    setAiQtyLoading(false)
  }

  const fetchActions = async () => {
    if (actions) { setShowActions(true); return }
    setActionsLoading(true)
    setShowActions(true)
    try {
      const res = await fetch(`${API_BASE}/api/actions/${product.id}`)
      const data = await res.json()
      if (data.success) setActions(data.actions)
    } catch (err) {
      console.error("Actions failed", err)
    }
    setActionsLoading(false)
  }

  const handleAiToggle = () => {
    const newVal = !useAiQty
    setUseAiQty(newVal)
    if (newVal) {
      if (aiQtyData) setQtyPerWarehouse(aiQtyData.per_warehouse)
      else fetchAiQty()
    } else {
      setQtyPerWarehouse(
        product.locations.reduce((acc, loc) => {
          acc[loc.location] = ps.reorder_qty ? Math.round(ps.reorder_qty / product.locations.length) : 10
          return acc
        }, {})
      )
    }
  }

  const urgencyColor = (u) => u === "high" ? "#ef4444" : u === "medium" ? "#f97316" : "#22c55e"

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#0d1e2a", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 18, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "22px 28px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 16, fontWeight: 500 }}>Trigger Reorder</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>Review details before sending</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, width: 32, height: 32, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Product info */}
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

          {/* AI Alternative Actions */}
          <div style={{ background: "rgba(139,92,246,0.06)", border: `0.5px solid ${showActions ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.15)"}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer" }} onClick={() => showActions ? setShowActions(false) : fetchActions()}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(139,92,246,0.12)", border: "0.5px solid rgba(139,92,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 13 }}>🧠</span>
                </div>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: 500, marginBottom: 1 }}>AI Alternative Actions</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>Smart merchant actions beyond reordering — ranked by urgency</div>
                </div>
              </div>
              <div style={{ color: "rgba(139,92,246,0.7)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                {showActions ? "▲ Hide" : "▼ Show"}
              </div>
            </div>
            {showActions && (
              <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {actionsLoading ? (
                  <div style={{ color: "rgba(139,92,246,0.6)", fontSize: 11, fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>🧠 Analyzing merchant options...</div>
                ) : actions ? (
                  actions.map((a, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderLeft: `2px solid ${urgencyColor(a.urgency)}`, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                      <div>
                        <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{a.action}</div>
                        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 1.5 }}>{a.reason}</div>
                      </div>
                      <span style={{ background: urgencyColor(a.urgency) + "15", color: urgencyColor(a.urgency), border: `0.5px solid ${urgencyColor(a.urgency)}30`, borderRadius: 100, padding: "2px 8px", fontSize: 8, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 }}>{a.urgency}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "center", padding: "8px 0" }}>Could not load suggestions</div>
                )}
              </div>
            )}
          </div>

          {/* AI Qty Toggle */}
          <div style={{ background: "rgba(100,200,220,0.06)", border: `0.5px solid ${useAiQty ? "rgba(100,200,220,0.35)" : "rgba(100,200,220,0.15)"}`, borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(100,200,220,0.1)", border: "0.5px solid rgba(100,200,220,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 13 }}>⚡</span>
                </div>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: 500, marginBottom: 1 }}>Use AI Recommended Quantities</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>Let AI calculate optimal reorder qty per warehouse based on sales velocity</div>
                </div>
              </div>
              <div onClick={handleAiToggle} style={{ width: 42, height: 24, borderRadius: 100, background: useAiQty ? "rgba(100,200,220,0.3)" : "rgba(255,255,255,0.08)", border: `0.5px solid ${useAiQty ? "rgba(100,200,220,0.5)" : "rgba(255,255,255,0.12)"}`, cursor: "pointer", position: "relative", transition: "all 0.3s", flexShrink: 0 }}>
                <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: useAiQty ? "rgba(100,200,220,0.9)" : "rgba(255,255,255,0.4)", top: 3, left: useAiQty ? 22 : 4, transition: "all 0.3s" }}></div>
              </div>
            </div>
            {useAiQty && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid rgba(100,200,220,0.1)" }}>
                {aiQtyLoading ? (
                  <div style={{ color: "rgba(100,200,220,0.6)", fontSize: 11, fontStyle: "italic" }}>⚡ Calculating optimal quantities...</div>
                ) : aiQtyError ? (
                  <div style={{ color: "#ef4444", fontSize: 11 }}>AI recommendation unavailable — using default quantities</div>
                ) : aiQtyData ? (
                  <div style={{ color: "rgba(100,200,220,0.8)", fontSize: 11, lineHeight: 1.6 }}>
                    <span style={{ color: "rgba(100,200,220,0.5)", fontWeight: 500 }}>AI says: </span>{aiQtyData.reasoning}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Qty per warehouse */}
          <div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
              Quantity to Order Per Warehouse
              {useAiQty && !aiQtyLoading && aiQtyData && <span style={{ color: "rgba(100,200,220,0.6)", marginLeft: 8, fontSize: 8 }}>⚡ AI RECOMMENDED</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {product.locations.map((loc, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.04)", border: `0.5px solid ${useAiQty && aiQtyData ? "rgba(100,200,220,0.15)" : "rgba(255,255,255,0.08)"}`, borderRadius: 9, padding: "10px 14px" }}>
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{loc.location}</div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 1 }}>Current: {loc.quantity} units</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>Order qty:</div>
                    <input type="number" min="0" value={qtyPerWarehouse[loc.location] || ""} onChange={e => { setUseAiQty(false); setQtyPerWarehouse(prev => ({ ...prev, [loc.location]: parseInt(e.target.value) || 0 })) }} style={{ width: 64, background: useAiQty && aiQtyData ? "rgba(100,200,220,0.08)" : "rgba(255,255,255,0.07)", border: `0.5px solid ${useAiQty && aiQtyData ? "rgba(100,200,220,0.3)" : "rgba(255,255,255,0.15)"}`, borderRadius: 7, padding: "6px 10px", color: useAiQty && aiQtyData ? "rgba(100,200,220,0.9)" : "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500, outline: "none", textAlign: "center" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supplier info */}
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

          {/* PO message */}
          <div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Message to Include in PO</div>
            <textarea value={poMessage} onChange={e => setPoMessage(e.target.value)} rows={5} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", color: "rgba(255,255,255,0.7)", fontSize: 12, outline: "none", resize: "vertical", lineHeight: 1.6, fontFamily: "sans-serif" }} />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px", color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Cancel</button>
            <button onClick={() => onConfirm(product, qtyPerWarehouse, poMessage, totalQty)} disabled={sending || aiQtyLoading} style={{ flex: 2, background: success ? "rgba(34,197,94,0.2)" : color + "20", border: `1px solid ${success ? "rgba(34,197,94,0.5)" : color + "50"}`, borderRadius: 10, padding: "12px", color: success ? "#22c55e" : color, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: (sending || aiQtyLoading) ? "not-allowed" : "pointer", transition: "all 0.3s" }}>
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
  const [forecasts, setForecasts] = useState({})
  const [loadingForecast, setLoadingForecast] = useState({})
  const [history, setHistory] = useState([])
  const [historySearch, setHistorySearch] = useState("")
  const [historyStatus, setHistoryStatus] = useState("all")
  const [historyMonth, setHistoryMonth] = useState("all")
  const [historySort, setHistorySort] = useState("newest")

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
    if (tab === "history") {
      fetch(`${API_BASE}/api/history`)
        .then(res => res.json())
        .then(data => setHistory(data))
    }
  }, [tab])

  useEffect(() => {
    if (authenticated && !settings) {
      fetch(`${API_BASE}/api/settings`)
        .then(res => res.json())
        .then(data => setSettings(data))
    }
  }, [authenticated])

  const fetchForecast = async (product) => {
    if (forecasts[product.id] || loadingForecast[product.id]) return
    setLoadingForecast(prev => ({ ...prev, [product.id]: true }))
    try {
      const res = await fetch(`${API_BASE}/api/forecast/${product.id}`)
      const data = await res.json()
      if (data.success && data.forecast) {
        setForecasts(prev => ({ ...prev, [product.id]: data.forecast }))
      }
    } catch (err) {
      console.error("Forecast failed", err)
    }
    setLoadingForecast(prev => ({ ...prev, [product.id]: false }))
  }

  useEffect(() => {
    if (inventory.length > 0) {
      inventory.filter(p => p.status !== "ok").forEach(product => fetchForecast(product))
    }
  }, [inventory])

  const handlePassword = () => {
    if (passwordInput === ADMIN_PASSWORD) { setAuthenticated(true); setPasswordError(false) }
    else setPasswordError(true)
  }

  const handleGlobalToggle = () => {
    setSettings(prev => {
      const newValue = !prev.auto_reorder_enabled
      const updatedProducts = {}
      Object.keys(prev.products).forEach(sku => {
        const match = inventory.find(p => p.sku === sku)
        const status = match ? match.status : null
        const isActionable = status === "low" || status === "critical"
        updatedProducts[sku] = { ...prev.products[sku], auto_send: isActionable ? newValue : false }
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
    await fetch(`${API_BASE}/api/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) })
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
    setSettings(prev => ({ ...prev, products: { ...prev.products, [sku]: { ...prev.products[sku], [field]: value } } }))
  }

  const atRiskProducts = inventory.filter(p => {
    if (p.status !== "ok") return false
    const dailySales = getSimulatedDailySales(p.sku)
    const daysLeft = dailySales > 0 ? p.inventory / dailySales : 999
    return daysLeft <= 7
  }).map(p => {
    const dailySales = getSimulatedDailySales(p.sku)
    const daysLeft = Math.round(p.inventory / dailySales * 10) / 10
    return { ...p, daysLeft, dailySales }
  })

  const filtered = filter === "all" ? inventory : inventory.filter(p => p.status === filter)
  const adminFiltered = adminFilter === "all" ? inventory : inventory.filter(p => p.status === adminFilter)
  const critical = inventory.filter(p => p.status === "critical").length
  const low = inventory.filter(p => p.status === "low").length
  const ok = inventory.filter(p => p.status === "ok").length
  const healthScore = inventory.length > 0 ? Math.round((ok / inventory.length) * 100) : 0
  const healthColor = healthScore >= 70 ? "#22c55e" : healthScore >= 40 ? "#f97316" : "#ef4444"

  const availableMonths = [...new Set(history.map(e => {
    const d = new Date(e.timestamp)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }))].sort().reverse()

  const filteredHistory = history
    .filter(e => {
      const matchSearch = !historySearch || e.title.toLowerCase().includes(historySearch.toLowerCase()) || e.sku.toLowerCase().includes(historySearch.toLowerCase()) || (e.supplier_name && e.supplier_name.toLowerCase().includes(historySearch.toLowerCase()))
      const matchStatus = historyStatus === "all" || e.status === historyStatus
      const matchMonth = historyMonth === "all" || e.timestamp.startsWith(historyMonth)
      return matchSearch && matchStatus && matchMonth
    })
    .sort((a, b) => historySort === "newest" ? new Date(b.timestamp) - new Date(a.timestamp) : historySort === "oldest" ? new Date(a.timestamp) - new Date(b.timestamp) : historySort === "qty_high" ? b.total_qty_ordered - a.total_qty_ordered : a.total_qty_ordered - b.total_qty_ordered)

  const totalQtyOrdered = filteredHistory.reduce((sum, e) => sum + (e.total_qty_ordered || 0), 0)

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
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: `0.5px solid ${healthColor}30`, borderRadius: 10, padding: "8px 14px" }}>
            <div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>Inventory Health</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: healthColor, lineHeight: 1 }}>{healthScore}%</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `conic-gradient(${healthColor} ${healthScore * 3.6}deg, rgba(255,255,255,0.08) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#07111a" }}></div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 14, fontWeight: 500 }}>{store}</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2, letterSpacing: 1 }}>Live Inventory · 3 Warehouses</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "28px 40px", position: "relative", zIndex: 2 }}>

        {/* Nav tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {["inventory", "reorder rules", "history"].map(t => (
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

            {/* At Risk Banner */}
            {atRiskProducts.length > 0 && (
              <div style={{ background: "rgba(234,179,8,0.06)", border: "0.5px solid rgba(234,179,8,0.25)", borderRadius: 12, padding: "16px 20px", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 14 }}>⚠️</span>
                  <div>
                    <span style={{ color: "rgba(234,179,8,0.9)", fontSize: 12, fontWeight: 600 }}>
                      {atRiskProducts.length} product{atRiskProducts.length > 1 ? "s" : ""} trending toward stockout
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginLeft: 8 }}>Currently OK but projected to hit threshold within 7 days</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {atRiskProducts.map(p => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(234,179,8,0.15)", borderRadius: 8, padding: "10px 14px" }}>
                      <div>
                        <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: 500 }}>{p.title}</div>
                        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 1.5, marginTop: 1 }}>{p.sku}</div>
                      </div>
                      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 1 }}>Current Stock</div>
                          <div style={{ color: "#22c55e", fontSize: 14, fontWeight: 500 }}>{p.inventory} units</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 1 }}>Daily Velocity</div>
                          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{p.dailySales}/day</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 1 }}>Est. Days Left</div>
                          <div style={{ color: "rgba(234,179,8,0.9)", fontSize: 14, fontWeight: 600 }}>{p.daysLeft} days</div>
                        </div>
                        <span style={{ background: "rgba(234,179,8,0.12)", color: "rgba(234,179,8,0.85)", border: "0.5px solid rgba(234,179,8,0.3)", borderRadius: 100, padding: "2px 10px", fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" }}>At Risk</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {["all", "critical", "low", "ok"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? "rgba(255,255,255,0.1)" : "transparent", border: `0.5px solid ${filter === f ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: 100, padding: "6px 16px", color: filter === f ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                  {f}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
              {filtered.map(product => {
                const isAtRisk = atRiskProducts.find(p => p.id === product.id)
                return (
                  <div key={product.id} style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", border: `0.5px solid ${isAtRisk ? "rgba(234,179,8,0.3)" : product.status === "ok" ? "rgba(255,255,255,0.1)" : statusColor(product.status) + "30"}`, borderRadius: 14, padding: 22, minHeight: 320 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 18 }}>
                      <div>
                        <div style={{ color: "rgba(255,255,255,0.88)", fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{product.title}</div>
                        <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, letterSpacing: 2 }}>{product.sku}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "end", gap: 4 }}>
                        <span style={{ background: statusColor(product.status) + "18", color: statusColor(product.status), border: `0.5px solid ${statusColor(product.status)}40`, borderRadius: 100, padding: "3px 10px", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>{product.status}</span>
                        {isAtRisk && <span style={{ background: "rgba(234,179,8,0.12)", color: "rgba(234,179,8,0.85)", border: "0.5px solid rgba(234,179,8,0.3)", borderRadius: 100, padding: "2px 8px", fontSize: 8, letterSpacing: 1, textTransform: "uppercase" }}>⚠ {isAtRisk.daysLeft}d left</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 18 }}>
                      <div>
                        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Total Stock</div>
                        <div style={{ color: isAtRisk ? "rgba(234,179,8,0.9)" : statusColor(product.status), fontSize: 32, fontWeight: 500, lineHeight: 1 }}>{product.inventory}</div>
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
                                <div style={{ width: `${Math.min((loc.quantity / product.threshold) * 100, 100)}%`, height: "100%", background: isAtRisk ? "rgba(234,179,8,0.7)" : statusColor(product.status), borderRadius: 2 }}></div>
                              </div>
                              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 500, minWidth: 16, textAlign: "right" }}>{loc.quantity}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {product.status !== "ok" && (
                      <div style={{ marginTop: 14, background: "rgba(100,200,220,0.06)", border: "0.5px solid rgba(100,200,220,0.18)", borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ fontSize: 8, color: "rgba(100,200,220,0.6)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>⚡ AI Forecast</div>
                        {loadingForecast[product.id] ? (
                          <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, fontStyle: "italic" }}>Analyzing inventory trends...</div>
                        ) : forecasts[product.id] ? (
                          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, lineHeight: 1.6 }}>{forecasts[product.id]}</div>
                        ) : (
                          <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, fontStyle: "italic" }}>Forecast unavailable</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
                                <td style={{ padding: "12px" }}>
                                  {isActionable ? (
                                    <div onClick={() => updateProductSetting(product.sku, "auto_send", !ps.auto_send)} style={{ width: 36, height: 20, borderRadius: 100, background: ps.auto_send ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.07)", border: `0.5px solid ${ps.auto_send ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.1)"}`, cursor: "pointer", position: "relative", transition: "all 0.3s" }}>
                                      <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: ps.auto_send ? "#f97316" : "rgba(255,255,255,0.35)", top: 2.5, left: ps.auto_send ? 18 : 3, transition: "all 0.3s" }}></div>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: "12px" }}>
                                  {isActionable ? (
                                    <button onClick={() => setModalProduct(product)} style={{ background: statusColor(product.status) + "25", border: `1px solid ${statusColor(product.status)}60`, borderRadius: 7, padding: "7px 12px", color: statusColor(product.status), fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
                                      ⚡ Reorder
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>—</span>
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

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20 }}>
              <div>
                <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Reorder History</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>All reorders triggered with timestamps and details</div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>Total Units Ordered</div>
                  <div style={{ fontSize: 18, fontWeight: 500, color: "rgba(100,200,220,0.9)" }}>{totalQtyOrdered}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>Showing</div>
                  <div style={{ fontSize: 18, fontWeight: 500, color: "rgba(255,255,255,0.6)" }}>{filteredHistory.length} / {history.length}</div>
                </div>
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Search</div>
                <input type="text" placeholder="Product, SKU, or supplier..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "7px 12px", color: "rgba(255,255,255,0.8)", fontSize: 12, outline: "none" }} />
              </div>
              <div style={{ minWidth: 140 }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Month</div>
                <select value={historyMonth} onChange={e => setHistoryMonth(e.target.value)} style={{ width: "100%", background: "#0d1e2a", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "7px 12px", color: "rgba(255,255,255,0.8)", fontSize: 12, outline: "none", cursor: "pointer" }}>
                  <option value="all">All Months</option>
                  {availableMonths.map(m => {
                    const [year, month] = m.split("-")
                    const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleString("default", { month: "long", year: "numeric" })
                    return <option key={m} value={m}>{label}</option>
                  })}
                </select>
              </div>
              <div style={{ minWidth: 130 }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Status</div>
                <select value={historyStatus} onChange={e => setHistoryStatus(e.target.value)} style={{ width: "100%", background: "#0d1e2a", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "7px 12px", color: "rgba(255,255,255,0.8)", fontSize: 12, outline: "none", cursor: "pointer" }}>
                  <option value="all">All Statuses</option>
                  <option value="critical">Critical</option>
                  <option value="low">Low</option>
                  <option value="ok">OK</option>
                </select>
              </div>
              <div style={{ minWidth: 150 }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Sort By</div>
                <select value={historySort} onChange={e => setHistorySort(e.target.value)} style={{ width: "100%", background: "#0d1e2a", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "7px 12px", color: "rgba(255,255,255,0.8)", fontSize: 12, outline: "none", cursor: "pointer" }}>
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="qty_high">Qty — High to Low</option>
                  <option value="qty_low">Qty — Low to High</option>
                </select>
              </div>
              {(historySearch || historyStatus !== "all" || historyMonth !== "all" || historySort !== "newest") && (
                <button onClick={() => { setHistorySearch(""); setHistoryStatus("all"); setHistoryMonth("all"); setHistorySort("newest") }} style={{ background: "rgba(239,68,68,0.1)", border: "0.5px solid rgba(239,68,68,0.25)", borderRadius: 7, padding: "7px 14px", color: "#ef4444", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", alignSelf: "end" }}>
                  Clear
                </button>
              )}
            </div>

            {filteredHistory.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 4 }}>{history.length === 0 ? "No reorders yet" : "No results match your filters"}</div>
                  <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>{history.length === 0 ? "Trigger a reorder from the Reorder Rules tab" : "Try adjusting your search or filters"}</div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredHistory.map((entry, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(99,102,241,0.12)", border: "0.5px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 16 }}>📦</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{entry.title}</div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 1.5 }}>{entry.sku}</span>
                          <span style={{ background: statusColor(entry.status) + "18", color: statusColor(entry.status), border: `0.5px solid ${statusColor(entry.status)}40`, borderRadius: 100, padding: "1px 7px", fontSize: 8, letterSpacing: 1, textTransform: "uppercase" }}>{entry.status}</span>
                          {entry.supplier_name && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>→ {entry.supplier_name}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 20, alignItems: "center", flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>Qty Ordered</div>
                        <div style={{ color: "rgba(100,200,220,0.9)", fontSize: 18, fontWeight: 500 }}>{entry.total_qty_ordered}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>Stock at Reorder</div>
                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{entry.inventory_at_reorder} units</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>Date & Time</div>
                        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{entry.timestamp}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App