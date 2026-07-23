import { embed, generateText } from "ai";
import { getSupabaseAdmin } from "@/app/lib/supabase";
import {
  EMBEDDING_DIMENSIONS,
  createExtractiveAnswer,
  getEmbeddingModel,
  getGenerationModel,
  MATCH_COUNT,
  normalizeMatches,
  type SopMatch,
} from "@/app/lib/rag";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { question } = (await req.json()) as { question?: string };
    const cleanQuestion = question?.trim();

    if (!cleanQuestion) {
      return Response.json({ error: "Pertanyaan wajib diisi." }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { embedding } = await embed({
      model: getEmbeddingModel(),
      value: cleanQuestion,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
          taskType: "RETRIEVAL_QUERY",
        },
      },
    });

    const { data, error } = await sb.rpc("match_sop", {
      query_embedding: embedding,
      match_count: MATCH_COUNT,
    });

    if (error) {
      return Response.json(
        {
          error: "Retrieval Supabase gagal.",
          detail: error.message,
          setup: "Pastikan extension vector, tabel sop_chunks, dan fungsi match_sop sudah dibuat.",
        },
        { status: 500 },
      );
    }

    const matches = normalizeMatches(data as SopMatch[]);

    if (matches.length === 0) {
      return Response.json({
        answer: "Tidak ditemukan di SOP.",
        sources: [],
      });
    }

    const context = matches
      .map(
        (match, index) =>
          `[${index + 1}] ${match.source} - chunk ${match.chunkIndex}\n${match.content}`,
      )
      .join("\n\n---\n\n");

    try {
      const { text } = await generateText({
        model: getGenerationModel(),
        system: [
          "Anda adalah NEXAID, asisten SOP bencana untuk relawan dan koordinator posko.",
          "Jawab hanya berdasarkan KONTEKS SOP yang diberikan.",
          "Jika konteks tidak memuat jawaban yang jelas, jawab persis: Tidak ditemukan di SOP.",
          "Jangan gunakan pengetahuan umum, asumsi, atau prosedur di luar konteks.",
          "Jawaban harus ringkas, operasional, berbahasa Indonesia, dan menyebut nomor sumber seperti [1].",
        ].join(" "),
        prompt: `KONTEKS SOP:\n${context}\n\nPERTANYAAN:\n${cleanQuestion}`,
      });

      return Response.json({
        answer: text.trim(),
        sources: matches,
      });
    } catch (generationError) {
      return Response.json({
        answer: createExtractiveAnswer(matches, cleanQuestion),
        sources: matches,
        mode: "extractive-fallback",
        warning:
          generationError instanceof Error
            ? generationError.message
            : "Gemini generation failed.",
      });
    }
  } catch (error) {
    return Response.json(
      {
        error: "Gagal menjawab pertanyaan.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
