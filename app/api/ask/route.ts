// app/api/ask/route.ts
import { google } from "@ai-sdk/google"
import { embed, generateText } from "ai"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  const { question } = await req.json()
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { embedding } = await embed({
    model: google.textEmbeddingModel("text-embedding-004"),
    value: question,
  })
  const { data: chunks } = await sb.rpc("match_sop", { query_embedding: embedding, match_count: 4 })
  const context = (chunks ?? []).map((c: any) => c.konten).join("\n---\n")

  const { text } = await generateText({
    model: google("gemini-1.5-flash"),
    system: "Jawab HANYA dari konteks SOP di bawah. Jika tidak ada, jawab 'Tidak ditemukan di SOP'. Sertakan kutipan singkat pendukung.",
    prompt: `KONTEKS:\n${context}\n\nPERTANYAAN: ${question}`,
  })
  return Response.json({ answer: text, sources: chunks })
}