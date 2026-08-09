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

  // Load current sisa saldo
  const currentStats = calculateUserBalance(user.uid);
  if (valCurrentSaldo) {
    valCurrentSaldo.textContent = formatRupiah(currentStats.sisaSaldo);
  }

  // Live calculation preview & Insufficient balance check
  function updatePreview() {
    const rawVal = parseRupiah(inputNominal.value);
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

  // Category Selector Buttons (Optional quick pickers)
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
    form.addEventListener('submit', (e) => {
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

      // Warn if user proceeds with deficit
      if (nominal > currentStats.sisaSaldo) {
        showToast('Catatan: Transaksi ini membuat saldo Anda minus/defisit!', 'warning');
      }

      // Add to store
      addBelanjaTransaction(user.uid, namaItem, nominal, kategori, tanggal);

      showToast(`Pengeluaran ${namaItem} (${formatRupiah(nominal)}) telah dicatat! 🛒`, 'success');

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 800);
    });
  }
});
