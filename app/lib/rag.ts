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
  return google(process.env.GEMINI_MODEL ?? "gemini-2.0-flash");
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

export function createExtractiveAnswer(
  matches: ReturnType<typeof normalizeMatches>,
  question = "",
  maxSources = 3,
) {
  const selected = matches.slice(0, maxSources);

  if (selected.length === 0) {
    return "Tidak ditemukan di SOP.";
  }

  const evidence = selected
    .map((match, index) => `[${index + 1}] ${createQueryExcerpt(match.content, question)}`)
    .join("\n\n");

  return [
    "Gemini sedang tidak tersedia, jadi NEXAID menampilkan jawaban ekstraktif langsung dari kutipan SOP paling relevan.",
    evidence,
  ].join("\n\n");
}

function extractSource(value: string) {
  const match = value.match(/^Sumber:\s*(.+)$/im);
  return match?.[1]?.trim();
}

function createQueryExcerpt(value: string, question: string, maxLength = 420) {
  const text = normalizeText(value).replace(/^Sumber:\s*.+?\n\n/i, "");
  const terms = tokenize(question);
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30);

  const best = sentences
    .map((sentence, index) => ({
      index,
      sentence,
      score:
        Array.from(tokenize(sentence)).filter((term) => terms.has(term)).length +
        getQuestionIntentBonus(sentence, question),
    }))
    .sort((a, b) => b.score - a.score || b.sentence.length - a.sentence.length)[0]?.sentence;

  const bestIndex =
    best && terms.size > 0 ? sentences.findIndex((sentence) => sentence === best) : -1;
  const excerpt =
    bestIndex >= 0
      ? sentences.slice(bestIndex, bestIndex + 3).join(" ")
      : text;

  if (excerpt.length <= maxLength) {
    return excerpt;
  }

  return `${excerpt.slice(0, maxLength).trim()}...`;
}

function tokenize(value: string) {
  const stopwords = new Set([
    "apa",
    "saja",
    "yang",
    "dan",
    "atau",
    "dalam",
    "pada",
    "saat",
    "untuk",
    "dengan",
    "bagaimana",
    "siapa",
    "harus",
    "bisa",
    "dari",
    "ke",
    "di",
  ]);

  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((term) => normalizeTerm(term.trim()))
      .filter((term) => term.length > 2 && !stopwords.has(term)),
  );
}

function normalizeTerm(term: string) {
  if (term.includes("tetap")) {
    return "tetap";
  }

  return term;
}

function getQuestionIntentBonus(sentence: string, question: string) {
  const lowerQuestion = question.toLowerCase();
  const lowerSentence = sentence.toLowerCase();
  let bonus = 0;

  if (
    lowerQuestion.includes("siapa") &&
    /\b(oleh|presiden|gubernur|bupati|walikota|kepala|ketua)\b/.test(lowerSentence)
  ) {
    bonus += 2;
  }

  return bonus;
}
