/**
 * SaldoKu - Dashboard Pribadi Wadda (dashboard-wadda.js)
 * Dual-Pocket Financial Engine: Kas Siap Pakai vs Tabungan Wadda.
 * Sesuai panduan UI/UX Pro Max (Zero AI Slop, clean typography, SVG only).
 */

let activeTransactionFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();

  // Pastikan sesi aktif diarahkan ke Wadda
  if (user.memberId !== 'wadda') {
    user.memberId = 'wadda';
    user.uid = 'wadda';
    user.groupId = 'pribadi_wadda';
    user.role = 'personal';
    user.isJoint = false;
    setCurrentUser(user);
  }

  // Populate User Header
  const userNameElem = document.getElementById('user-display-name');
  const userEmailElem = document.getElementById('user-display-email');
  if (userNameElem) userNameElem.textContent = 'Wadda (Pribadi)';
  if (userEmailElem) userEmailElem.textContent = 'wadda@pribadi.com';

  // Logout Handler
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  }

  // Init Modals and Actions
  initWaddaModals(user);
  initTransactionFilters();

  // Load Initial Dashboard Metrics
  loadWaddaDashboardMetrics();

  // Subscribe to Realtime Updates
  syncFirestoreData(() => {
    loadWaddaDashboardMetrics();
  });
});

/**
 * Memuat dan mengkalkulasi metrik keuangan Wadda
 */
function loadWaddaDashboardMetrics() {
  const stats = calculateUserBalance('wadda');
  const transactions = getAllTransactions('wadda');

  // 1. Update Card 1: Kas Siap Pakai
  const valKas = document.getElementById('val-saldo-kas');
  const badgeKas = document.getElementById('badge-status-kas');
  if (valKas) valKas.textContent = formatRupiah(stats.saldoKas);
  if (badgeKas) {
    if (stats.saldoKas < 0) {
      badgeKas.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300';
      badgeKas.textContent = 'Defisit';
    } else {
      badgeKas.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300';
      badgeKas.textContent = 'Siap Pakai';
    }
  }

  // 2. Update Card 2: Tabungan Wadda
  const valTabungan = document.getElementById('val-saldo-tabungan');
  if (valTabungan) valTabungan.textContent = formatRupiah(stats.saldoTabungan);

  // 3. Update Card 3: Total Aset Wadda
  const valAset = document.getElementById('val-total-aset');
  if (valAset) valAset.textContent = formatRupiah(stats.totalAset);

  // 4. Update Card 4: Total Pengeluaran
  const valBelanja = document.getElementById('val-total-belanja');
  const detailBelanja = document.getElementById('val-pengeluaran-detail');
  if (valBelanja) valBelanja.textContent = formatRupiah(stats.totalBelanja);
  if (detailBelanja) {
    detailBelanja.textContent = `Kas: ${formatRupiah(stats.kasKeluar)} • Tabungan: ${formatRupiah(stats.tabunganKeluar)}`;
  }

  // 5. Update Pocket Ratio Progress Bar
  const percentKasElem = document.getElementById('percent-kas');
  const percentTabunganElem = document.getElementById('percent-tabungan');
  const barKas = document.getElementById('bar-alokasi-kas');
  const barTabungan = document.getElementById('bar-alokasi-tabungan');

  const totalPositive = Math.max(0, stats.saldoKas) + Math.max(0, stats.saldoTabungan);
  let pKas = 50;
  let pTab = 50;

  if (totalPositive > 0) {
    pKas = Math.round((Math.max(0, stats.saldoKas) / totalPositive) * 100);
    pTab = 100 - pKas;
  }

  if (percentKasElem) percentKasElem.textContent = `${pKas}%`;
  if (percentTabunganElem) percentTabunganElem.textContent = `${pTab}%`;
  if (barKas) barKas.style.width = `${pKas}%`;
  if (barTabungan) barTabungan.style.width = `${pTab}%`;

  // 6. Update Modals Available Balances
  const labelAvailKas = document.getElementById('label-avail-kas');
  const labelAvailTabungan = document.getElementById('label-avail-tabungan');
  if (labelAvailKas) labelAvailKas.textContent = `Sisa: ${formatRupiah(stats.saldoKas)}`;
  if (labelAvailTabungan) labelAvailTabungan.textContent = `Sisa: ${formatRupiah(stats.saldoTabungan)}`;

  // 7. Render Transactions
  renderWaddaTransactions(transactions);
}

/**
 * Filter handler untuk daftar transaksi
 */
function initTransactionFilters() {
  const btnAll = document.getElementById('filter-all');
  const btnKas = document.getElementById('filter-kas');
  const btnTabungan = document.getElementById('filter-tabungan');

  function setFilter(filterType) {
    activeTransactionFilter = filterType;
    [btnAll, btnKas, btnTabungan].forEach(b => {
      if (b) {
        b.className = 'btn-filter px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition-all cursor-pointer';
      }
    });

    if (filterType === 'all' && btnAll) {
      btnAll.className = 'btn-filter px-3 py-1.5 rounded-lg font-bold transition-all bg-indigo-600 text-white cursor-pointer';
    } else if (filterType === 'kas' && btnKas) {
      btnKas.className = 'btn-filter px-3 py-1.5 rounded-lg font-bold transition-all bg-cyan-600 text-white cursor-pointer';
    } else if (filterType === 'tabungan' && btnTabungan) {
      btnTabungan.className = 'btn-filter px-3 py-1.5 rounded-lg font-bold transition-all bg-emerald-600 text-white cursor-pointer';
    }

    renderWaddaTransactions(getAllTransactions('wadda'));
  }

  if (btnAll) btnAll.addEventListener('click', () => setFilter('all'));
  if (btnKas) btnKas.addEventListener('click', () => setFilter('kas'));
  if (btnTabungan) btnTabungan.addEventListener('click', () => setFilter('tabungan'));
}

/**
 * Render Riwayat Transaksi Wadda
 */
function renderWaddaTransactions(allList) {
  const container = document.getElementById('recent-transactions-list');
  if (!container) return;

  // Filter based on active filter
  let filtered = allList;
  if (activeTransactionFilter === 'kas') {
    filtered = allList.filter(t => t.pocket === 'kas');
  } else if (activeTransactionFilter === 'tabungan') {
    filtered = allList.filter(t => t.pocket === 'tabungan');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <div class="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 mx-auto flex items-center justify-center mb-2.5">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p class="text-xs font-semibold text-slate-300">Belum ada riwayat transaksi</p>
        <p class="text-[11px] text-slate-500 mt-0.5">Catatan transaksi akan tampil di sini.</p>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(t => {
    const isIncome = t.type === 'tabungan';
    const sign = isIncome ? '+' : '-';
    const amountColor = isIncome ? 'text-emerald-400' : 'text-rose-400';
    
    // Pocket Badge
    const isKas = t.pocket === 'kas';
    const pocketBadge = isKas
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 font-mono">Kas Siap Pakai</span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-mono">Tabungan</span>`;

    const iconBox = isIncome
      ? `<div class="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
           <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
           </svg>
         </div>`
      : `<div class="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center flex-shrink-0">
           <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
           </svg>
         </div>`;

    html += `
      <div class="flex items-center justify-between p-3.5 rounded-xl bg-[#090f20]/90 border border-slate-800/90 hover:border-slate-700 transition-all group">
        <div class="flex items-center gap-3 min-w-0">
          ${iconBox}
          <div class="truncate">
            <h4 class="text-xs sm:text-sm font-bold text-white truncate">${t.title}</h4>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-[11px] text-slate-400 font-mono">${formatDate(t.tanggal)}</span>
              ${pocketBadge}
              ${t.kategori ? `<span class="text-[10px] text-slate-500 hidden sm:inline">• ${t.kategori}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 flex-shrink-0">
          <div class="text-right">
            <span class="text-xs sm:text-sm font-black font-mono ${amountColor}">${sign} ${formatRupiah(t.amount)}</span>
          </div>
          <button type="button" data-del-id="${t.id}" data-del-type="${t.type}" title="Hapus Transaksi" 
                  class="btn-delete-transaksi p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Bind Delete buttons
  container.querySelectorAll('.btn-delete-transaksi').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-id');
      const type = btn.getAttribute('data-del-type');
      if (confirm('Hapus transaksi ini?')) {
        await deleteTransactionItem(id, type);
        showToast('Transaksi berhasil dihapus.', 'info');
        loadWaddaDashboardMetrics();
      }
    });
  });
}

/**
 * Inisialisasi 3 Modal Interaktif: Pemasukan, Pengeluaran, Pindah Dana
 */
function initWaddaModals(user) {
  // Helper open / close modal
  function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    if (show) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    } else {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  // ------------------------------------------------------------------------
  // MODAL 1: PEMASUKAN
  // ------------------------------------------------------------------------
  const btnOpenPemasukan = document.getElementById('btn-open-modal-pemasukan');
  const btnClosePemasukan = document.getElementById('btn-close-modal-pemasukan');
  const formPemasukan = document.getElementById('form-modal-pemasukan');
  const inputNominalIn = document.getElementById('pemasukan-nominal');
  const inputKeteranganIn = document.getElementById('pemasukan-keterangan');
  const inputTanggalIn = document.getElementById('pemasukan-tanggal');
  const inputKantongIn = document.getElementById('pemasukan-kantong');
  const btnAlokasiKas = document.getElementById('btn-alokasi-kas');
  const btnAlokasiTabungan = document.getElementById('btn-alokasi-tabungan');
  const hintPemasukan = document.getElementById('pemasukan-kantong-hint');

  if (inputTanggalIn) inputTanggalIn.value = getTodayString();

  if (btnOpenPemasukan) {
    btnOpenPemasukan.addEventListener('click', () => {
      if (inputTanggalIn) inputTanggalIn.value = getTodayString();
      toggleModal('modal-pemasukan', true);
    });
  }

  if (btnClosePemasukan) {
    btnClosePemasukan.addEventListener('click', () => toggleModal('modal-pemasukan', false));
  }

  // Toggle Kantong Tujuan (Kas vs Tabungan)
  function setAlokasiPemasukan(target) {
    inputKantongIn.value = target;
    if (target === 'kas') {
      btnAlokasiKas.className = 'py-2.5 px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnAlokasiTabungan.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnAlokasiKas.querySelector('span').className = 'w-2 h-2 rounded-full bg-cyan-400';
      btnAlokasiTabungan.querySelector('span').className = 'w-2 h-2 rounded-full bg-slate-600';
      if (hintPemasukan) hintPemasukan.textContent = 'Uang masuk dapat langsung digunakan untuk kebutuhan harian.';
    } else {
      btnAlokasiTabungan.className = 'py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnAlokasiKas.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnAlokasiTabungan.querySelector('span').className = 'w-2 h-2 rounded-full bg-emerald-400';
      btnAlokasiKas.querySelector('span').className = 'w-2 h-2 rounded-full bg-slate-600';
      if (hintPemasukan) hintPemasukan.textContent = 'Uang masuk disimpan sebagai tabungan aman masa depan.';
    }
  }

  if (btnAlokasiKas) btnAlokasiKas.addEventListener('click', () => setAlokasiPemasukan('kas'));
  if (btnAlokasiTabungan) btnAlokasiTabungan.addEventListener('click', () => setAlokasiPemasukan('tabungan'));

  // Preset Buttons
  document.querySelectorAll('.btn-preset-in').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = Number(btn.getAttribute('data-preset')) || 0;
      inputNominalIn.value = new Intl.NumberFormat('id-ID').format(amount);
    });
  });

  // Currency input format
  if (inputNominalIn) {
    inputNominalIn.addEventListener('input', (e) => {
      const numeric = parseRupiah(e.target.value);
      e.target.value = numeric ? new Intl.NumberFormat('id-ID').format(numeric) : '';
    });
  }

  // Form submit Pemasukan
  if (formPemasukan) {
    formPemasukan.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nominal = parseRupiah(inputNominalIn.value);
      const keterangan = inputKeteranganIn.value.trim();
      const tanggal = inputTanggalIn.value || getTodayString();
      const kantong = inputKantongIn.value || 'kas';

      if (!nominal || nominal <= 0) {
        showToast('Nominal pemasukan harus lebih dari 0.', 'error');
        return;
      }

      await addTabunganTransaction(user.uid, nominal, keterangan, tanggal, kantong);
      const pocketLabel = kantong === 'kas' ? 'Kas Siap Pakai' : 'Tabungan';
      showToast(`Pemasukan ${formatRupiah(nominal)} masuk ke ${pocketLabel}.`, 'success');

      formPemasukan.reset();
      inputNominalIn.value = '';
      setAlokasiPemasukan('kas');
      toggleModal('modal-pemasukan', false);
      loadWaddaDashboardMetrics();
    });
  }

  // ------------------------------------------------------------------------
  // MODAL 2: PENGELUARAN
  // ------------------------------------------------------------------------
  const btnOpenPengeluaran = document.getElementById('btn-open-modal-pengeluaran');
  const btnClosePengeluaran = document.getElementById('btn-close-modal-pengeluaran');
  const formPengeluaran = document.getElementById('form-modal-pengeluaran');
  const inputNamaOut = document.getElementById('pengeluaran-nama');
  const inputNominalOut = document.getElementById('pengeluaran-nominal');
  const selectKategoriOut = document.getElementById('pengeluaran-kategori');
  const inputTanggalOut = document.getElementById('pengeluaran-tanggal');
  const inputSumberOut = document.getElementById('pengeluaran-sumber');
  const btnSumberKas = document.getElementById('btn-sumber-kas');
  const btnSumberTabungan = document.getElementById('btn-sumber-tabungan');
  const hintPengeluaran = document.getElementById('pengeluaran-sumber-hint');
  const boxWarning = document.getElementById('box-warning-defisit');

  if (inputTanggalOut) inputTanggalOut.value = getTodayString();

  if (btnOpenPengeluaran) {
    btnOpenPengeluaran.addEventListener('click', () => {
      if (inputTanggalOut) inputTanggalOut.value = getTodayString();
      toggleModal('modal-pengeluaran', true);
    });
  }

  if (btnClosePengeluaran) {
    btnClosePengeluaran.addEventListener('click', () => toggleModal('modal-pengeluaran', false));
  }

  // Toggle Sumber Dana (Kas vs Tabungan)
  function setSumberPengeluaran(target) {
    inputSumberOut.value = target;
    const stats = calculateUserBalance('wadda');
    if (target === 'kas') {
      btnSumberKas.className = 'py-2.5 px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      btnSumberTabungan.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      if (hintPengeluaran) hintPengeluaran.textContent = 'Standar belanja harian: tabungan tetap aman tidak tersentuh.';
    } else {
      btnSumberTabungan.className = 'py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      btnSumberKas.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      if (hintPengeluaran) hintPengeluaran.textContent = 'Penarikan simpanan: mengurangi saldo tabungan aman Wadda.';
    }
    checkDefisit();
  }

  if (btnSumberKas) btnSumberKas.addEventListener('click', () => setSumberPengeluaran('kas'));
  if (btnSumberTabungan) btnSumberTabungan.addEventListener('click', () => setSumberPengeluaran('tabungan'));

  // Live Deficit Check
  function checkDefisit() {
    const rawVal = parseRupiah(inputNominalOut.value);
    const target = inputSumberOut.value;
    const stats = calculateUserBalance('wadda');
    const avail = target === 'kas' ? stats.saldoKas : stats.saldoTabungan;

    if (boxWarning) {
      if (rawVal > avail) {
        boxWarning.classList.remove('hidden');
        boxWarning.textContent = `Perhatian: Nominal (${formatRupiah(rawVal)}) melebihi sisa ${target === 'kas' ? 'Kas Siap Pakai' : 'Tabungan'} (${formatRupiah(avail)}).`;
      } else {
        boxWarning.classList.add('hidden');
      }
    }
  }

  if (inputNominalOut) {
    inputNominalOut.addEventListener('input', (e) => {
      const numeric = parseRupiah(e.target.value);
      e.target.value = numeric ? new Intl.NumberFormat('id-ID').format(numeric) : '';
      checkDefisit();
    });
  }

  // Form submit Pengeluaran
  if (formPengeluaran) {
    formPengeluaran.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = inputNamaOut.value.trim();
      const nominal = parseRupiah(inputNominalOut.value);
      const kategori = selectKategoriOut.value || 'Umum';
      const tanggal = inputTanggalOut.value || getTodayString();
      const sumberDana = inputSumberOut.value || 'kas';

      if (!nama) {
        showToast('Nama barang atau keperluan harus diisi.', 'error');
        return;
      }
      if (!nominal || nominal <= 0) {
        showToast('Nominal pengeluaran tidak valid.', 'error');
        return;
      }

      await addBelanjaTransaction(user.uid, nama, nominal, kategori, tanggal, sumberDana);
      const sourceLabel = sumberDana === 'kas' ? 'Kas Siap Pakai' : 'Tabungan';
      showToast(`Pengeluaran ${formatRupiah(nominal)} berhasil dipotong dari ${sourceLabel}.`, 'success');

      formPengeluaran.reset();
      inputNominalOut.value = '';
      if (boxWarning) boxWarning.classList.add('hidden');
      setSumberPengeluaran('kas');
      toggleModal('modal-pengeluaran', false);
      loadWaddaDashboardMetrics();
    });
  }

  // ------------------------------------------------------------------------
  // MODAL 3: PINDAH DANA
  // ------------------------------------------------------------------------
  const btnOpenTransfer = document.getElementById('btn-open-modal-transfer');
  const btnCloseTransfer = document.getElementById('btn-close-modal-transfer');
  const formTransfer = document.getElementById('form-modal-transfer');
  const inputNominalTransfer = document.getElementById('transfer-nominal');
  const inputCatatanTransfer = document.getElementById('transfer-catatan');

  if (btnOpenTransfer) {
    btnOpenTransfer.addEventListener('click', () => toggleModal('modal-transfer', true));
  }

  if (btnCloseTransfer) {
    btnCloseTransfer.addEventListener('click', () => toggleModal('modal-transfer', false));
  }

  if (inputNominalTransfer) {
    inputNominalTransfer.addEventListener('input', (e) => {
      const numeric = parseRupiah(e.target.value);
      e.target.value = numeric ? new Intl.NumberFormat('id-ID').format(numeric) : '';
    });
  }

  if (formTransfer) {
    formTransfer.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nominal = parseRupiah(inputNominalTransfer.value);
      const catatan = inputCatatanTransfer.value.trim();
      const radio = document.querySelector('input[name="arah-transfer"]:checked');
      const arah = radio ? radio.value : 'kas_to_tabungan';

      if (!nominal || nominal <= 0) {
        showToast('Nominal transfer harus lebih dari 0.', 'error');
        return;
      }

      const stats = calculateUserBalance('wadda');
      const dari = arah === 'kas_to_tabungan' ? 'kas' : 'tabungan';
      const ke = arah === 'kas_to_tabungan' ? 'tabungan' : 'kas';
      const avail = dari === 'kas' ? stats.saldoKas : stats.saldoTabungan;

      if (nominal > avail) {
        showToast(`Saldo ${dari === 'kas' ? 'Kas Siap Pakai' : 'Tabungan'} tidak mencukupi untuk transfer!`, 'error');
        return;
      }

      await transferAntarKantong(user.uid, dari, ke, nominal, catatan);
      showToast(`Pindah dana ${formatRupiah(nominal)} berhasil diproses.`, 'success');

      formTransfer.reset();
      inputNominalTransfer.value = '';
      toggleModal('modal-transfer', false);
      loadWaddaDashboardMetrics();
    });
  }

  // Close modals on clicking background or Escape key
  ['modal-pemasukan', 'modal-pengeluaran', 'modal-transfer'].forEach(mId => {
    const el = document.getElementById(mId);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) toggleModal(mId, false);
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['modal-pemasukan', 'modal-pengeluaran', 'modal-transfer'].forEach(mId => toggleModal(mId, false));
    }
  });
}
