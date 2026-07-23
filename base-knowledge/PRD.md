# PRD

<aside>
📋

**PRD ringkas** untuk proyek **NEXAID** — chatbot yang menjawab pertanyaan operasional **hanya berdasarkan dokumen SOP resmi (BNPB/BPBD)** dengan kutipan sumber. Stack: Next.js + Supabase + Vercel. Dokumen ini melengkapi spec teknis di halaman *Tanya SOP Bencana — RAG*.

</aside>

| Info | Detail |
| --- | --- |
| **Produk** | NEXAID |
| **Versi** | 1.0 (MVP) |
| **Tanggal** | 23 Juli 2026 |
| **Stack** | Next.js 15 • Supabase (pgvector) • Vercel • Gemini (gratis) |
| **Target** | MVP live ~1 jam, biaya Rp 0 |

---

## 1. Landasan Masalah

### 1.1 Konteks

Saat tanggap darurat bencana, SOP resmi (BNPB/BPBD) adalah acuan wajib: bagaimana mendistribusikan air bersih, mengelola pengungsian, menangani korban, koordinasi posko, dsb. Namun SOP ini biasanya berupa **dokumen PDF puluhan–ratusan halaman** yang tersebar dan sulit dibuka cepat di lapangan.

### 1.2 Masalah inti

<aside>
🔥

Relawan & koordinator **tidak punya waktu membaca dokumen SOP yang panjang** saat situasi genting. Akibatnya keputusan diambil berdasarkan ingatan/asumsi — berisiko keliru, tidak sesuai prosedur resmi, dan tidak konsisten antar-tim.

</aside>

### 1.3 Rincian pain point

| # | Pain Point | Dampak |
| --- | --- | --- |
| 1 | **SOP panjang & sulit dicari** | Butuh menit–jam untuk menemukan 1 prosedur; tidak realistis saat darurat |
| 2 | **Jawaban tidak terstandar** | Tiap orang menjawab beda dari ingatan → tindakan tidak seragam |
| 3 | **Risiko halusinasi kalau pakai ChatGPT biasa** | LLM umum bisa mengarang prosedur yang tidak ada di SOP resmi |
| 4 | **Tidak ada jejak sumber** | Keputusan sulit dipertanggungjawabkan karena tidak jelas dasar SOP-nya |

### 1.4 Kenapa RAG (bukan chatbot biasa)

- **Grounding**: jawaban dikunci hanya pada isi SOP yang diunggah → minim halusinasi.
- **Kutipan sumber**: setiap jawaban menampilkan potongan SOP asli → bisa diverifikasi & dipertanggungjawabkan.
- **Selalu update**: cukup ganti dokumen SOP, tanpa melatih ulang model.

---

## 2. User Spesifik & Persona

### 2.1 Target pengguna

| Pengguna | Kebutuhan utama |
| --- | --- |
| **Relawan lapangan** | Jawaban cepat & praktis atas "prosedur X bagaimana?" langsung dari HP |
| **Koordinator posko** | Memastikan tindakan tim sesuai SOP resmi; rujukan cepat saat rapat kilat |
| **Petugas BPBD / SATGAS** | Referensi standar yang konsisten & dapat diverifikasi sumbernya |
| **Anggota baru / non-ahli** | Onboarding cepat tanpa harus hafal seluruh SOP |

### 2.2 Persona utama

<aside>
👩

**Sabrina, 22 th — Relawan Pengumpul Data Lapangan**

</aside>

| Aspek | Detail |
| --- | --- |
| **Situasi** | Di posko, sinyal pas-pasan, harus ambil keputusan cepat soal distribusi & penanganan |
| **Tujuan** | Tahu "prosedur resmi yang benar" dalam hitungan detik, tanpa buka PDF panjang |
| **Frustrasi** | "SOP-nya ada, tapi 80 halaman. Aku nggak sempat baca pas lagi genting." |
| **Yang dia butuh** | Ketik pertanyaan singkat → dapat jawaban ringkas + kutipan SOP-nya |
| **Ekspektasi sukses** | Yakin tindakannya sesuai SOP karena ada sumber yang bisa ditunjukkan |

<aside>
🧑‍💻

**Pak Budi, 40 th — Koordinator Posko** (persona sekunder): butuh memutuskan cepat & memastikan seluruh tim bertindak seragam sesuai SOP; menggunakan jawaban ber-kutipan sebagai dasar instruksi ke relawan.

</aside>

### 2.3 User Story

- Sebagai **relawan**, saya ingin **mengetik pertanyaan singkat tentang prosedur** agar **langsung dapat jawaban ringkas dari SOP tanpa membaca seluruh dokumen**.
- Sebagai **relawan**, saya ingin **melihat kutipan SOP asli di bawah jawaban** agar **saya yakin jawabannya benar dan bisa saya tunjukkan ke tim**.
- Sebagai **koordinator**, saya ingin **jawaban yang konsisten & bersumber** agar **instruksi ke tim seragam dan dapat dipertanggungjawabkan**.
- Sebagai **admin**, saya ingin **mengganti/menambah dokumen SOP dengan mudah** agar **sistem selalu memakai versi terbaru**.

---

## 3. Tujuan & Metrik Keberhasilan

| Tujuan | Metrik |
| --- | --- |
| Jawaban cepat | Waktu tanya→jawab < 5 detik |
| Anti-halusinasi | Jawaban di luar SOP dijawab "Tidak ditemukan di SOP" |
| Dapat diverifikasi | 100% jawaban menyertakan kutipan sumber |
| Mudah diakses | Berjalan di HP (browser), tanpa instalasi |
| Hemat | Biaya operasional Rp 0 (free-tier) |

---

## 4. Ruang Lingkup (Scope)

**In-scope (MVP):**

- Halaman tanya-jawab tunggal.
- Ingest teks SOP → embedding → pgvector.
- Retrieval + jawaban ber-grounding + tampilan kutipan sumber.

**Out-of-scope (MVP):**

- Autentikasi/login, manajemen peran.
- Koordinasi anggota / papan tugas.
- Upload PDF otomatis (MVP cukup tempel teks).
- Peta, notifikasi, riwayat percakapan.

---

## 5. Langkah-Langkah Pengerjaan

### Tahap 0 — Persiapan (5 mnt)

1. Siapkan akun: GitHub, Vercel, Supabase, Google AI Studio (API key Gemini gratis).

### Tahap 1 — Scaffold & Deploy Kosong (10 mnt)

1. `npx create-next-app@latest` (App Router, TypeScript).
2. Push ke GitHub → import ke Vercel → pastikan deploy kosong berhasil (pipeline hijau).

### Tahap 2 — Database (10 mnt)

1. Buat project Supabase.
2. Jalankan SQL: `create extension vector` + tabel `sop_chunks` + fungsi `match_sop` (lihat spec teknis).

### Tahap 3 — Backend RAG (15 mnt)

1. `npm i ai @ai-sdk/google @supabase/supabase-js`.
2. Buat `/api/ingest` (chunk + embed + simpan).
3. Buat `/api/ask` (embed pertanyaan → `match_sop` → jawab dengan Gemini).

### Tahap 4 — Frontend (10 mnt)

1. Buat `app/page.tsx`: input pertanyaan, tombol Tanya, tampil jawaban + kutipan.

### Tahap 5 — Isi Data & Uji (5 mnt)

1. POST ke `/api/ingest` dengan 2–3 halaman teks SOP.
2. Uji beberapa pertanyaan; cek jawaban & kutipan.

### Tahap 6 — Deploy Final (5 mnt)

1. Set env di Vercel (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`).
2. Deploy → tes di URL production.

---

## 6. Risiko & Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Jawaban tetap mengarang | Prompt tegas "hanya dari konteks" + tampilkan kutipan |
| Retrieval kurang relevan | Naikkan `match_count`, perbaiki ukuran chunk |
| Kuota Gemini habis | Fallback ke Groq/Llama (tukar via env) |
| Supabase free-tier idle-pause | Login berkala / cron ping ringan |

---

<aside>
🔗

Spec teknis lengkap (SQL, kode `ingest`/`ask`/`page.tsx`, env) ada di halaman **Tanya SOP Bencana — RAG (Next.js + Supabase + Vercel)**. Task tracker ada di bawah ↓

</aside>

[Task Tracker — Tanya SOP Bencana](Task%20Tracker%20%E2%80%94%20Tanya%20SOP%20Bencana%2026616d5ba11a4100b1820fb3e6f55570.csv)