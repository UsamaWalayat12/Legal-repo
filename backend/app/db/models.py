# Supabase tables are defined via SQL migrations.
# Run the SQL below in your Supabase SQL editor.

"""
-- workspaces table (new)
create table workspaces (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  name text not null,
  created_at timestamptz default now()
);
create index on workspaces(user_id);

-- documents table (user_id column added)
create table documents (
  id uuid default gen_random_uuid() primary key,
  file_name text not null,
  doc_type text not null default 'other',
  upload_date timestamptz default now(),
  page_count int default 0,
  status text default 'processing',
  workspace_id text default 'default',
  user_id uuid,
  error_message text
);
create index on documents(user_id);
create index on documents(workspace_id);

-- chunks table (unchanged)
create table chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references documents(id) on delete cascade,
  chunk_index int not null,
  page_number int not null,
  text text not null,
  token_count int
);
"""
