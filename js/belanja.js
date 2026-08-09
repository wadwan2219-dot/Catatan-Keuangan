/**
 * SaldoKu - Input Belanja Logic (belanja.js)
 * Manages expense input, category selection, real-time balance check & low-balance warning.
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();

  const inputNamaItem = document.getElementById('belanja-nama');
  const inputNominal = document.getElementById('belanja-nominal');
  const selectKategori = document.getElementById('belanja-kategori');
  const inputTanggal = document.getElementById('belanja-tanggal');
  const form = document.getElementById('form-belanja');
  const previewNewSaldo = document.getElementById('preview-new-saldo');
  const valCurrentSaldo = document.getElementById('val-current-saldo');
  const warningBanner = document.getElementById('warning-saldo-kurang');

  // Set default date to today
  if (inputTanggal && !inputTanggal.value) {
    inputTanggal.value = getTodayString();
  }

  function reloadBalance() {
    const currentStats = calculateUserBalance(user.uid);
    if (valCurrentSaldo) {
      valCurrentSaldo.textContent = formatRupiah(currentStats.sisaSaldo);
    }
    updatePreview();
  }

  // Live calculation preview & Insufficient balance check
  function updatePreview() {
    const currentStats = calculateUserBalance(user.uid);
    const rawVal = parseRupiah(inputNominal ? inputNominal.value : 0);
    const newTotal = currentStats.sisaSaldo - rawVal;
    
    if (previewNewSaldo) {
      previewNewSaldo.textContent = formatRupiah(newTotal);
      if (newTotal < 0) {
        previewNewSaldo.className = 'text-lg font-bold text-rose-400';
      } else {
        previewNewSaldo.className = 'text-lg font-bold text-slate-200';
      }
    }

    // Toggle Warning Banner
    if (warningBanner) {
      if (rawVal > currentStats.sisaSaldo) {
        warningBanner.classList.remove('hidden');
      } else {
        warningBanner.classList.add('hidden');
      }
    }
  }

  // Sync real-time Firestore DB
  reloadBalance();
  syncFirestoreData(() => reloadBalance());

  // Auto format currency on input
  if (inputNominal) {
    inputNominal.addEventListener('input', (e) => {
      const numeric = parseRupiah(e.target.value);
      if (numeric === 0) {
        e.target.value = '';
      } else {
        e.target.value = new Intl.NumberFormat('id-ID').format(numeric);
      }
      updatePreview();
    });
  }

  // Category Selector Buttons
  const categoryChips = document.querySelectorAll('.chip-kategori');
  categoryChips.forEach(chip => {
    chip.addEventListener('click', () => {
      categoryChips.forEach(c => c.classList.remove('bg-rose-600', 'text-white', 'border-rose-500'));
      chip.classList.add('bg-rose-600', 'text-white', 'border-rose-500');
      const cat = chip.getAttribute('data-category');
      if (selectKategori) selectKategori.value = cat;
    });
  });

  // Submit Handler
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const namaItem = inputNamaItem.value.trim();
      const nominal = parseRupiah(inputNominal.value);
      const kategori = selectKategori.value || 'Umum';
      const tanggal = inputTanggal.value || getTodayString();

      if (!namaItem) {
        showToast('Masukkan nama barang/keperluan belanja!', 'error');
        return;
      }

      if (!nominal || nominal <= 0) {
        showToast('Masukkan nominal pengeluaran yang valid!', 'error');
        return;
      }

      const currentStats = calculateUserBalance(user.uid);

      // Warn if user proceeds with deficit
      if (nominal > currentStats.sisaSaldo) {
        showToast('Catatan: Transaksi ini membuat saldo Anda minus/defisit!', 'warning');
      }

      // Add to store & Cloud Firestore DB
      await addBelanjaTransaction(user.uid, namaItem, nominal, kategori, tanggal);

      showToast(`Pengeluaran ${namaItem} (${formatRupiah(nominal)}) telah dicatat! 🛒`, 'success');

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    });
  }
});
