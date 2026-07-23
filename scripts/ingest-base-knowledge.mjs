import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { google } from "@ai-sdk/google";
import { embedMany } from "ai";
import nextEnv from "@next/env";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { loadEnvConfig } = nextEnv;
loadEnvConfig(root);

const baseKnowledgeDir = path.join(root, "base-knowledge");
const extractedDir = path.join(baseKnowledgeDir, "extracted");
const embeddingDimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? "768");
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
const ocrModel = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} belum tersedia di .env.local`);
  }

  if (name === "SUPABASE_SERVICE_ROLE_KEY" && value.startsWith("sb_publishable")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY masih publishable/anon key. Ambil service_role atau secret key server dari Supabase, lalu jalankan ulang ingest.",
    );
  }

  return value;
}

function normalizeText(value) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractWithPdftotext(filePath) {
  try {
    return normalizeText(execFileSync("pdftotext", [filePath, "-"], { encoding: "utf8" }));
  } catch {
    return "";
  }
}

async function extractWithGeminiPdf(filePath) {
  const apiKey = requireEnv("GOOGLE_GENERATIVE_AI_API_KEY");
  const pdf = readFileSync(filePath).toString("base64");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${ocrModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Ekstrak semua teks yang terbaca dari PDF SOP ini.",
                  "Kembalikan plain text saja, tanpa ringkasan dan tanpa markdown.",
                  "Pertahankan urutan bagian, nomor, tabel, dan istilah Indonesia semampunya.",
                ].join(" "),
              },
              {
                inline_data: {
                  mime_type: "application/pdf",
                  data: pdf,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini PDF extraction gagal (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n");

  return normalizeText(text ?? "");
}

function chunkText(text, source, wordsPerChunk = 420) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const chunks = [];
  const overlap = 60;
  const step = wordsPerChunk - overlap;

  for (let start = 0; start < words.length; start += step) {
    const body = words.slice(start, start + wordsPerChunk).join(" ").trim();

    if (body.length >= 80) {
      chunks.push({
        konten: `Sumber: ${source}\n\n${body}`,
        source,
        chunk_index: chunks.length,
      });
    }
  }

  return chunks;
}

async function insertBatch(sb, batch) {
  const { embeddings } = await embedMany({
    model: google.embedding(embeddingModel),
    values: batch.map((chunk) => chunk.konten),
    providerOptions: {
      google: {
        outputDimensionality: embeddingDimensions,
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

  const enhanced = await sb.from("sop_chunks").insert(enhancedRows);

  if (!enhanced.error) {
    return "enhanced";
  }

  const minimalRows = enhancedRows.map(({ konten, embedding }) => ({ konten, embedding }));
  const minimal = await sb.from("sop_chunks").insert(minimalRows);

  if (minimal.error) {
    throw new Error(`Supabase insert gagal: ${minimal.error.message}`);
  }

  return "minimal";
}

async function main() {
  mkdirSync(extractedDir, { recursive: true });

  const sb = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pdfFiles = readdirSync(baseKnowledgeDir)
    .filter((file) => file.toLowerCase().endsWith(".pdf"))
    .sort((a, b) => a.localeCompare(b, "id"));

  if (pdfFiles.length === 0) {
    throw new Error("Tidak ada PDF di base-knowledge.");
  }

  const allChunks = [];
  const extraction = [];

  for (const file of pdfFiles) {
    const filePath = path.join(baseKnowledgeDir, file);
    const source = path.basename(file, ".pdf");
    let text = extractWithPdftotext(filePath);
    let method = "pdftotext";

    if (text.length < 200) {
      try {
        text = await extractWithGeminiPdf(filePath);
        method = "gemini-pdf";
      } catch (error) {
        method = "failed-gemini-pdf";
        extraction.push({
          file,
          method,
          chars: text.length,
          chunks: 0,
          error: error instanceof Error ? error.message : "Unknown extraction error",
        });
        continue;
      }
    }

    const textPath = path.join(extractedDir, `${source}.txt`);
    writeFileSync(textPath, `${text}\n`, "utf8");

    const chunks = chunkText(text, source);
    extraction.push({ file, method, chars: text.length, chunks: chunks.length });
    allChunks.push(...chunks);
  }

  if (allChunks.length === 0) {
    throw new Error("Tidak ada chunk valid yang bisa di-ingest.");
  }

  let inserted = 0;
  let schema = "enhanced";

  for (let start = 0; start < allChunks.length; start += 24) {
    const batch = allChunks.slice(start, start + 24);
    const batchSchema = await insertBatch(sb, batch);
    inserted += batch.length;

    if (batchSchema === "minimal") {
      schema = "minimal";
    }

    console.log(`Inserted ${inserted}/${allChunks.length}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        schema,
        inserted,
        extraction,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
