# Rencana Pengembangan Fitur Hutang Bersih

Dokumen ini menjadi acuan implementasi fitur hutang untuk aplikasi **Catatan
Keuangan** yang dipakai oleh dua orang. Fokus utamanya adalah perhitungan hutang
bersih otomatis, integrasi yang aman dengan saldo bersama, sinkronisasi
Firebase, dan tampilan minimal yang tidak terasa seperti “AI slop”.

> Catatan audit: rencana ini disusun dari struktur folder yang tersedia. Sebelum
> menulis kode, pengembang tetap harus membaca implementasi HTML, JavaScript,
> skema Firestore, dan aturan keamanan yang sedang digunakan. Jangan menebak
> nama koleksi, struktur sesi, atau ID elemen yang belum diverifikasi.

## 1. Keputusan arsitektur

1. **Hutang dipisahkan dari kas bersama.**
   - Tabungan dan belanja tetap menentukan saldo kas bersama.
   - Pencatatan hutang hanya menentukan posisi kewajiban antara Iwan dan Wadda.
   - Mencatat hutang tidak boleh menaikkan atau menurunkan saldo tabungan.

2. **Gunakan ledger berbasis kejadian, bukan hanya satu angka saldo hutang.**
   - Setiap hutang, pembayaran, dan pembatalan disimpan sebagai entri.
   - Posisi hutang bersih dihitung dari seluruh entri aktif.
   - Riwayat tetap dapat diaudit dan perubahan dari dua perangkat tidak saling
     menimpa.

3. **Gunakan netting dua arah.**
   - Nilai positif berarti Iwan berhutang kepada Wadda.
   - Nilai negatif berarti Wadda berhutang kepada Iwan.
   - Nilai nol berarti tidak ada hutang bersih.

4. **Gunakan satu ruang data bersama (`groupId`).**
   - Kedua akun harus membaca ledger kelompok yang sama.
   - Jangan menyimpan data bersama hanya di jalur UID masing-masing pengguna.

5. **Nominal selalu berupa bilangan bulat Rupiah.**
   - Jangan memakai nilai pecahan atau floating point.
   - Nilai yang disimpan adalah `10000`, bukan string `"10.000"`.

## 2. Interpretasi kebutuhan

Aplikasi digunakan oleh dua anggota:

- Iwan
- Wadda

Saat pengguna memilih satu orang sebagai pihak yang berhutang, pihak lainnya
otomatis menjadi pemberi hutang. Untuk MVP, pengguna tidak perlu memilih
kreditur secara terpisah karena hanya ada dua anggota.

Contoh yang wajib didukung:

| Urutan | Input                   | Perubahan net | Hasil                                |
| ------ | ----------------------- | ------------: | ------------------------------------ |
| 1      | Iwan berhutang Rp10.000 |       +10.000 | Iwan berhutang Rp10.000 kepada Wadda |
| 2      | Wadda berhutang Rp7.000 |        -7.000 | Iwan berhutang Rp3.000 kepada Wadda  |
| 3      | Wadda berhutang Rp3.000 |        -3.000 | Hutang bersih lunas/seimbang         |

Netting hanya menyederhanakan posisi akhir. Semua entri asli tetap tampil di
riwayat.

## 3. Analisis struktur proyek saat ini

### Bagian yang sudah mendukung pengembangan

- Pemisahan halaman berdasarkan domain sudah jelas: dashboard, tabungan,
  belanja, dan riwayat.
- `common.js` sudah menjadi tempat fungsi bersama, session guard, listener
  realtime, format Rupiah, dan perhitungan saldo.
- Firebase v10 Compat memungkinkan fitur baru ditambahkan tanpa migrasi besar ke
  ES Module.
- `riwayat.js` sudah memiliki pola filter, penghapusan, dan ekspor CSV yang bisa
  dijadikan referensi.

### Risiko yang harus diperiksa sebelum implementasi

- Belum terlihat apakah data disimpan per pengguna atau per kelompok dua
  anggota.
- Belum terlihat apakah fallback registry lokal ikut menulis ke Firestore.
  Fallback lokal tidak boleh dianggap sebagai lapisan keamanan cloud.
- `common.js` berisiko menjadi terlalu besar bila semua logika hutang dimasukkan
  ke sana.
- Kalkulasi saldo saat ini mungkin menjumlahkan semua tipe transaksi. Entri
  hutang tidak boleh ikut dihitung sebagai kas.
- Penghapusan langsung pada riwayat keuangan menghilangkan jejak audit. Untuk
  hutang, gunakan pembatalan/reversal.
- Gaya glassmorphism yang berlebihan dapat membuat antarmuka penuh blur, glow,
  kartu, dan animasi yang tidak perlu.

## 4. Ruang lingkup MVP

### Termasuk

- Halaman baru `hutang.html`.
- Form tambah hutang.
- Pilihan pihak yang berhutang: Iwan atau Wadda.
- Nominal, tanggal kejadian, dan catatan opsional.
- Ringkasan posisi hutang bersih secara realtime.
- Riwayat ledger hutang.
- Pencatatan pembayaran hutang.
- Pembatalan entri melalui reversal, bukan hard delete.
- Ringkasan hutang pada dashboard.
- Filter hutang pada halaman riwayat.
- Ekspor CSV yang membedakan transaksi kas dan entri hutang.
- Validasi input, pencegahan submit ganda, empty state, loading state, dan error
  state.
- Aturan akses Firestore untuk dua anggota kelompok.
- Tampilan responsif untuk mobile dan desktop.

### Tidak termasuk dalam MVP

- Bunga, cicilan otomatis, denda, atau jatuh tempo berulang.
- Lebih dari dua anggota.
- Hutang kepada pihak eksternal.
- Mata uang selain Rupiah.
- Transfer bank otomatis.
- Rekonsiliasi saldo bank.
- Notifikasi push.

Fitur tersebut dapat dibuat pada fase berikutnya tanpa mengubah ledger dasar.

## 5. Struktur proyek setelah pengembangan

```text
Catatan Keuangan/
├── index.html
├── dashboard.html               # diperbarui: ringkasan hutang + navigasi
├── tabungan.html                # diperbarui: navigasi
├── belanja.html                 # diperbarui: navigasi
├── riwayat.html                 # diperbarui: filter/kolom domain hutang
├── hutang.html                  # baru: posisi, form, dan ledger hutang
│
├── css/
│   └── style.css                # diperbarui: token dan komponen minimal
│
├── js/
│   ├── firebase-config.js
│   ├── common.js                # fungsi kelompok/sesi bersama; jangan isi aturan domain hutang
│   ├── auth.js
│   ├── debt-engine.js           # baru: kalkulasi murni, validasi, deskripsi posisi
│   ├── debt-service.js          # baru: akses Firestore dan realtime listener
│   ├── dashboard.js             # diperbarui: subscribe ringkasan hutang
│   ├── tabungan.js
│   ├── belanja.js
│   ├── riwayat.js               # diperbarui: gabungkan view model kas + hutang
│   └── hutang.js                # baru: controller halaman hutang
│
├── firestore.rules              # ditambah/diperbarui bila rules disimpan di repo
├── PLAN.md
├── PLAN_FITUR_HUTANG.md
├── TASK_LIST.md
└── README.md
```

### Urutan script pada halaman yang memakai fitur hutang

Pertahankan Firebase Compat dan muat script sesuai dependensi:

```html
<script src="js/firebase-config.js"></script>
<script src="js/common.js"></script>
<script src="js/debt-engine.js"></script>
<script src="js/debt-service.js"></script>
<script src="js/hutang.js"></script>
```

Untuk `dashboard.html`, script terakhir tetap `dashboard.js`. Untuk
`riwayat.html`, script terakhir tetap `riwayat.js`.

Jangan memigrasikan seluruh proyek ke ES Module bersamaan dengan fitur ini.
Migrasi build system adalah pekerjaan terpisah dan menambah risiko regresi.

## 6. Model data Firestore

Gunakan jalur kelompok agar dua akun melihat data yang sama:

```text
groups/{groupId}
groups/{groupId}/debtEntries/{entryId}
```

Contoh dokumen kelompok:

```js
{
  name: "Tabungan Iwan & Wadda",
  memberUids: ["uid-iwan", "uid-wadda"],
  members: [
    { id: "iwan", name: "Iwan", uid: "uid-iwan" },
    { id: "wadda", name: "Wadda", uid: "uid-wadda" }
  ],
  createdAt: Timestamp
}
```

Contoh entri hutang baru:

```js
{
  schemaVersion: 1,
  kind: "debt",
  fromMemberId: "iwan",
  toMemberId: "wadda",
  amount: 10000,
  note: "Makan siang",
  occurredAt: Timestamp,
  createdAt: serverTimestamp(),
  createdByUid: "uid-pembuat",
  clientRequestId: "uuid-unik"
}
```

Contoh pembayaran:

```js
{
  schemaVersion: 1,
  kind: "payment",
  fromMemberId: "iwan",
  toMemberId: "wadda",
  amount: 3000,
  note: "Bayar sebagian",
  occurredAt: Timestamp,
  createdAt: serverTimestamp(),
  createdByUid: "uid-pembuat",
  clientRequestId: "uuid-unik"
}
```

Contoh pembatalan/reversal:

```js
{
  schemaVersion: 1,
  kind: "reversal",
  reversesEntryId: "id-entri-asli",
  amount: 10000,
  originalDelta: 10000,
  note: "Salah nominal",
  occurredAt: Timestamp,
  createdAt: serverTimestamp(),
  createdByUid: "uid-pembuat"
}
```

### Ketentuan data

- `amount` harus integer, lebih besar dari nol, dan memiliki batas maksimum yang
  masuk akal, misalnya Rp1.000.000.000.
- `fromMemberId` dan `toMemberId` harus berbeda serta terdaftar di kelompok.
- `note` opsional, dipangkas, dan dibatasi, misalnya 120 karakter.
- `occurredAt` adalah waktu kejadian yang dipilih pengguna.
- `createdAt` selalu berasal dari server.
- `createdByUid` selalu berasal dari akun aktif, bukan input form.
- `clientRequestId` digunakan untuk mencegah duplikasi saat koneksi lambat atau
  tombol tersubmit dua kali.
- Jangan menyimpan `netDebt` sebagai sumber kebenaran. Hitung dari ledger. Cache
  ringkasan hanya boleh ditambahkan jika kelak ada masalah performa.

## 7. Aturan kalkulasi

Tetapkan urutan anggota secara permanen:

```text
memberA = Iwan
memberB = Wadda
```

Definisi `netDebt`:

```text
netDebt > 0  -> Iwan berhutang kepada Wadda
netDebt < 0  -> Wadda berhutang kepada Iwan
netDebt = 0  -> tidak ada hutang bersih
```

### Konversi entri menjadi delta

| Jenis      | Arah           |            Delta |
| ---------- | -------------- | ---------------: |
| `debt`     | Iwan → Wadda   |        `+amount` |
| `debt`     | Wadda → Iwan   |        `-amount` |
| `payment`  | Iwan → Wadda   |        `-amount` |
| `payment`  | Wadda → Iwan   |        `+amount` |
| `reversal` | entri mana pun | `-originalDelta` |

Rumus:

```js
netDebt = entries.reduce((total, entry) => {
  return total + DebtEngine.toSignedDelta(entry, memberAId);
}, 0);
```

Teks hasil:

```js
if (netDebt > 0) {
  return `Iwan berhutang ${formatRupiah(netDebt)} kepada Wadda`;
}

if (netDebt < 0) {
  return `Wadda berhutang ${formatRupiah(Math.abs(netDebt))} kepada Iwan`;
}

return "Tidak ada hutang bersih";
```

### API internal yang direkomendasikan

`debt-engine.js` tidak boleh membaca DOM atau Firebase. Buat fungsi murni:

```js
window.DebtEngine = {
  validateEntry,
  toSignedDelta,
  calculateNet,
  describePosition,
  getCounterparty,
};
```

`debt-service.js` menangani penyimpanan:

```js
window.DebtService = {
  subscribeEntries,
  createDebt,
  createPayment,
  reverseEntry,
};
```

Pemisahan ini membuat kalkulasi mudah diuji tanpa browser dan mencegah
`common.js` menjadi god file.

## 8. Alur halaman `hutang.html`

### Susunan konten

1. **Header halaman**
   - Judul: “Hutang”
   - Deskripsi satu baris: “Catat kewajiban antara Iwan dan Wadda.”

2. **Ringkasan utama**
   - Label kecil: “Posisi saat ini”
   - Teks utama, misalnya “Iwan berhutang Rp3.000 kepada Wadda”.
   - Subteks: “Dihitung otomatis dari seluruh entri aktif.”
   - Jika nol: “Tidak ada hutang bersih”.

3. **Form pencatatan**
   - Jenis: `Hutang baru` atau `Pembayaran`.
   - Pihak: Iwan atau Wadda.
   - Nominal Rupiah.
   - Tanggal.
   - Catatan opsional.
   - Tombol utama: “Simpan entri”.

4. **Riwayat hutang**
   - Filter: Semua, Hutang, Pembayaran, Pembatalan.
   - Pencarian catatan.
   - Baris menampilkan jenis, arah, nominal, tanggal, pembuat, dan status.
   - Aksi sekunder: “Batalkan entri”.

### Perilaku form

- Kreditur/penerima otomatis ditentukan dari pihak yang dipilih.
- Format nominal boleh membantu saat mengetik, tetapi nilai tersimpan harus
  integer.
- Tombol dinonaktifkan selama penyimpanan.
- Tampilkan error di dekat field terkait, bukan hanya alert umum.
- Setelah sukses: reset nominal dan catatan, tetapi pertahankan tanggal hari
  ini.
- Jangan memakai `confirm()` bawaan browser untuk pembatalan. Gunakan dialog
  kecil yang konsisten dan fokusnya dapat diakses keyboard.
- Pembayaran yang melebihi posisi hutang harus memunculkan konfirmasi karena
  dapat membalik pihak yang berhutang.

## 9. Integrasi dengan halaman lain

### `dashboard.html` dan `dashboard.js`

Tambahkan satu ringkasan, bukan kumpulan kartu baru:

- Judul: “Hutang bersih”.
- Nilai: teks posisi saat ini.
- Tautan teks: “Lihat rincian”.
- Update realtime dari `DebtService.subscribeEntries()`.
- Jika listener gagal, tampilkan status “Data hutang belum tersedia” tanpa
  merusak metrik kas.

### `riwayat.html` dan `riwayat.js`

Gunakan view model terpadu untuk tampilan, tetapi pertahankan kalkulasi domain
terpisah:

```js
{
  domain: "cash" | "debt",
  type: "saving" | "expense" | "debt" | "payment" | "reversal",
  amount: 10000,
  occurredAt: Date,
  description: "...",
  sourceId: "..."
}
```

Ketentuan:

- Tambahkan filter domain: Semua, Kas, Hutang.
- Entri hutang diberi label teks yang jelas; jangan hanya dibedakan dengan
  warna.
- CSV minimal memiliki kolom: `domain`, `jenis`, `dari`, `kepada`, `nominal`,
  `tanggal`, `catatan`, `dibuat_oleh`.
- Ekspor mengikuti filter aktif.
- Jangan memasukkan entri hutang ke total pemasukan, pengeluaran, atau saldo
  kas.

### `tabungan.html` dan `belanja.html`

- Tambahkan tautan navigasi menuju `hutang.html`.
- Jangan mengubah kalkulasi tabungan/belanja.
- Jangan otomatis membuat entri hutang dari belanja pada MVP; hubungan tersebut
  memerlukan UX dan aturan bisnis tersendiri.

### `README.md`

Tambahkan:

- Penjelasan fitur hutang bersih.
- Cara menyiapkan dua anggota kelompok.
- Struktur koleksi Firestore.
- Cara deploy rules.
- Skenario uji Iwan Rp10.000 dan Wadda Rp7.000.

## 10. Aturan keamanan Firestore

Rules harus memastikan:

- Pengguna belum login tidak dapat membaca atau menulis data kelompok.
- Hanya UID yang tercantum pada `memberUids` kelompok yang dapat membaca entri.
- Hanya anggota kelompok yang dapat membuat entri.
- `createdByUid` harus sama dengan `request.auth.uid`.
- Nominal harus integer dan berada dalam batas valid.
- Kedua member ID harus valid dan berbeda.
- Hard update dan hard delete entri hutang ditolak.
- Pembatalan dibuat sebagai dokumen reversal baru.
- Satu entri asli hanya boleh direversal satu kali.

Jangan menyalin rules konseptual langsung ke produksi tanpa menyesuaikannya
dengan struktur koleksi proyek yang nyata. Uji rules dengan Firebase Emulator
sebelum deploy.

### Mode demo dan fallback lokal

- Mode demo boleh menggunakan `localStorage` dengan namespace khusus, misalnya
  `demoDebtEntries:v1`.
- Data demo tidak boleh bercampur dengan akun produksi.
- Registry lokal tidak boleh memberikan hak akses ke Firestore.
- Akses cloud tetap wajib memakai Firebase Auth dan rules server-side.

## 11. Spesifikasi visual: minimal, bersih, dan tidak “AI slop”

Tujuan visual adalah antarmuka finansial yang tenang, jelas, dan konsisten.
Pertahankan dark mode, tetapi kurangi glassmorphism.

### Prinsip wajib

- Gunakan satu aksen utama, misalnya biru.
- Gunakan hijau, oranye, dan merah hanya untuk makna status.
- Utamakan border tipis sebelum shadow.
- Maksimum radius umum 8–12 px.
- Gunakan ruang kosong dan hierarki tipografi, bukan banyak kartu.
- Body minimal 16 px; teks kecil tidak kurang dari 14 px.
- Target interaksi minimal 44 × 44 px.
- Lebar konten utama sekitar 960–1120 px dengan gutter 24–48 px di desktop.
- Pada layar sempit, gunakan gutter 16–24 px dan satu kolom.
- Semua focus state harus terlihat.
- Kontras teks mengikuti WCAG AA.
- Hormati `prefers-reduced-motion`.

### Token yang direkomendasikan

```css
:root {
  --bg: #191919;
  --surface: #202020;
  --surface-raised: #2a2a29;
  --border: rgba(255, 255, 255, 0.16);
  --text: #ffffff;
  --text-muted: rgba(255, 255, 255, 0.65);
  --accent: #5e9fe8;
  --positive: #72bc8f;
  --attention: #de9255;
  --danger: #e97366;
  --radius-sm: 8px;
  --radius-md: 12px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
}
```

### Larangan visual

- Tidak ada gradient dekoratif besar.
- Tidak ada glow neon pada setiap elemen.
- Tidak ada blur/transparansi pada semua kartu.
- Tidak ada deretan kartu metrik yang tidak diperlukan.
- Tidak ada judul hero berukuran berlebihan.
- Tidak ada ikon acak, emoji dekoratif, ilustrasi generik, atau badge berbentuk
  pill tanpa fungsi.
- Tidak ada shadow tebal berlapis.
- Tidak ada animasi masuk untuk setiap komponen.
- Tidak ada microcopy panjang dan terdengar seperti promosi.
- Jangan mengandalkan merah/hijau saja; selalu sertakan teks arah hutang.

### Pemakaian glassmorphism

Jika ingin mempertahankan identitas desain lama, batasi `backdrop-filter` hanya
pada navigasi atau dialog. Permukaan utama sebaiknya solid agar keterbacaan dan
performa lebih baik.

## 12. Penanganan kondisi UI

Setiap halaman yang memakai data hutang harus memiliki:

- **Loading:** skeleton sederhana atau satu teks status; jangan memakai spinner
  besar.
- **Empty:** “Belum ada catatan hutang.” disertai satu aksi “Tambah entri”.
- **Error:** pesan singkat, penyebab yang berguna, dan tombol “Coba lagi”.
- **Offline:** tandai entri yang belum tersinkron jika persistence digunakan.
- **Success:** notifikasi kecil yang hilang otomatis dan tetap dapat dibaca
  screen reader.
- **Reversal:** entri asli tetap terlihat sebagai dibatalkan dan terhubung ke
  entri reversal.

## 13. Urutan implementasi

### Fase 0 — Audit kode yang ada

- [ ] Baca seluruh HTML dan urutan script.
- [ ] Catat ID/class yang sudah dipakai.
- [ ] Verifikasi jalur koleksi Firestore.
- [ ] Verifikasi bentuk session user dan mode demo.
- [ ] Verifikasi cara dua akun bergabung ke data yang sama.
- [ ] Temukan seluruh fungsi kalkulasi saldo.
- [ ] Temukan fungsi hapus dan ekspor CSV.
- [ ] Catat token CSS, breakpoint, nav, dialog, toast, loading, dan error state
      yang sudah ada.
- [ ] Buat backup/branch sebelum perubahan.

### Fase 1 — Fondasi domain

- [ ] Tetapkan `groupId`, member A, dan member B.
- [ ] Buat `debt-engine.js` tanpa Firebase/DOM.
- [ ] Implementasikan validasi integer Rupiah.
- [ ] Implementasikan `toSignedDelta()`.
- [ ] Implementasikan `calculateNet()`.
- [ ] Implementasikan `describePosition()`.
- [ ] Tambahkan unit test untuk semua arah hutang, pembayaran, nol, dan
      reversal.

### Fase 2 — Penyimpanan dan keamanan

- [ ] Buat `debt-service.js`.
- [ ] Implementasikan realtime listener yang mengembalikan fungsi unsubscribe.
- [ ] Implementasikan create dengan `serverTimestamp()`.
- [ ] Tambahkan `clientRequestId` dan submit lock.
- [ ] Implementasikan reversal idempoten menggunakan transaction atau ID
      reversal deterministik.
- [ ] Tambahkan Firestore index bila query membutuhkannya.
- [ ] Tulis dan uji security rules pada Emulator.

### Fase 3 — Halaman hutang

- [ ] Buat struktur semantik `hutang.html`.
- [ ] Buat ringkasan posisi.
- [ ] Buat form hutang/pembayaran.
- [ ] Buat riwayat, filter, pencarian, dan empty state.
- [ ] Buat dialog pembatalan yang accessible.
- [ ] Hubungkan `hutang.js` ke engine dan service.
- [ ] Pastikan listener di-unsubscribe saat halaman dilepas.

### Fase 4 — Integrasi aplikasi

- [ ] Tambahkan navigasi Hutang di semua halaman utama.
- [ ] Tambahkan ringkasan hutang di dashboard.
- [ ] Tambahkan domain hutang di riwayat.
- [ ] Perbarui ekspor CSV.
- [ ] Pastikan saldo kas tidak berubah oleh entri hutang.
- [ ] Pisahkan data demo dan produksi.

### Fase 5 — Penyempurnaan visual

- [ ] Rapikan token warna, spacing, radius, dan tipografi.
- [ ] Kurangi blur, gradient, glow, shadow, dan kartu berlebihan.
- [ ] Periksa desktop sekitar 1440 px.
- [ ] Periksa mobile sekitar 390 px.
- [ ] Periksa overflow tabel dan dialog.
- [ ] Periksa keyboard navigation, focus state, label form, dan kontras.
- [ ] Periksa reduced motion.

### Fase 6 — Uji dan deploy

- [ ] Jalankan test kalkulasi.
- [ ] Jalankan Emulator untuk rules.
- [ ] Uji dua sesi pengguna secara bersamaan.
- [ ] Uji refresh, offline, koneksi lambat, dan submit ganda.
- [ ] Uji ekspor CSV.
- [ ] Pastikan tidak ada error console.
- [ ] Deploy ke environment staging.
- [ ] Jalankan smoke test.
- [ ] Deploy production setelah seluruh acceptance criteria lolos.

## 14. Skenario uji utama

### Kalkulasi dasar

1. Tambah hutang Iwan Rp10.000.
2. Pastikan posisi: “Iwan berhutang Rp10.000 kepada Wadda”.
3. Tambah hutang Wadda Rp7.000.
4. Pastikan posisi: “Iwan berhutang Rp3.000 kepada Wadda”.
5. Tambah hutang Wadda Rp3.000.
6. Pastikan posisi: “Tidak ada hutang bersih”.

### Pembayaran

1. Buat Iwan berhutang Rp10.000.
2. Catat pembayaran Iwan Rp4.000 kepada Wadda.
3. Pastikan posisi menjadi Rp6.000, bukan Rp14.000.
4. Catat pembayaran Rp7.000.
5. Minta konfirmasi karena pembayaran melewati posisi dan akan membuat Wadda
   berhutang Rp1.000.

### Realtime dua pengguna

1. Buka akun Iwan dan Wadda pada dua browser/sesi.
2. Buat entri dari akun Iwan.
3. Pastikan akun Wadda menerima perubahan tanpa refresh.
4. Buat entri dari kedua akun hampir bersamaan.
5. Pastikan kedua entri tersimpan dan hasil net sama di kedua sesi.

### Pembatalan

1. Buat entri Rp10.000.
2. Batalkan entri tersebut.
3. Pastikan entri asli tetap terlihat sebagai dibatalkan.
4. Pastikan delta reversal menghapus pengaruhnya dari net.
5. Pastikan pembatalan kedua ditolak.

### Isolasi saldo kas

1. Catat saldo tabungan awal.
2. Tambah beberapa entri hutang dan pembayaran.
3. Pastikan saldo dashboard, total tabungan, dan total belanja tidak berubah.

## 15. Acceptance criteria

Fitur dianggap selesai jika seluruh kondisi berikut benar:

- [ ] Input Iwan Rp10.000 lalu Wadda Rp7.000 menghasilkan sisa hutang Iwan
      Rp3.000.
- [ ] Arah hutang berbalik dengan benar ketika net melewati nol.
- [ ] Nilai nol menampilkan keadaan lunas/seimbang.
- [ ] Hutang, pembayaran, dan reversal dihitung sesuai tabel delta.
- [ ] Semua nominal disimpan sebagai integer Rupiah.
- [ ] Data terlihat realtime oleh kedua anggota.
- [ ] Entri hutang tidak memengaruhi saldo kas bersama.
- [ ] Refresh halaman tidak mengubah hasil.
- [ ] Submit ganda tidak membuat duplikasi.
- [ ] Entri tidak di-hard-delete.
- [ ] Pengguna di luar kelompok tidak dapat membaca/menulis data.
- [ ] Riwayat dan CSV menandai domain kas/hutang dengan jelas.
- [ ] UI memiliki loading, empty, error, success, dan reversal state.
- [ ] UI berfungsi tanpa overflow pada lebar sekitar 390 px.
- [ ] Kontrol dapat dipakai dengan keyboard dan focus terlihat.
- [ ] Tidak ada error console pada alur utama.

## 16. Risiko dan mitigasi

| Risiko                          | Dampak                             | Mitigasi                                                  |
| ------------------------------- | ---------------------------------- | --------------------------------------------------------- |
| Data saat ini tersimpan per UID | Dua orang melihat saldo berbeda    | Migrasikan ke `groupId` sebelum fitur hutang dirilis      |
| Entri hutang ikut kalkulasi kas | Saldo bersama salah                | Koleksi terpisah dan fungsi kalkulasi terpisah            |
| Dua submit saat koneksi lambat  | Data ganda                         | Disable button, `clientRequestId`, dan write idempoten    |
| Update bersamaan                | Nilai akhir tertimpa               | Ledger append-only; net dihitung dari semua entri         |
| Pengguna salah input            | Jejak hilang jika dihapus          | Gunakan reversal dan simpan relasi ke entri asli          |
| Pembayaran berlebih             | Arah hutang tidak sengaja berbalik | Tampilkan preview hasil dan konfirmasi eksplisit          |
| Rules terlalu longgar           | Kebocoran data                     | Validasi membership dan payload di server-side rules      |
| `common.js` makin kompleks      | Sulit diuji dan dirawat            | Pisahkan engine dan service hutang                        |
| Glassmorphism berlebihan        | UI ramai dan sulit dibaca          | Surface solid, border tipis, satu accent, motion terbatas |

## 17. Definition of Done

- Seluruh acceptance criteria lolos.
- Unit test kalkulasi dan Emulator rules lolos.
- Dua akun produksi/staging berhasil berbagi ledger yang sama.
- Tidak ada perubahan pada hasil kalkulasi tabungan dan belanja lama.
- Tampilan desktop dan mobile telah ditinjau secara visual.
- Dokumentasi dan contoh skema telah diperbarui.
- Ada langkah rollback yang jelas.
- Deploy dilakukan ke staging sebelum production.

## 18. Strategi rollback

Karena data hutang disimpan terpisah dari transaksi kas, rollback dapat
dilakukan tanpa menyentuh tabungan dan belanja:

1. Lepas navigasi dan komponen hutang dari UI.
2. Hentikan listener hutang di dashboard dan riwayat.
3. Pertahankan koleksi `debtEntries` agar data tidak hilang.
4. Kembalikan rules hanya setelah memastikan versi lama aplikasi tidak
   bergantung pada koleksi tersebut.
5. Jangan menghapus data production sebagai bagian dari rollback.

## 19. Urutan prioritas final

1. Verifikasi model kelompok dua pengguna.
2. Bangun dan uji `debt-engine.js`.
3. Amankan Firestore dan buat `debt-service.js`.
4. Bangun `hutang.html` serta `hutang.js`.
5. Integrasikan dashboard dan riwayat tanpa menyentuh saldo kas.
6. Rapikan style menjadi minimal dan accessible.
7. Uji dua pengguna, staging, lalu production.

Rencana ini sengaja memisahkan domain **kas bersama** dan **hutang
antaranggota**. Pemisahan tersebut adalah keputusan paling penting untuk menjaga
saldo tetap benar, riwayat dapat diaudit, dan fitur mudah dikembangkan di masa
depan.
