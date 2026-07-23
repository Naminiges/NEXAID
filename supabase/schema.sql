create extension if not exists vector;

create table if not exists public.sop_chunks (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'Dokumen SOP',
  chunk_index integer not null default 0,
  konten text not null,
  embedding vector(768) not null,
  created_at timestamptz not null default now()
);

create index if not exists sop_chunks_embedding_hnsw
  on public.sop_chunks
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_sop (
  query_embedding vector(768),
  match_count int default 5
) returns table (
  id uuid,
  konten text,
  source text,
  chunk_index integer,
  similarity float
)
language sql stable as $$
  select
    sop_chunks.id,
    sop_chunks.konten,
    sop_chunks.source,
    sop_chunks.chunk_index,
    1 - (sop_chunks.embedding <=> query_embedding) as similarity
  from public.sop_chunks
  order by sop_chunks.embedding <=> query_embedding
  limit match_count;
$$;
