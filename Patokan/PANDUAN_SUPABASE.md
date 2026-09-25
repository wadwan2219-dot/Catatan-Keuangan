# 🚀 Panduan Setup Supabase untuk SaldoKu (Pemisahan 3 Aktor & PIN Keamanan)

Struktur database ini memisahkan data menjadi:
1. **Aktor Utama (Iwan & Wadda)**: Berbagi ruang data bersama (`group_id = 'group_default'`) dengan proteksi PIN 4-digit.
2. **Pengguna Umum**: Masing-masing memiliki catatan kas mandiri berdasarkan `user_id`.

---

## ⚡ Skrip SQL Pembuatan Tabel & Hak Akses

Buka SQL Editor Supabase Anda:
👉 **[https://supabase.com/dashboard/project/kurdvmvokdpewjhkdjwb/sql/new](https://supabase.com/dashboard/project/kurdvmvokdpewjhkdjwb/sql/new)**

Paste seluruh skrip berikut, lalu klik tombol hijau **Run**:

```sql
-- 1. TABEL PENGGUNA (USERS)
create table if not exists public.users (
  id text primary key,
  nama text not null,
  email text,
  role text default 'umum', -- 'partner' untuk Iwan & Wadda, 'umum' untuk user biasa
  created_at timestamptz default now()
);

-- 2. TABEL TABUNGAN KAS (PEMASUKAN)
create table if not exists public.tabungan (
  id text primary key,
  user_id text not null,
  group_id text default 'group_default', -- 'group_default' untuk Iwan & Wadda
  jumlah numeric not null,
  keterangan text,
  tanggal text not null,
  created_at timestamptz default now()
);

-- 3. TABEL BELANJA KAS (PENGELUARAN)
create table if not exists public.belanja (
  id text primary key,
  user_id text not null,
  group_id text default 'group_default', -- 'group_default' untuk Iwan & Wadda
  nama_item text not null,
  jumlah numeric not null,
  kategori text default 'Umum',
  tanggal text not null,
  created_at timestamptz default now()
);

-- 4. TABEL LEDGER HUTANG BERSIH (IWAN & WADDA)
create table if not exists public.debt_entries (
  id text primary key,
  group_id text default 'group_default',
  kind text not null, -- 'debt', 'payment', 'reversal'
  from_member_id text not null, -- 'iwan' atau 'wadda'
  to_member_id text not null,   -- 'iwan' atau 'wadda'
  amount numeric not null,
  note text,
  occurred_at text not null,
  reverses_entry_id text,
  original_delta numeric,
  created_by_uid text,
  created_by_name text,
  client_request_id text,
  created_at timestamptz default now()
);

-- 5. BUKA AKSES BACA & TULIS PENUH (ROW LEVEL SECURITY)
alter table public.users enable row level security;
alter table public.tabungan enable row level security;
alter table public.belanja enable row level security;
alter table public.debt_entries enable row level security;

create policy "Allow all on users" on public.users for all using (true) with check (true);
create policy "Allow all on tabungan" on public.tabungan for all using (true) with check (true);
create policy "Allow all on belanja" on public.belanja for all using (true) with check (true);
create policy "Allow all on debt_entries" on public.debt_entries for all using (true) with check (true);

-- 6. AKTIFKAN REALTIME SINKRONISASI
alter publication supabase_realtime add table public.tabungan, public.belanja, public.debt_entries;
```
