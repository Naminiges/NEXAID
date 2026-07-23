"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

type Source = {
  id: string;
  source: string;
  chunkIndex: number;
  similarity: number | null;
  excerpt: string;
};

type AskResult = {
  answer?: string;
  sources?: Source[];
  error?: string;
  detail?: string;
  setup?: string;
};

const examples = [
  "Apa langkah awal saat sistem peringatan dini aktif?",
  "Bagaimana prosedur distribusi logistik ke pengungsian?",
  "Siapa yang berwenang mengambil keputusan darurat?",
];

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ingestText, setIngestText] = useState("");
  const [ingestSource, setIngestSource] = useState("SOP Bencana");
  const [ingestStatus, setIngestStatus] = useState("");
  const [ingesting, setIngesting] = useState(false);

  const canAsk = useMemo(() => question.trim().length > 2 && !loading, [question, loading]);

  async function ask(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!canAsk) {
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await response.json()) as AskResult;

      if (!response.ok || data.error) {
        setError([data.error, data.detail, data.setup].filter(Boolean).join(" "));
        return;
      }

      setAnswer(data.answer ?? "Tidak ditemukan di SOP.");
      setSources(data.sources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Permintaan gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function ingest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (ingestText.trim().length < 80) {
      setIngestStatus("Teks SOP terlalu pendek.");
      return;
    }

    setIngesting(true);
    setIngestStatus("");

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teks: ingestText, source: ingestSource }),
      });
      const data = await response.json();

      if (!response.ok) {
        setIngestStatus([data.error, data.detail, data.setup].filter(Boolean).join(" "));
        return;
      }

      setIngestStatus(`${data.inserted} chunk SOP tersimpan.`);
      setIngestText("");
    } catch (err) {
      setIngestStatus(err instanceof Error ? err.message : "Ingest gagal.");
    } finally {
      setIngesting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div className="brand">
            <Image src="/logo_nexaid.svg" alt="NEXAID" width={36} height={36} priority />
            <div>
              <p className="eyebrow">NEXAID</p>
              <h1>Tanya SOP Bencana</h1>
            </div>
          </div>
          <div className="status-pill">RAG SOP resmi</div>
        </header>

        <div className="question-area">
          <form className="ask-panel" onSubmit={ask}>
            <label htmlFor="question">Pertanyaan operasional</label>
            <textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Contoh: prosedur distribusi logistik saat tanggap darurat?"
              rows={5}
            />
            <div className="ask-actions">
              <div className="example-row" aria-label="Contoh pertanyaan">
                {examples.map((item) => (
                  <button
                    type="button"
                    className="chip"
                    key={item}
                    onClick={() => setQuestion(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button className="primary-button" disabled={!canAsk}>
                {loading ? "Mencari SOP..." : "Tanya"}
              </button>
            </div>
          </form>

          <aside className="side-panel">
            <div className="metric">
              <span>Sumber</span>
              <strong>BNPB/BPBD</strong>
            </div>
            <div className="metric">
              <span>Jawaban</span>
              <strong>Dengan kutipan</strong>
            </div>
            <div className="metric">
              <span>Batasan</span>
              <strong>Hanya SOP</strong>
            </div>
          </aside>
        </div>

        {error && <div className="alert">{error}</div>}

        <section className="answer-panel" aria-live="polite">
          {loading ? (
            <div className="empty-state">Mencari potongan SOP yang paling relevan...</div>
          ) : answer ? (
            <>
              <div>
                <p className="eyebrow">Jawaban</p>
                <div className="answer-text">{answer}</div>
              </div>
              <div className="sources">
                <p className="eyebrow">Kutipan sumber</p>
                {sources.length > 0 ? (
                  <div className="source-grid">
                    {sources.map((source, index) => (
                      <article className="source-card" key={source.id}>
                        <div className="source-head">
                          <strong>
                            [{index + 1}] {source.source}
                          </strong>
                          {source.similarity !== null && (
                            <span>{Math.round(source.similarity * 100)}%</span>
                          )}
                        </div>
                        <p>{source.excerpt}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Tidak ada kutipan yang cocok.</p>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">Jawaban dan kutipan SOP akan tampil di sini.</div>
          )}
        </section>

        <details className="ingest-panel">
          <summary>Ingest teks SOP</summary>
          <form onSubmit={ingest}>
            <input
              value={ingestSource}
              onChange={(event) => setIngestSource(event.target.value)}
              placeholder="Nama dokumen"
            />
            <textarea
              value={ingestText}
              onChange={(event) => setIngestText(event.target.value)}
              placeholder="Tempel teks SOP resmi di sini"
              rows={6}
            />
            <div className="ingest-actions">
              <button className="secondary-button" disabled={ingesting}>
                {ingesting ? "Menyimpan..." : "Simpan ke RAG"}
              </button>
              {ingestStatus && <span>{ingestStatus}</span>}
            </div>
          </form>
        </details>
      </section>
    </main>
  );
}
