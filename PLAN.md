# Rencana Implementasi Proyek SaldoKu (Aplikasi Manajemen Keuangan Sederhana)

Web aplikasi manajemen keuangan pribadi/bersama ("SaldoKu") berbasis HTML, Tailwind CSS, JavaScript, Firebase Firestore & Authentication, yang siap di-host di GitHub Pages.

---

## 📋 Alur Sistem & Fitur Utama

1. **Step 1 — Input Tabungan**: User memasukkan saldo/uang tabungan awal yang dimiliki.
2. **Step 2 — Tambah Belanja**: User menambahkan item belanja/pengeluaran.
3. **Step 3 — Pengurangan Otomatis**: 
   $$\text{Saldo Akhir} = \text{Total Tabungan} - \text{Total Belanja}$$
4. **Step 4 — Riwayat Transaksi**: Rekap semua transaksi dengan indikator warna (Hijau untuk Tabungan, Merah untuk Belanja) serta filter dan pencarian.

---

## 🗂️ Struktur File Proyek

```
📁 Cataan Keungan / saldoku/
│
├── 📄 index.html          → Halaman Login / Register & Akses Demo
├── 📄 dashboard.html      → Halaman Utama setelah login (Overview Saldo)
├── 📄 tabungan.html       → Halaman Input Tabungan / Pemasukan
├── 📄 belanja.html        → Halaman Input Belanja / Pengeluaran
├── 📄 riwayat.html        → Halaman Riwayat Transaksi & Filter
│
├── 📁 css/
│   └── style.css          → Custom styling (Glassmorphism, Animasi, Visual badging)
│
├── 📁 js/
│   ├── firebase-config.js → Konfigurasi Firebase (Auth & Firestore)
│   ├── common.js          → Helper (Rupiah Formatter, Storage Driver Hybrid, Toast Alert)
│   ├── auth.js            → Logic Login, Register, Demo Mode & Session Guard
│   ├── dashboard.js       → Logic Dashboard & Kalkulasi Saldo Otomatis
│   ├── tabungan.js        → Logic Input Tabungan & Simpan
│   ├── belanja.js         → Logic Input Belanja & Peringatan Saldo Kurang
│   └── riwayat.js         → Logic Filter, Hapus Transaksi & Export CSV
│
├── 📄 PLAN.md             → Dokumentasi Rencana Proyek
└── 📄 README.md           → Dokumentasi & Panduan Setup Firebase & GitHub Pages
```

---

## 🗂️ Struktur Database (Firebase Firestore & Fallback LocalStorage)

### Collection `users`
```json
{
  "uid": "user_id_123",
  "nama": "Budi",
  "email": "budi@gmail.com",
  "createdAt": "2026-08-09T14:18:40Z"
}
```

### Collection `tabungan`
```json
{
  "id": "tab_001",
  "user_id": "user_id_123",
  "jumlah": 1000000,
  "keterangan": "Gaji bulan ini",
  "tanggal": "2026-08-09"
}
```

### Collection `belanja`
```json
{
  "id": "bel_001",
  "user_id": "user_id_123",
  "nama_item": "Beli beras",
  "jumlah": 150000,
  "kategori": "Belanja Harian",
  "tanggal": "2026-08-09"
}
```

---

## 🛠️ Fitur Per Halaman

### 1. Halaman Login / Register (`index.html`)
- Form Login (Email & Password).
- Form Register (Nama Lengkap, Email & Password).
- Tombol "Masuk Mode Demo" untuk uji coba instant tanpa daftar.
- Modal / Panel Pengaturan Firebase API Key.

### 2. Dashboard Utama (`dashboard.html`)
- Header Selamat Datang & Profil User.
- 3 Widget Saldo Utama:
  - 💰 **Saldo Saat Ini** (Badge Highlight)
  - 📈 **Total Tabungan** (Hijau)
  - 📉 **Total Belanja** (Merah)
- Tombol Aksi Cepat (Tambah Tabungan, Tambah Belanja, Lihat Riwayat).
- Tabel 5 Transaksi Terakhir.

### 3. Halaman Tabungan (`tabungan.html`)
- Form Input Nominal Tabungan (Auto format Rp).
- Preset nominal cepat (+100rb, +250rb, +500rb, +1jt).
- Input Keterangan / Sumber Dana.
- Preview Saldo Baru secara Real-time.

### 4. Halaman Belanja (`belanja.html`)
- Form Input Nama Barang / Keperluan.
- Form Input Nominal Belanja (Auto format Rp).
- Kategori Selector (Makanan, Transportasi, Tagihan, Belanja, Hiburan, Lainnya).
- Peringatan Otomatis ⚠️ jika Belanja > Saldo Saat Ini.

### 5. Halaman Riwayat (`riwayat.html`)
- List lengkap semua transaksi (Tabungan & Belanja).
- Filter transaksi (Semua, Tabungan Masuk, Belanja Keluar).
- Fitur Pencarian berdasarkan nama item / keterangan.
- Fitur Hapus Transaksi (otomatis menghitung ulang sisa saldo).
- Fitur Export Rekap ke file CSV.

---

## 🚀 Panduan Hosting GitHub Pages
Aplikasi dibangun full client-side statis (HTML+CSS+JS) sehingga 100% kompatibel dan gratis di-host melalui GitHub Pages.
