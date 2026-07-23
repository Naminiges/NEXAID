// app/api/ingest/route.ts
import { google } from "@ai-sdk/google"
import { embedMany } from "ai"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  const { teks } = await req.json()          // teks SOP panjang
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // pecah sederhana per ~500 kata
  const kata = teks.split(/\s+/)
  const chunks: string[] = []
  for (let i = 0; i < kata.length; i += 500) chunks.push(kata.slice(i, i + 500).join(" "))

  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel("text-embedding-004"),
    values: chunks,
  })
  await sb.from("sop_chunks").insert(
    chunks.map((konten, i) => ({ konten, embedding: embeddings[i] }))
  )
  return Response.json({ inserted: chunks.length })
}