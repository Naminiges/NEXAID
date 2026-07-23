import { google } from "@ai-sdk/google";

export type IngestChunk = {
  konten: string;
  source: string;
  chunk_index: number;
};

export type SopMatch = {
  id?: string;
  konten: string;
  source?: string | null;
  chunk_index?: number | null;
  similarity?: number | null;
};

export const EMBEDDING_DIMENSIONS = Number(
  process.env.GEMINI_EMBEDDING_DIMENSIONS ?? "768",
);

export const MATCH_COUNT = Number(process.env.SOP_MATCH_COUNT ?? "5");

export function getEmbeddingModel() {
  return google.embedding(process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001");
}

export function getGenerationModel() {
  return google(process.env.GEMINI_MODEL ?? "gemini-2.5-flash");
}

export function normalizeText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(text: string, source = "SOP", wordsPerChunk = 420) {
  const cleaned = normalizeText(text);
  const words = cleaned.split(/\s+/).filter(Boolean);
  const chunks: IngestChunk[] = [];
  const overlap = 60;
  const step = Math.max(1, wordsPerChunk - overlap);

  for (let start = 0; start < words.length; start += step) {
    const content = words.slice(start, start + wordsPerChunk).join(" ").trim();

    if (content.length >= 80) {
      chunks.push({
        konten: `Sumber: ${source}\n\n${content}`,
        source,
        chunk_index: chunks.length,
      });
    }
  }

  return chunks;
}

export function normalizeMatches(chunks: SopMatch[] | null | undefined) {
  return (chunks ?? []).map((chunk, index) => ({
    id: chunk.id ?? `${chunk.source ?? "SOP"}-${chunk.chunk_index ?? index}`,
    content: chunk.konten,
    source: chunk.source ?? extractSource(chunk.konten) ?? "Dokumen SOP",
    chunkIndex: chunk.chunk_index ?? index,
    similarity:
      typeof chunk.similarity === "number"
        ? Math.max(0, Math.min(1, chunk.similarity))
        : null,
    excerpt: createExcerpt(chunk.konten),
  }));
}

export function createExcerpt(value: string, maxLength = 360) {
  const text = normalizeText(value).replace(/^Sumber:\s*.+?\n\n/i, "");

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function extractSource(value: string) {
  const match = value.match(/^Sumber:\s*(.+)$/im);
  return match?.[1]?.trim();
}
