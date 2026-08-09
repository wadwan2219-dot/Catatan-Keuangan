/**
 * SaldoKu - Input Tabungan Logic (tabungan.js)
 * Manages savings addition, preset buttons, live balance calculation, and submission.
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();

  const inputNominal = document.getElementById('tabungan-nominal');
  const inputKeterangan = document.getElementById('tabungan-keterangan');
  const inputTanggal = document.getElementById('tabungan-tanggal');
  const form = document.getElementById('form-tabungan');
  const previewNewSaldo = document.getElementById('preview-new-saldo');
  const valCurrentSaldo = document.getElementById('val-current-saldo');

  // Set default date to today
  if (inputTanggal && !inputTanggal.value) {
    inputTanggal.value = getTodayString();
  }

  // Load current sisa saldo
  const currentStats = calculateUserBalance(user.uid);
  if (valCurrentSaldo) {
    valCurrentSaldo.textContent = formatRupiah(currentStats.sisaSaldo);
  }

  // Live calculation preview
  function updatePreview() {
    const rawVal = parseRupiah(inputNominal.value);
    const newTotal = currentStats.sisaSaldo + rawVal;
    if (previewNewSaldo) {
      previewNewSaldo.textContent = formatRupiah(newTotal);
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

  // Preset Buttons Handling
  const presetBtns = document.querySelectorAll('.preset-tabungan');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = Number(btn.getAttribute('data-amount')) || 0;
      inputNominal.value = new Intl.NumberFormat('id-ID').format(amount);
      updatePreview();
    });
  });

  // Submit Handler
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nominal = parseRupiah(inputNominal.value);
      const keterangan = inputKeterangan.value.trim() || 'Tabungan Masuk';
      const tanggal = inputTanggal.value || getTodayString();

      if (!nominal || nominal <= 0) {
        showToast('Masukkan nominal tabungan yang valid!', 'error');
        return;
      }

      // Add to store
      addTabunganTransaction(user.uid, nominal, keterangan, tanggal);

      showToast(`Berhasil menambah tabungan sebesar ${formatRupiah(nominal)}! 💰`, 'success');

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 800);
    });
  }
});
