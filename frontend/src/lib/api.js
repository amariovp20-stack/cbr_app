const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export async function calcularCBR(payload) {
  const res = await fetch(`${API_BASE}/api/cbr/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'No se pudo calcular el CBR.')
  }

  return res.json()
}
