# 📝 Daftar Tugas (Task List) & Panduan Google Cloud Shell Terminal

Dokumen ini memisahkan **Panduan Menjalankan via Cloud Shell Terminal**, **Tugas Manual Firebase**, dan **Tugas Otomatisasi Koding (Dikerjakan oleh AI Agent)**.

---

## ⚡ JAWABAN SINGKAT: Apakah Bisa Dijalankan di Cloud Shell Terminal Saja?

**SANGAT BISA!** 🚀
Google Cloud Shell menyediakan terminal Linux gratis berbasis web yang sudah dilengkapi dengan:
- `firebase-cli` & `gcloud` CLI
- `git`, `node`, `npm`, `python3`
- Fitur **Web Preview** (untuk membuka tampilan web langsung di browser dari Cloud Shell)

---

## 💻 Panduan Menjalankan SaldoKu di Cloud Shell Terminal

Berikut perintah-perintah CLI yang bisa Anda jalankan langsung di Cloud Shell Terminal:

### 1️⃣ Login & Inisialisasi Firebase via Terminal
```bash
# 1. Login ke Firebase CLI menggunakan akun Google Anda
firebase login --no-localhost

# 2. Lihat daftar proyek Firebase yang Anda miliki
firebase projects:list

# 3. Buat proyek Firebase baru langsung dari terminal (jika belum ada)
firebase projects:create saldoku-app-$(date +%s)
```

### 2️⃣ Menjalankan & Preview Aplikasi Web di Cloud Shell
```bash
# Masuk ke folder proyek
cd saldoku

# Jalankan lokal web server menggunakan Python atau Node.js
python3 -m http.server 8080
# ATAU jika menggunakan npx:
# npx serve -l 8080
```

> 🌐 **Cara Membuka Web Preview di Cloud Shell:**
> 1. Di pojok kanan atas Cloud Shell Terminal, klik ikon **Web Preview** (ikon kaca pembesar/layar dengan dua panah `[==]`).
> 2. Pilih **Preview on port 8080**.
> 3. Aplikasi **SaldoKu** akan terbuka langsung di tab baru browser Anda!

### 3️⃣ Deploy ke GitHub & GitHub Pages via Terminal
```bash
# Inisialisasi Git
git init
git add .
git commit -m "Initial commit SaldoKu app"

# Hubungkan ke repository GitHub Anda (ganti URL dengan repo Anda)
git remote add origin https://github.com/username-anda/saldoku.git
git branch -M main
git push -u origin main
```

---

## 📌 BAGIAN 1: Tugas Persiapan (Cloud Shell / Firebase Console)

Anda bisa memilih cara persiapannya:

| Komponen | Via Firebase Console (UI Web) | Via Cloud Shell Terminal (CLI) |
|---|---|---|
| **Firebase Project** | Click "Add Project" di console.firebase.google.com | `firebase projects:create` |
| **Authentication** | Menu Build ➔ Authentication ➔ Enable Email/Password | Diaktifkan di Console / `firebase target` |
| **Firestore Database**| Menu Build ➔ Firestore ➔ Create Database | `firebase init firestore` |
| **Web Config API Key**| Settings ⚙️ ➔ Register Web App `</>` | Copypaste `firebaseConfig` ke `js/firebase-config.js` |

---

## 💻 BAGIAN 2: Tugas Pengembangan Kode (Dikerjakan oleh AI Agent)

Berikut adalah tahapan pembuatan aplikasi web `SaldoKu` yang akan dibuat secara otomatis:

### 🚀 Tahap 1: Foundation & Styling System
- [ ] Create `css/style.css` (Glassmorphic theme, typography, custom scrollbars, animations).
- [ ] Create `js/firebase-config.js` (Firebase v10 initialization + LocalStorage fallback driver).
- [ ] Create `js/common.js` (Format Rupiah, date utils, Toast notifications, session guard).

### 🔑 Tahap 2: Authentication & Auth Guard (`index.html`)
- [ ] Build `index.html` (Form Login & Register dengan tab switcher).
- [ ] Create `js/auth.js` (Firebase Auth login, register, logout, serta mode demo instan).

### 📊 Tahap 3: Dashboard Utama (`dashboard.html`)
- [ ] Build `dashboard.html` (Widget Saldo Saat Ini, Total Tabungan, Total Belanja, Quick Action buttons).
- [ ] Create `js/dashboard.js` (Kalkulasi otomatis $Saldo = Tabungan - Belanja$ & 5 transaksi terbaru).

### 💰 Tahap 4: Halaman Input Tabungan (`tabungan.html`)
- [ ] Build `tabungan.html` (Form input nominal, preset tombol cepat +100rb, +250rb, +500rb, +1jt).
- [ ] Create `js/tabungan.js` (Simpan data ke collection `tabungan` + toast feedback).

### 🛒 Tahap 5: Halaman Input Belanja (`belanja.html`)
- [ ] Build `belanja.html` (Form input barang, nominal, kategori & peringatan saldo kurang).
- [ ] Create `js/belanja.js` (Cek saldo real-time, simpan ke collection `belanja` + warning alert ⚠️).

### 📝 Tahap 6: Halaman Riwayat Transaksi (`riwayat.html`)
- [ ] Build `riwayat.html` (Tabel rekap transaksi, badge warna hijau/merah).
- [ ] Create `js/riwayat.js` (Filter tipe transaksi, pencarian nama, hapus transaksi, export ke CSV).

### 📖 Tahap 7: Dokumentasi & Testing
- [ ] Create `README.md` (Panduan lengkap aplikasi & deployment).
- [ ] Testing alur secara menyeluruh.
