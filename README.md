# NEXAID

NEXAID adalah MVP chatbot RAG untuk menjawab pertanyaan operasional bencana hanya dari dokumen SOP yang di-ingest ke Supabase pgvector, lengkap dengan kutipan sumber.

## Stack

- Next.js App Router + TypeScript
- Supabase + pgvector
- Vercel AI SDK + Google Gemini

## Environment

Isi `.env.local`:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

Opsional:

```env
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
SOP_MATCH_COUNT=5
```

## Setup Supabase

Jalankan SQL di [supabase/schema.sql](supabase/schema.sql) lewat Supabase SQL Editor. Schema ini menambahkan kolom `source` dan `chunk_index` agar kutipan di UI bisa menampilkan asal dokumen.

## Jalankan Lokal

```bash
npm.cmd run dev
```

Buka `http://127.0.0.1:3000`.

## Ingest SOP

Gunakan panel `Ingest teks SOP` di halaman utama, atau POST langsung:

```bash
curl -X POST http://127.0.0.1:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d "{\"source\":\"SOP Pendistribusian Logpal\",\"teks\":\"...teks SOP resmi...\"}"
```

Catatan: PDF SOP di `base-knowledge` terdeteksi sebagai scan/gambar saat dicek dengan `pdftotext`, sehingga perlu OCR atau teks SOP hasil salin sebelum bisa di-ingest sebagai basis RAG.
