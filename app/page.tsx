"use client"
import { useState } from "react"

export default function Home() {
  const [q, setQ] = useState("")
  const [ans, setAns] = useState("")
  const [loading, setLoading] = useState(false)

  async function tanya() {
    setLoading(true)
    const r = await fetch("/api/ask", {
      method: "POST", body: JSON.stringify({ question: q }),
    })
    const d = await r.json()
    setAns(d.answer)
    setLoading(false)
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>📘 Tanya SOP Bencana</h1>
      <textarea value={q} onChange={e => setQ(e.target.value)}
        placeholder="Cth: Prosedur distribusi air bersih di pengungsian?"
        rows={3} style={{ width: "100%" }} />
      <button onClick={tanya} disabled={loading}>
        {loading ? "Mencari..." : "Tanya"}
      </button>
      {ans && <p style={{ whiteSpace: "pre-wrap", marginTop: 16 }}>{ans}</p>}
    </main>
  )
}