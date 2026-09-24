# 💳 SaldoKu - Aplikasi Manajemen Keuangan Sederhana

Aplikasi web manajemen keuangan pribadi/bersama berbasis **HTML5**, **Tailwind CSS**, **JavaScript**, dan **Firebase** (Authentication & Cloud Firestore) dengan kalkulasi sisa saldo otomatis. Siap di-host secara gratis di **GitHub Pages** dan dijalankan via **Google Cloud Shell Terminal**.

---

## 📋 Alur Sistem & Kalkulasi Saldo

1. **Input Tabungan**: User mencatat saldo/uang tabungan awal atau pemasukan berkala.
2. **Tambah Belanja**: User mencatat item & nominal belanja/pengeluaran harian.
3. **Pengurangan Kas Otomatis**:
   $$\text{Saldo Akhir Kas} = \text{Total Tabungan} - \text{Total Belanja}$$
4. **Peringatan Saldo Menipis**: Peringatan otomatis ⚠️ jika total pengeluaran belanja melebihi sisa saldo kas yang tersedia.
5. **Hutang Bersih (Iwan ⇄ Wadda)**: Pencatatan kewajiban hutang dan pembayaran antaranggota dengan netting dua arah otomatis:
   - Nilai positif (+): Iwan berhutang kepada Wadda
   - Nilai negatif (-): Wadda berhutang kepada Iwan
   - Nilai nol (0): Lunas / Seimbang
   - **Terpisah 100% dari Kas Bersama**: Pencatatan hutang tidak mempengaruhi saldo tabungan maupun belanja.
   - **Append-Only Ledger**: Tidak ada hard delete; koreksi transaksi dilakukan via pembatalan (*reversal*).

---

## 🗂️ Struktur Berkas Proyek

```
📁 saldoku/
│
├── 📄 index.html          → Halaman Login, Register & Akses Demo Instan (Iwan & Wadda)
├── 📄 dashboard.html      → Halaman Utama (Ringkasan Saldo, Hutang Bersih & Shortcut)
├── 📄 tabungan.html       → Form Input Tabungan & Preset Nominal Cepat
├── 📄 belanja.html        → Form Input Belanja & Warning Alert Saldo Kurang
├── 📄 hutang.html         → Form Input Hutang/Bayar, Status Netting & Riwayat Ledger
├── 📄 riwayat.html        → Rekap Riwayat Transaksi (Kas & Hutang), Filter & Export CSV
│
├── 📁 css/
│   └── style.css          → Modern Dark Glassmorphic Styling, Accessibility & Modal
│
├── 📁 js/
│   ├── firebase-config.js → Initialisasi Firebase (Project: saldoku-app)
│   ├── common.js          → Format Rupiah, Toast Alerts, Auth Guard & Storage Driver
│   ├── auth.js            → Logic Auth Login, Register & Mode Demo (Iwan & Wadda)
│   ├── debt-engine.js     → Pure Math/Logic Engine Netting Dua Arah & Validasi
│   ├── debt-service.js    → Data Layer Firestore Zero-Config & LocalStorage Driver
│   ├── dashboard.js       → Metrics Saldo Realtime, Ringkasan Hutang & Transaksi Terbaru
│   ├── tabungan.js        → Logic Tambah Tabungan
│   ├── belanja.js         → Logic Tambah Belanja
│   ├── hutang.js          → Controller Halaman Hutang, Simulasi & Reversal Modal
│   └── riwayat.js         → Unified Riwayat View Model (Kas + Hutang) & Export CSV
│
├── 📄 firestore.rules     → Aturan Keamanan Firebase Cloud Firestore Siap Pakai
├── 📄 TASK_LIST.md        → Check-list Langkah Manual vs Otomatis
├── 📄 PLAN.md             → Dokumentasi Rencana Awal Proyek
├── 📄 PLAN_FITUR_HUTANG.md→ Spesifikasi & Panduan Desain Fitur Hutang Bersih
└── 📄 README.md           → Dokumentasi Lengkap Proyek
```

---

## ⚡ Cara Menjalankan di Google Cloud Shell Terminal

### 1️⃣ Jalankan Web Server di Cloud Shell Terminal
```bash
# Pindah ke direktori proyek
cd saldoku

# Jalankan server lokal di port 8080
python3 -m http.server 8080
```

### 2️⃣ Buka Web Preview di Browser
1. Klik ikon **Web Preview** (`[==]`) di sudut kanan atas Google Cloud Shell.
2. Pilih **Preview on port 8080**.
3. Web **SaldoKu** akan terbuka dan siap digunakan!

---

## 🛠️ Konfigurasi Firebase (`saldoku-app`)

Proyek ini telah dikonfigurasi untuk proyek Firebase `saldoku-app`. Jika Anda ingin menautkan kredensial resmi Firebase Anda:
1. Buka [Firebase Console](https://console.firebase.google.com/).
2. Masuk ke **Project Settings ⚙️** ➔ **Your Apps** ➔ Web `</>`.
3. Salin kunci konfigurasi dan perbarui di [js/firebase-config.js](file:///c:/Users/ACER%20ID/Documents/IWAN/Projek/Cataan%20Keungan/js/firebase-config.js):

```javascript
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "saldoku-app.firebaseapp.com",
  projectId: "saldoku-app",
  storageBucket: "saldoku-app.appspot.com",
  messagingSenderId: "915322861447",
  appId: "YOUR_APP_ID"
};
```

---

## 🚀 Panduan Hosting di GitHub Pages

1. Push seluruh kode proyek ke repository GitHub Anda:
   ```bash
   git init
   git add .
   git commit -m "Deploy SaldoKu app"
   git remote add origin https://github.com/username-anda/saldoku.git
   git branch -M main
   git push -u origin main
   ```
2. Di GitHub, buka **Settings** ➔ **Pages**.
3. Di bagian *Build and deployment*, pilih Branch: `main` dan folder `/ (root)`, lalu klik **Save**.
4. Website Anda siap diakses secara publik dan gratis! 🎉
