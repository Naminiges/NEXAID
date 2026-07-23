import { embedMany } from "ai";
import { getSupabaseAdmin } from "@/app/lib/supabase";
import { chunkText, EMBEDDING_DIMENSIONS, getEmbeddingModel } from "@/app/lib/rag";

export const runtime = "nodejs";

type IngestDocument = {
  teks?: string;
  text?: string;
  source?: string;
};

export async function GET() {
  return Response.json({
    endpoint: "/api/ingest",
    method: "POST",
    body: {
      teks: "teks SOP panjang",
      source: "Nama dokumen SOP",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IngestDocument | { documents: IngestDocument[] };
    const documents = "documents" in body ? body.documents : [body];

    if (!Array.isArray(documents) || documents.length === 0) {
      return Response.json({ error: "Kirim minimal satu dokumen SOP." }, { status: 400 });
    }

    const chunks = documents.flatMap((doc, index) =>
      chunkText(doc.teks ?? doc.text ?? "", doc.source ?? `SOP ${index + 1}`),
    );

    if (chunks.length === 0) {
      return Response.json(
        { error: "Teks SOP terlalu pendek atau kosong. PDF scan perlu OCR dulu." },
        { status: 400 },
      );
    }

    const sb = getSupabaseAdmin();
    let inserted = 0;
    let usedMinimalSchema = false;

    for (let start = 0; start < chunks.length; start += 24) {
      const batch = chunks.slice(start, start + 24);
      const { embeddings } = await embedMany({
        model: getEmbeddingModel(),
        values: batch.map((chunk) => chunk.konten),
        providerOptions: {
          google: {
            outputDimensionality: EMBEDDING_DIMENSIONS,
            taskType: "RETRIEVAL_DOCUMENT",
          },
        },
      });

      const enhancedRows = batch.map((chunk, index) => ({
        konten: chunk.konten,
        source: chunk.source,
        chunk_index: chunk.chunk_index,
        embedding: embeddings[index],
      }));

      const { error } = await sb.from("sop_chunks").insert(enhancedRows);

      if (error) {
        const minimalRows = enhancedRows.map(({ konten, embedding }) => ({
          konten,
          embedding,
        }));
        const fallback = await sb.from("sop_chunks").insert(minimalRows);

        if (fallback.error) {
          return Response.json(
            {
              error: "Gagal menyimpan chunk SOP ke Supabase.",
              detail: fallback.error.message,
              setup: "Jalankan SQL di supabase/schema.sql lalu ulangi ingest.",
            },
            { status: 500 },
          );
        }

        usedMinimalSchema = true;
      }

      inserted += batch.length;
    }

    return Response.json({
      inserted,
      chunks: chunks.length,
      schema: usedMinimalSchema ? "minimal" : "enhanced",
    });
  } catch (error) {
    return Response.json(
      {
        error: "Ingest gagal.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
