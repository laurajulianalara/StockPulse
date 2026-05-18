import { useState, useEffect } from "react"

const API_BASE = import.meta.env.VITE_API_URL || ""

function App() {
  const [inventory, setInventory] = useState([])
  const [store, setStore] = useState("")
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
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

  const filtered = filter === "all" ? inventory : inventory.filter(p => p.status === filter)
  const critical = inventory.filter(p => p.status === "critical").length
  const low = inventory.filter(p => p.status === "low").length
  const ok = inventory.filter(p => p.status === "ok").length

  const gradientBg = `
    radial-gradient(ellipse at 25% 25%, rgba(224,247,250,0.75) 0%, transparent 55%),
    radial-gradient(ellipse at 75% 75%, rgba(128,222,234,0.6) 0%, transparent 50%),
    radial-gradient(ellipse at 60% 20%, rgba(178,235,242,0.55) 0%, transparent 45%),
    radial-gradient(ellipse at 15% 80%, rgba(55,80,100,0.5) 0%, transparent 45%),
    #1e2e38
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

  if (loading) return (
    <div style={{ minHeight: "100vh", background: gradientBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "4px", fontSize: 12, textTransform: "uppercase" }}>Loading inventory...</div>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", background: gradientBg, fontFamily: "sans-serif", position: "relative" }}>

      {/* Grain layers */}
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

      <div style={{ padding: "32px 40px", position: "relative", zIndex: 2 }}>

        {/* Summary cards */}
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

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["all", "critical", "low", "ok"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? "rgba(255,255,255,0.1)" : "transparent", border: `0.5px solid ${filter === f ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: 100, padding: "6px 16px", color: filter === f ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
              {f}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {filtered.map(product => (
            <div key={product.id} style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)", border: `0.5px solid ${product.status === "ok" ? "rgba(255,255,255,0.1)" : statusColor(product.status) + "30"}`, borderRadius: 14, padding: 22 }}>

              {/* Product header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 18 }}>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.88)", fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{product.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, letterSpacing: 2 }}>{product.sku}</div>
                </div>
                <span style={{ background: statusColor(product.status) + "18", color: statusColor(product.status), border: `0.5px solid ${statusColor(product.status)}40`, borderRadius: 100, padding: "3px 10px", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {product.status}
                </span>
              </div>

              {/* Inventory numbers */}
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

              {/* Location breakdown */}
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

              {/* Reorder button */}
              {product.status !== "ok" && (
                <button
                  onClick={() => handleReorder(product)}
                  disabled={reordering === product.id}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    background: reorderSuccess === product.id ? "#22c55e18" : statusColor(product.status) + "15",
                    border: `0.5px solid ${reorderSuccess === product.id ? "#22c55e50" : statusColor(product.status) + "40"}`,
                    borderRadius: 8,
                    padding: "10px",
                    color: reorderSuccess === product.id ? "#22c55e" : statusColor(product.status),
                    fontSize: 10,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    cursor: reordering === product.id ? "not-allowed" : "pointer",
                    transition: "all 0.3s"
                  }}>
                  {reordering === product.id
                    ? "⏳ Sending Alert..."
                    : reorderSuccess === product.id
                    ? "✅ Reorder Alert Sent!"
                    : "Trigger Reorder"}
                </button>
              )}

            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App