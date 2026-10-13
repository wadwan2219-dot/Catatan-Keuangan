/**
 * SaldoKu - Dashboard Akun Bersama (dashboard.js)
 * Dual-Pocket Financial Engine: Kas Siap Pakai vs Tabungan Bersama (Iwan & Wadda).
 * Real-time Supabase / Firestore sync, category expense analysis, interactive modals.
 * Mengikuti standar UI/UX Pro Max (Zero AI Slop, clean typography, SVG icons only).
 */

let activeTransactionFilter = 'all';
let dashboardCategoryChart = null;
let selectedExpenseMonth = 'current'; // 'current' | 'YYYY-MM' | 'all'
let activeCategoryFilter = null;

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();
  if (!user) return;

  // Guard: Suspended Account Check
  if (user.status === 'suspended') {
    logoutUser();
    return;
  }

  // Guard: Super Admin Redirect
  if (user.role === 'admin' || user.role === 'superadmin') {
    window.location.href = 'admin.html';
    return;
  }

  // Guard: Redirect Personal PIN Modes to respective dashboards
  if (user.memberId === 'iwan') {
    window.location.href = 'dashboard-iwan.html';
    return;
  }
  if (user.memberId === 'wadda') {
    window.location.href = 'dashboard-wadda.html';
    return;
  }

  // Populate User Header Info
  const userNameElem = document.getElementById('user-display-name');
  const userEmailElem = document.getElementById('user-display-email');

  if (userNameElem) userNameElem.textContent = user.nama || 'Iwan & Wadda (Akun Bersama)';
  if (userEmailElem) userEmailElem.textContent = user.email || 'bersama@saldoku.id';

  // Apply Modular Feature Flags for this user
  applyDashboardFeatureFlags(user);

  // Setup Invite Code Header & Partner Sharing
  setupInviteCodeHeader(user);

  // Setup Onboarding Initial Balance Wizard
  checkOnboardingWizard(user);

  // Logout Handler
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  }

  // Inisialisasi Modals dan Filter
  initDashboardModals(user);
  initTransactionFilters();

  // Load Initial Dashboard Metrics
  loadDashboardMetrics(user.uid);

  // Subscribe to Real-Time Cloud Data Sync
  syncFirestoreData(() => {
    loadDashboardMetrics(user.uid);
  });

  // Subscribe to Real-Time Net Debt Ledger (Hutang Bersih) if feature enabled
  if (window.DebtService && window.DebtEngine && isFeatureEnabled('debt_ledger', user)) {
    window.DebtService.subscribeEntries((debtEntries) => {
      updateDashboardDebtSummary(debtEntries);
    });
  }
});

/**
 * Setup Invite Code Header Pill & Clipboard Copy
 */
function setupInviteCodeHeader(user) {
  const btnCopyInvite = document.getElementById('btn-copy-invite-code');
  const displayInvite = document.getElementById('display-invite-code');
  if (!btnCopyInvite || !displayInvite) return;

  const isMaster = user.email === 'wadwan2219@gmail.com' || user.email === 'bersama@gmail.com';
  const inviteCode = user.inviteCode || user.features?.invite_code || (isMaster ? 'SLD-MAIN' : null);

  if (inviteCode && user.role !== 'admin') {
    displayInvite.textContent = inviteCode;
    btnCopyInvite.classList.remove('hidden');
    btnCopyInvite.classList.add('inline-flex');

    btnCopyInvite.onclick = (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(inviteCode).then(() => {
        showToast(`Kode Pasangan [${inviteCode}] disalin! Bagikan ke pasangan Anda untuk mengelola kas bersama.`, 'success');
      }).catch(() => {
        showToast(`Kode Pasangan Anda: ${inviteCode}`, 'info');
      });
    };
  } else {
    btnCopyInvite.classList.add('hidden');
  }
}

/**
 * Onboarding Wizard for First-Time Initial Balance Setup
 */
function checkOnboardingWizard(user) {
  if (!user || user.role === 'admin' || user.role === 'superadmin') return;
  const isMaster = user.email === 'wadwan2219@gmail.com' || user.email === 'bersama@gmail.com';
  if (isMaster) return;

  const modal = document.getElementById('modal-onboarding');
  if (!modal) return;

  const alreadyOnboarded = user.isOnboarded || user.features?.is_onboarded || localStorage.getItem('saldoku_onboarded_' + user.uid);
  if (alreadyOnboarded) return;

  const existingTabungan = getUserTabungan();
  if (existingTabungan && existingTabungan.length > 0) {
    markUserOnboarded(user);
    return;
  }

  // Set invite code display in modal
  const inviteCodeElem = document.getElementById('onboarding-invite-code-display');
  const inviteCode = user.inviteCode || user.features?.invite_code || 'SLD-NEW';
  if (inviteCodeElem) inviteCodeElem.textContent = inviteCode;

  // Auto-format currency inputs inside modal
  const inputBank = document.getElementById('onboarding-saldo-bank');
  const inputTunai = document.getElementById('onboarding-saldo-tunai');

  [inputBank, inputTunai].forEach(input => {
    if (input) {
      input.addEventListener('input', (e) => {
        const val = parseRupiah(e.target.value);
        e.target.value = val === 0 ? '' : new Intl.NumberFormat('id-ID').format(val);
      });
    }
  });

  // Show modal
  modal.classList.remove('hidden');

  // Skip button handler
  const btnSkip = document.getElementById('btn-skip-onboarding');
  if (btnSkip) {
    btnSkip.onclick = () => {
      markUserOnboarded(user);
      modal.classList.add('hidden');
      showToast('Dompet kas Anda siap digunakan!', 'info');
    };
  }

  // Form submit handler
  const form = document.getElementById('form-onboarding-saldo');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const valBank = parseRupiah(inputBank ? inputBank.value : 0);
      const valTunai = parseRupiah(inputTunai ? inputTunai.value : 0);

      const today = getTodayString();
      if (valBank > 0) {
        await addTabunganTransaction(user.uid, valBank, 'Saldo Awal Rekening Bank', today, 'kas', 'rekening');
      }
      if (valTunai > 0) {
        await addTabunganTransaction(user.uid, valTunai, 'Saldo Awal Uang Tunai', today, 'kas', 'tunai');
      }

      markUserOnboarded(user);
      modal.classList.add('hidden');
      showToast('Saldo awal berhasil disimpan!', 'success');
      loadDashboardMetrics(user.uid);
    };
  }
}

function markUserOnboarded(user) {
  user.isOnboarded = true;
  if (!user.features) user.features = {};
  user.features.is_onboarded = true;
  localStorage.setItem('saldoku_onboarded_' + user.uid, 'true');
  setCurrentUser(user);
  if (typeof window.syncUserToSupabaseCloud === 'function') {
    window.syncUserToSupabaseCloud(user);
  }
}

/**
 * Applies modular feature visibility based on admin settings
 */
function applyDashboardFeatureFlags(user) {
  if (!user) user = getCurrentUser();
  if (!user) return;

  const isDebtEnabled = isFeatureEnabled('debt_ledger', user);
  const isSplitEnabled = isFeatureEnabled('cash_bank_split', user);
  const isDualPocketEnabled = isFeatureEnabled('dual_pocket', user);

  // 1. Debt feature widget
  const debtWidgets = document.querySelectorAll('[data-debt-feature="true"]');
  debtWidgets.forEach(w => {
    if (isDebtEnabled) {
      w.classList.remove('hidden');
    } else {
      w.classList.add('hidden');
    }
  });

  // 2. Hide navigation links to hutang.html if debt is disabled
  if (!isDebtEnabled) {
    document.querySelectorAll('a[href="hutang.html"]').forEach(el => {
      el.style.display = 'none';
    });
  }

  // 3. Sub-breakdown Rekening vs Tunai
  if (!isSplitEnabled) {
    document.querySelectorAll('[id^="sub-"]').forEach(el => {
      const container = el.closest('.border-t');
      if (container) container.classList.add('hidden');
    });
  }

  // 4. Dual-Pocket visibility (Kas vs Tabungan)
  const btnTransfer = document.getElementById('btn-open-modal-transfer');
  if (btnTransfer) {
    if (isDualPocketEnabled) {
      btnTransfer.style.removeProperty('display');
    } else {
      btnTransfer.style.display = 'none';
    }
  }

  // In single-pocket mode, hide secondary tabungan card
  const valTabungan = document.getElementById('val-saldo-tabungan');
  if (valTabungan) {
    const cardTab = valTabungan.closest('.stat-card') || valTabungan.closest('.rounded-2xl') || valTabungan.closest('.p-4');
    if (cardTab) {
      if (isDualPocketEnabled) {
        cardTab.style.removeProperty('display');
      } else {
        cardTab.style.display = 'none';
      }
    }
  }
}
window.applyDashboardFeatureFlags = applyDashboardFeatureFlags;

// Dynamic listener for realtime feature changes by Super Admin
window.addEventListener('saldoku_features_updated', (e) => {
  const currentUser = getCurrentUser();
  if (currentUser) {
    currentUser.features = e.detail;
    applyDashboardFeatureFlags(currentUser);
  }
});

/**
 * Update Ringkasan Hutang Bersih (Iwan ⇄ Wadda)
 */
function updateDashboardDebtSummary(debtEntries) {
  const valDebtElem = document.getElementById('val-dashboard-debt');
  const badgeDebtElem = document.getElementById('badge-dashboard-debt');
  if (!valDebtElem || !window.DebtEngine) return;

  const net = window.DebtEngine.calculateNet(debtEntries);
  const desc = window.DebtEngine.describePosition(net);

  valDebtElem.textContent = desc.text;
  if (desc.status === 'debt_a') {
    valDebtElem.className = 'text-base sm:text-lg font-bold text-rose-400 mt-0.5 font-mono';
  } else if (desc.status === 'debt_b') {
    valDebtElem.className = 'text-base sm:text-lg font-bold text-amber-400 mt-0.5 font-mono';
  } else {
    valDebtElem.className = 'text-base sm:text-lg font-bold text-emerald-400 mt-0.5 font-mono';
  }

  if (badgeDebtElem) {
    badgeDebtElem.className = `px-2 py-0.5 text-[10px] font-bold rounded-full border ${desc.badgeClass}`;
    badgeDebtElem.textContent = desc.shortText;
  }
}

/**
 * Memuat dan mengkalkulasi metrik keuangan Akun Bersama
 */
function loadDashboardMetrics(userId) {
  const stats = calculateUserBalance(userId);
  const transactions = getAllTransactions(userId);

  // 1. Update Card 1: Kas Siap Pakai Bersama
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

  // Sub-breakdown Card 1 (Kas Bank vs Tunai)
  const subKasRekening = document.getElementById('sub-kas-rekening');
  const subKasTunai = document.getElementById('sub-kas-tunai');
  if (subKasRekening) subKasRekening.textContent = formatRupiah(stats.kasRekening);
  if (subKasTunai) subKasTunai.textContent = formatRupiah(stats.kasTunai);

  // 2. Update Card 2: Tabungan Bersama
  const valTabungan = document.getElementById('val-saldo-tabungan');
  if (valTabungan) valTabungan.textContent = formatRupiah(stats.saldoTabungan);

  // Sub-breakdown Card 2 (Tabungan Bank vs Tunai)
  const subTabunganRekening = document.getElementById('sub-tabungan-rekening');
  const subTabunganTunai = document.getElementById('sub-tabungan-tunai');
  if (subTabunganRekening) subTabunganRekening.textContent = formatRupiah(stats.tabunganRekening);
  if (subTabunganTunai) subTabunganTunai.textContent = formatRupiah(stats.tabunganTunai);

  // 3. Update Card 3: Total Aset Bersama
  const valAset = document.getElementById('val-total-aset');
  if (valAset) valAset.textContent = formatRupiah(stats.totalAset);

  // Sub-breakdown Card 3 (Total Bank vs Total Tunai)
  const subTotalRekening = document.getElementById('sub-total-rekening');
  const subTotalTunai = document.getElementById('sub-total-tunai');
  if (subTotalRekening) subTotalRekening.textContent = formatRupiah(stats.totalRekening);
  if (subTotalTunai) subTotalTunai.textContent = formatRupiah(stats.totalTunai);

  // 4. Update Card 4: Total Pengeluaran Bersama
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

  // 7. Update Category Expense Analysis & Interactive Chart
  loadCategoryExpenseAnalysis();

  // 8. Render Transactions
  renderDashboardTransactions(transactions);
}

// --------------------------------------------------------------------------
// Category Expense Analysis & Interactive Chart.js Implementation
// --------------------------------------------------------------------------
function normalizeCategoryName(rawCategory) {
  if (!rawCategory) return 'Lainnya';
  const lower = rawCategory.toLowerCase().trim();
  if (lower.includes('bensin') || lower.includes('transport') || lower.includes('bbm') || lower.includes('bahan bakar')) {
    return 'Bensin & Transportasi';
  }
  if (lower.includes('makan') || lower.includes('minum') || lower.includes('kuliner') || lower.includes('snack')) {
    return 'Makanan & Minuman';
  }
  if (lower.includes('belanja') || lower.includes('sembako') || lower.includes('pasar') || lower.includes('kebutuhan') || lower.includes('dapur')) {
    return 'Belanja Kebutuhan';
  }
  if (lower.includes('tagihan') || lower.includes('listrik') || lower.includes('air') || lower.includes('wifi') || lower.includes('pulsa') || lower.includes('utilitas')) {
    return 'Tagihan & Utilitas';
  }
  if (lower.includes('darurat') || lower.includes('medis') || lower.includes('obat') || lower.includes('dokter') || lower.includes('sehat')) {
    return 'Kesehatan & Medis';
  }
  if (lower.includes('hiburan') || lower.includes('nonton') || lower.includes('rekreasi') || lower.includes('game') || lower.includes('liburan')) {
    return 'Hiburan & Rekreasi';
  }
  if (lower.includes('pindah dana')) {
    return 'Pindah Dana';
  }
  return rawCategory;
}

function getCategoryConfig(name) {
  const configs = {
    'Bensin & Transportasi': {
      color: '#06b6d4', // Cyan
      barClass: 'bg-cyan-500',
      badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
      icon: `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`
    },
    'Makanan & Minuman': {
      color: '#f59e0b', // Amber
      barClass: 'bg-amber-500',
      badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
      icon: `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`
    },
    'Belanja Kebutuhan': {
      color: '#10b981', // Emerald
      barClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
      icon: `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>`
    },
    'Tagihan & Utilitas': {
      color: '#6366f1', // Indigo
      barClass: 'bg-indigo-500',
      badgeClass: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
      icon: `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`
    },
    'Kesehatan & Medis': {
      color: '#ec4899', // Pink
      barClass: 'bg-pink-500',
      badgeClass: 'bg-pink-500/10 text-pink-300 border-pink-500/25',
      icon: `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`
    },
    'Hiburan & Rekreasi': {
      color: '#8b5cf6', // Violet
      barClass: 'bg-violet-500',
      badgeClass: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
      icon: `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    },
    'Pindah Dana': {
      color: '#64748b', // Slate
      barClass: 'bg-slate-500',
      badgeClass: 'bg-slate-500/10 text-slate-300 border-slate-500/25',
      icon: `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>`
    },
    'Lainnya': {
      color: '#38bdf8', // Sky
      barClass: 'bg-sky-500',
      badgeClass: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
      icon: `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"/></svg>`
    }
  };

  return configs[name] || {
    color: '#0284c7',
    barClass: 'bg-blue-600',
    badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
    icon: `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>`
  };
}

function loadCategoryExpenseAnalysis() {
  const allExpenses = getUserBelanja(); // returns Akun Bersama expenses
  const selectPeriod = document.getElementById('select-bulan-kategori');
  
  if (selectPeriod && selectPeriod.options.length === 0) {
    populateMonthOptions(selectPeriod, allExpenses);
    selectPeriod.addEventListener('change', (e) => {
      selectedExpenseMonth = e.target.value;
      activeCategoryFilter = null;
      renderCategoryAnalysisUI();
      renderDashboardTransactions(getAllTransactions());
    });
  }

  renderCategoryAnalysisUI();
}

function populateMonthOptions(selectElement, expenses) {
  const monthMap = new Map();
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  monthMap.set('current', `Bulan Ini (${monthNames[now.getMonth()]} ${now.getFullYear()})`);

  expenses.forEach(item => {
    if (item.tanggal) {
      const parts = item.tanggal.split('-');
      if (parts.length >= 2) {
        const key = `${parts[0]}-${parts[1]}`;
        if (!monthMap.has(key)) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const name = `${monthNames[m] || parts[1]} ${y}`;
          monthMap.set(key, name);
        }
      }
    }
  });

  monthMap.set('all', 'Semua Riwayat (Akumulatif)');

  selectElement.innerHTML = '';
  monthMap.forEach((label, val) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    if (val === selectedExpenseMonth) opt.selected = true;
    selectElement.appendChild(opt);
  });
}

function renderCategoryAnalysisUI() {
  const allExpenses = getUserBelanja();
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const filtered = allExpenses.filter(item => {
    // Exclude internal transfers
    const norm = normalizeCategoryName(item.kategori);
    if (norm === 'Pindah Dana') return false;

    if (selectedExpenseMonth === 'all') return true;
    const targetYM = selectedExpenseMonth === 'current' ? currentYearMonth : selectedExpenseMonth;
    if (!item.tanggal) return false;
    return item.tanggal.startsWith(targetYM);
  });

  const categoryTotals = {};
  let totalSpent = 0;

  filtered.forEach(item => {
    const cat = normalizeCategoryName(item.kategori);
    const amt = Number(item.jumlah || 0);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    totalSpent += amt;
  });

  const sortedCategories = Object.keys(categoryTotals)
    .map(name => ({
      name,
      amount: categoryTotals[name],
      percent: totalSpent > 0 ? Math.round((categoryTotals[name] / totalSpent) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const containerContent = document.getElementById('container-kategori-content');
  const emptyState = document.getElementById('empty-state-kategori');
  const badgeTotalMonth = document.getElementById('badge-total-kategori-bulan');
  const centerTotal = document.getElementById('donut-center-total');
  const centerTop = document.getElementById('donut-center-top');
  const centerLabel = document.getElementById('donut-center-label');

  if (badgeTotalMonth) badgeTotalMonth.textContent = formatRupiah(totalSpent);
  if (centerTotal) centerTotal.textContent = formatRupiah(totalSpent);

  if (centerLabel) {
    if (selectedExpenseMonth === 'current') centerLabel.textContent = 'Bulan Ini';
    else if (selectedExpenseMonth === 'all') centerLabel.textContent = 'Semua';
    else centerLabel.textContent = 'Periode';
  }

  if (centerTop) {
    centerTop.textContent = sortedCategories.length > 0 ? sortedCategories[0].name : '-';
  }

  if (sortedCategories.length === 0) {
    if (containerContent) containerContent.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    destroyDashboardCategoryChart();
    return;
  }

  if (containerContent) containerContent.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');

  renderDashboardCategoryDonutChart(sortedCategories);
  renderDashboardCategoryProgressBars(sortedCategories, totalSpent);
}

function destroyDashboardCategoryChart() {
  if (dashboardCategoryChart) {
    dashboardCategoryChart.destroy();
    dashboardCategoryChart = null;
  }
}

function renderDashboardCategoryDonutChart(categories) {
  const canvas = document.getElementById('chart-kategori-pengeluaran');
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = categories.map(c => c.name);
  const data = categories.map(c => c.amount);
  const bgColors = categories.map(c => getCategoryConfig(c.name).color);

  destroyDashboardCategoryChart();

  const ctx = canvas.getContext('2d');
  dashboardCategoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: bgColors,
        borderColor: '#0c1427',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#090f20',
          borderColor: '#1e293b',
          borderWidth: 1,
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            label: function(context) {
              const val = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return ` ${context.label}: ${formatRupiah(val)} (${pct}%)`;
            }
          }
        }
      },
      onClick: (e, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const selectedCat = labels[idx];
          toggleDashboardCategoryFilter(selectedCat);
        }
      }
    }
  });
}

function renderDashboardCategoryProgressBars(categories, totalSpent) {
  const container = document.getElementById('list-kategori-progress');
  if (!container) return;

  let html = '';
  categories.forEach(item => {
    const conf = getCategoryConfig(item.name);
    const isSelected = activeCategoryFilter === item.name;
    const activeRing = isSelected ? 'ring-2 ring-blue-500 bg-blue-500/10' : 'hover:bg-slate-800/40';

    html += `
      <div class="p-2.5 rounded-xl border border-slate-800/80 bg-[#080d1a]/60 transition-all cursor-pointer ${activeRing} group"
           onclick="toggleDashboardCategoryFilter('${item.name}')">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <div class="flex items-center gap-2 min-w-0">
            <span class="p-1 rounded-lg ${conf.badgeClass} flex-shrink-0">
              ${conf.icon}
            </span>
            <span class="font-bold text-white truncate group-hover:text-blue-300 transition-colors">${item.name}</span>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0 font-mono">
            <span class="text-slate-400 text-[11px]">${item.percent}%</span>
            <span class="font-bold text-white text-xs">${formatRupiah(item.amount)}</span>
          </div>
        </div>
        <div class="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
          <div class="h-full ${conf.barClass} rounded-full transition-all duration-500" style="width: ${item.percent}%;"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function toggleDashboardCategoryFilter(categoryName) {
  if (activeCategoryFilter === categoryName) {
    activeCategoryFilter = null;
  } else {
    activeCategoryFilter = categoryName;
  }
  renderDashboardCategoryProgressBarsUI();
  renderDashboardTransactions(getAllTransactions());
  
  if (activeCategoryFilter) {
    const trxSection = document.getElementById('recent-transactions-list');
    if (trxSection) {
      trxSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}
window.toggleDashboardCategoryFilter = toggleDashboardCategoryFilter;

function renderDashboardCategoryProgressBarsUI() {
  const allExpenses = getUserBelanja();
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const filtered = allExpenses.filter(item => {
    const norm = normalizeCategoryName(item.kategori);
    if (norm === 'Pindah Dana') return false;

    if (selectedExpenseMonth === 'all') return true;
    const targetYM = selectedExpenseMonth === 'current' ? currentYearMonth : selectedExpenseMonth;
    if (!item.tanggal) return false;
    return item.tanggal.startsWith(targetYM);
  });

  const categoryTotals = {};
  let totalSpent = 0;

  filtered.forEach(item => {
    const cat = normalizeCategoryName(item.kategori);
    const amt = Number(item.jumlah || 0);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    totalSpent += amt;
  });

  const sortedCategories = Object.keys(categoryTotals)
    .map(name => ({
      name,
      amount: categoryTotals[name],
      percent: totalSpent > 0 ? Math.round((categoryTotals[name] / totalSpent) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  renderDashboardCategoryProgressBars(sortedCategories, totalSpent);
}

// --------------------------------------------------------------------------
// Transaction Filters & History Rendering
// --------------------------------------------------------------------------
function initTransactionFilters() {
  const btnAll = document.getElementById('filter-all');
  const btnKas = document.getElementById('filter-kas');
  const btnTabungan = document.getElementById('filter-tabungan');
  const btnClearCategory = document.getElementById('btn-clear-category-filter');

  function setFilter(type) {
    activeTransactionFilter = type;
    [btnAll, btnKas, btnTabungan].forEach(b => {
      if (!b) return;
      b.className = 'btn-filter px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition-all cursor-pointer';
    });

    if (type === 'all' && btnAll) {
      btnAll.className = 'btn-filter px-3 py-1.5 rounded-lg font-bold transition-all bg-blue-600 text-white cursor-pointer';
    } else if (type === 'kas' && btnKas) {
      btnKas.className = 'btn-filter px-3 py-1.5 rounded-lg font-bold transition-all bg-cyan-600 text-white cursor-pointer';
    } else if (type === 'tabungan' && btnTabungan) {
      btnTabungan.className = 'btn-filter px-3 py-1.5 rounded-lg font-bold transition-all bg-emerald-600 text-white cursor-pointer';
    }

    renderDashboardTransactions(getAllTransactions());
  }

  if (btnAll) btnAll.addEventListener('click', () => setFilter('all'));
  if (btnKas) btnKas.addEventListener('click', () => setFilter('kas'));
  if (btnTabungan) btnTabungan.addEventListener('click', () => setFilter('tabungan'));

  if (btnClearCategory) {
    btnClearCategory.addEventListener('click', () => {
      activeCategoryFilter = null;
      renderDashboardCategoryProgressBarsUI();
      renderDashboardTransactions(getAllTransactions());
    });
  }
}

/**
 * Render Riwayat Transaksi Akun Bersama
 */
function renderDashboardTransactions(allList) {
  const container = document.getElementById('recent-transactions-list');
  if (!container) return;

  // Filter based on active pocket filter (all / kas / tabungan)
  let filtered = allList;
  if (activeTransactionFilter === 'kas') {
    filtered = allList.filter(t => t.pocket === 'kas');
  } else if (activeTransactionFilter === 'tabungan') {
    filtered = allList.filter(t => t.pocket === 'tabungan');
  }

  // Filter based on active category filter
  const categoryBanner = document.getElementById('badge-active-category-filter');
  const categoryNameEl = document.getElementById('name-active-category');

  if (activeCategoryFilter) {
    filtered = filtered.filter(t => {
      if (t.type !== 'belanja') return false;
      return normalizeCategoryName(t.kategori) === activeCategoryFilter;
    });
    if (categoryBanner) {
      categoryBanner.classList.remove('hidden');
      if (categoryNameEl) categoryNameEl.textContent = activeCategoryFilter;
    }
  } else {
    if (categoryBanner) categoryBanner.classList.add('hidden');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <div class="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 mx-auto flex items-center justify-center mb-2.5">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p class="text-xs font-semibold text-slate-300">Belum ada riwayat transaksi${activeCategoryFilter ? ' untuk kategori ini' : ''}</p>
        <p class="text-[11px] text-slate-500 mt-0.5">Catatan mutasi kas dan simpanan bersama akan tampil di sini.</p>
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
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 font-mono">Kas</span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-mono">Tabungan</span>`;

    // Wadah Badge (Rekening vs Tunai)
    const isTunai = t.wadah === 'tunai';
    const wadahBadge = isTunai
      ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">Tunai</span>`
      : `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300 font-mono">Bank</span>`;

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
              ${wadahBadge}
              ${t.kategori ? `<span class="text-[10px] text-slate-500 hidden sm:inline">• ${t.kategori}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div class="text-right">
            <span class="text-xs sm:text-sm font-black font-mono ${amountColor}">${sign} ${formatRupiah(t.amount)}</span>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" data-edit-id="${t.id}" data-edit-type="${t.type}" title="Edit Transaksi" 
                    class="btn-edit-transaksi p-1.5 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors cursor-pointer">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button type="button" data-del-id="${t.id}" data-del-type="${t.type}" title="Hapus Transaksi" 
                    class="btn-delete-transaksi p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Bind Edit buttons
  container.querySelectorAll('.btn-edit-transaksi').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-id');
      const type = btn.getAttribute('data-edit-type');
      openDashboardEditModal(id, type);
    });
  });

  // Bind Delete buttons
  container.querySelectorAll('.btn-delete-transaksi').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-id');
      const type = btn.getAttribute('data-del-type');
      if (confirm('Hapus transaksi bersama ini?')) {
        await deleteTransactionItem(id, type);
        showToast('Transaksi berhasil dihapus.', 'info');
        loadDashboardMetrics();
      }
    });
  });
}

/**
 * Inisialisasi 4 Modal Interaktif: Pemasukan, Pengeluaran, Pindah Dana, Edit
 */
function initDashboardModals(user) {
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
  // MODAL 1: CATAT PEMASUKAN BERSAMA
  // ------------------------------------------------------------------------
  const btnOpenPemasukan = document.getElementById('btn-open-modal-pemasukan');
  const btnClosePemasukan = document.getElementById('btn-close-modal-pemasukan');
  const formPemasukan = document.getElementById('form-modal-pemasukan');
  const inputNominalIn = document.getElementById('pemasukan-nominal');
  const inputKeteranganIn = document.getElementById('pemasukan-keterangan');
  const inputTanggalIn = document.getElementById('pemasukan-tanggal');
  const inputKantongIn = document.getElementById('pemasukan-kantong');
  const inputWadahIn = document.getElementById('pemasukan-wadah');
  const btnAlokasiKas = document.getElementById('btn-alokasi-kas');
  const btnAlokasiTabungan = document.getElementById('btn-alokasi-tabungan');
  const btnWadahInRekening = document.getElementById('btn-wadah-in-rekening');
  const btnWadahInTunai = document.getElementById('btn-wadah-in-tunai');
  const hintPemasukan = document.getElementById('pemasukan-kantong-hint');

  if (inputTanggalIn) inputTanggalIn.value = getTodayString();

  if (btnOpenPemasukan) {
    btnOpenPemasukan.addEventListener('click', () => {
      if (inputTanggalIn) inputTanggalIn.value = getTodayString();
      setWadahIn('rekening');
      toggleModal('modal-pemasukan', true);
    });
  }

  if (btnClosePemasukan) {
    btnClosePemasukan.addEventListener('click', () => toggleModal('modal-pemasukan', false));
  }

  // Toggle Kantong Tujuan (Kas vs Tabungan)
  function setAlokasiPemasukan(target) {
    if (inputKantongIn) inputKantongIn.value = target;
    if (target === 'kas') {
      btnAlokasiKas.className = 'py-2.5 px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnAlokasiTabungan.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnAlokasiKas.querySelector('span').className = 'w-2 h-2 rounded-full bg-cyan-400';
      btnAlokasiTabungan.querySelector('span').className = 'w-2 h-2 rounded-full bg-slate-600';
      if (hintPemasukan) hintPemasukan.textContent = 'Dana masuk langsung menambah Kas Siap Pakai bersama.';
    } else {
      btnAlokasiTabungan.className = 'py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnAlokasiKas.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnAlokasiTabungan.querySelector('span').className = 'w-2 h-2 rounded-full bg-emerald-400';
      btnAlokasiKas.querySelector('span').className = 'w-2 h-2 rounded-full bg-slate-600';
      if (hintPemasukan) hintPemasukan.textContent = 'Dana masuk langsung dialokasikan ke Tabungan Bersama aman.';
    }
  }

  // Toggle Wadah Pemasukan (Rekening vs Tunai)
  function setWadahIn(target) {
    if (inputWadahIn) inputWadahIn.value = target;
    if (target === 'rekening') {
      btnWadahInRekening.className = 'py-2 px-3 rounded-xl border border-indigo-500/40 bg-indigo-500/20 text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnWadahInTunai.className = 'py-2 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
    } else {
      btnWadahInTunai.className = 'py-2 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnWadahInRekening.className = 'py-2 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
    }
  }

  if (btnAlokasiKas) btnAlokasiKas.addEventListener('click', () => setAlokasiPemasukan('kas'));
  if (btnAlokasiTabungan) btnAlokasiTabungan.addEventListener('click', () => setAlokasiPemasukan('tabungan'));
  if (btnWadahInRekening) btnWadahInRekening.addEventListener('click', () => setWadahIn('rekening'));
  if (btnWadahInTunai) btnWadahInTunai.addEventListener('click', () => setWadahIn('tunai'));

  // Preset Buttons
  document.querySelectorAll('.btn-preset-in').forEach(btn => {
    btn.addEventListener('click', () => {
      const add = parseInt(btn.getAttribute('data-preset') || '0', 10);
      const current = parseRupiah(inputNominalIn.value) || 0;
      inputNominalIn.value = new Intl.NumberFormat('id-ID').format(current + add);
    });
  });

  // Rupiah formatting on typing
  if (inputNominalIn) {
    inputNominalIn.addEventListener('input', (e) => {
      const numeric = parseRupiah(e.target.value);
      e.target.value = numeric ? new Intl.NumberFormat('id-ID').format(numeric) : '';
    });
  }

  if (formPemasukan) {
    formPemasukan.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nominal = parseRupiah(inputNominalIn.value);
      const keterangan = inputKeteranganIn.value.trim() || 'Pemasukan Kas Bersama';
      const tanggal = inputTanggalIn.value || getTodayString();
      const kantong = inputKantongIn ? inputKantongIn.value : 'kas';
      const wadah = inputWadahIn ? inputWadahIn.value : 'rekening';

      if (!nominal || nominal <= 0) {
        showToast('Nominal harus lebih dari 0.', 'error');
        return;
      }

      await addTabunganTransaction(user.uid, nominal, keterangan, tanggal, kantong, wadah);
      showToast(`Pemasukan ${formatRupiah(nominal)} berhasil dicatat ke ${kantong === 'kas' ? 'Kas Siap Pakai' : 'Tabungan Bersama'}.`, 'success');

      formPemasukan.reset();
      inputNominalIn.value = '';
      if (inputTanggalIn) inputTanggalIn.value = getTodayString();
      setAlokasiPemasukan('kas');
      setWadahIn('rekening');
      toggleModal('modal-pemasukan', false);
      loadDashboardMetrics();
    });
  }

  // ------------------------------------------------------------------------
  // MODAL 2: CATAT PENGELUARAN BERSAMA
  // ------------------------------------------------------------------------
  const btnOpenPengeluaran = document.getElementById('btn-open-modal-pengeluaran');
  const btnClosePengeluaran = document.getElementById('btn-close-modal-pengeluaran');
  const formPengeluaran = document.getElementById('form-modal-pengeluaran');
  const inputNominalOut = document.getElementById('pengeluaran-nominal');
  const inputNamaOut = document.getElementById('pengeluaran-nama');
  const selectKategoriOut = document.getElementById('pengeluaran-kategori');
  const inputTanggalOut = document.getElementById('pengeluaran-tanggal');
  const inputKantongOut = document.getElementById('pengeluaran-kantong');
  const inputWadahOut = document.getElementById('pengeluaran-wadah');
  const btnOutKas = document.getElementById('btn-out-kas');
  const btnOutTabungan = document.getElementById('btn-out-tabungan');
  const btnWadahOutRekening = document.getElementById('btn-wadah-out-rekening');
  const btnWadahOutTunai = document.getElementById('btn-wadah-out-tunai');
  const hintPengeluaran = document.getElementById('pengeluaran-kantong-hint');
  const warningSaldo = document.getElementById('warning-saldo-kurang');

  if (inputTanggalOut) inputTanggalOut.value = getTodayString();

  if (btnOpenPengeluaran) {
    btnOpenPengeluaran.addEventListener('click', () => {
      if (inputTanggalOut) inputTanggalOut.value = getTodayString();
      setWadahOut('rekening');
      toggleModal('modal-pengeluaran', true);
    });
  }

  if (btnClosePengeluaran) {
    btnClosePengeluaran.addEventListener('click', () => toggleModal('modal-pengeluaran', false));
  }

  function setSumberPengeluaran(target) {
    if (inputKantongOut) inputKantongOut.value = target;
    if (target === 'kas') {
      btnOutKas.className = 'py-2.5 px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      btnOutTabungan.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      btnOutKas.querySelector('span span').className = 'w-2 h-2 rounded-full bg-cyan-400';
      btnOutTabungan.querySelector('span span').className = 'w-2 h-2 rounded-full bg-slate-600';
      if (hintPengeluaran) hintPengeluaran.textContent = 'Pengeluaran bersama dipotong dari Kas Siap Pakai.';
    } else {
      btnOutTabungan.className = 'py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      btnOutKas.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      btnOutTabungan.querySelector('span span').className = 'w-2 h-2 rounded-full bg-emerald-400';
      btnOutKas.querySelector('span span').className = 'w-2 h-2 rounded-full bg-slate-600';
      if (hintPengeluaran) hintPengeluaran.textContent = 'Pengeluaran besar khusus yang diambil langsung dari Tabungan Bersama.';
    }
    checkDefisitWarning();
  }

  function setWadahOut(target) {
    if (inputWadahOut) inputWadahOut.value = target;
    if (target === 'rekening') {
      btnWadahOutRekening.className = 'py-2 px-3 rounded-xl border border-indigo-500/40 bg-indigo-500/20 text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnWadahOutTunai.className = 'py-2 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
    } else {
      btnWadahOutTunai.className = 'py-2 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnWadahOutRekening.className = 'py-2 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
    }
  }

  if (btnOutKas) btnOutKas.addEventListener('click', () => setSumberPengeluaran('kas'));
  if (btnOutTabungan) btnOutTabungan.addEventListener('click', () => setSumberPengeluaran('tabungan'));
  if (btnWadahOutRekening) btnWadahOutRekening.addEventListener('click', () => setWadahOut('rekening'));
  if (btnWadahOutTunai) btnWadahOutTunai.addEventListener('click', () => setWadahOut('tunai'));

  function checkDefisitWarning() {
    if (!warningSaldo || !inputNominalOut) return;
    const nominal = parseRupiah(inputNominalOut.value) || 0;
    const stats = calculateUserBalance();
    const kantong = inputKantongOut ? inputKantongOut.value : 'kas';
    const avail = kantong === 'kas' ? stats.saldoKas : stats.saldoTabungan;

    if (nominal > avail && avail >= 0) {
      warningSaldo.classList.remove('hidden');
      warningSaldo.textContent = `Perhatian: Nominal melebihi saldo ${kantong === 'kas' ? 'Kas Siap Pakai' : 'Tabungan'} (${formatRupiah(avail)}).`;
    } else {
      warningSaldo.classList.add('hidden');
    }
  }

  if (inputNominalOut) {
    inputNominalOut.addEventListener('input', (e) => {
      const numeric = parseRupiah(e.target.value);
      e.target.value = numeric ? new Intl.NumberFormat('id-ID').format(numeric) : '';
      checkDefisitWarning();
    });
  }

  if (formPengeluaran) {
    formPengeluaran.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = inputNamaOut.value.trim();
      const nominal = parseRupiah(inputNominalOut.value);
      const kategori = selectKategoriOut.value || 'Umum';
      const tanggal = inputTanggalOut.value || getTodayString();
      const kantong = inputKantongOut ? inputKantongOut.value : 'kas';
      const wadah = inputWadahOut ? inputWadahOut.value : 'rekening';

      if (!nama) {
        showToast('Nama barang / keperluan harus diisi.', 'error');
        return;
      }
      if (!nominal || nominal <= 0) {
        showToast('Nominal harus lebih dari 0.', 'error');
        return;
      }

      await addBelanjaTransaction(user.uid, nama, nominal, kategori, tanggal, kantong, wadah);
      showToast(`Pengeluaran "${nama}" ${formatRupiah(nominal)} berhasil dicatat.`, 'success');

      formPengeluaran.reset();
      inputNominalOut.value = '';
      if (inputTanggalOut) inputTanggalOut.value = getTodayString();
      setSumberPengeluaran('kas');
      setWadahOut('rekening');
      toggleModal('modal-pengeluaran', false);
      loadDashboardMetrics();
    });
  }

  // ------------------------------------------------------------------------
  // MODAL 3: PINDAH DANA / TRANSFER ANTAR KANTONG / TARIK TUNAI / SETOR
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

      const stats = calculateUserBalance();
      let dariKantong = 'kas';
      let keKantong = 'tabungan';
      let dariWadah = 'rekening';
      let keWadah = 'rekening';
      let toastMsg = '';

      if (arah === 'kas_to_tabungan') {
        dariKantong = 'kas';
        keKantong = 'tabungan';
        dariWadah = 'rekening';
        keWadah = 'rekening';
        if (nominal > stats.saldoKas) {
          showToast(`Saldo Kas Siap Pakai tidak mencukupi untuk transfer!`, 'error');
          return;
        }
        toastMsg = `Pindah dana ${formatRupiah(nominal)} dari Kas ke Tabungan Bersama berhasil.`;
      } else if (arah === 'tabungan_to_kas') {
        dariKantong = 'tabungan';
        keKantong = 'kas';
        dariWadah = 'rekening';
        keWadah = 'rekening';
        if (nominal > stats.saldoTabungan) {
          showToast(`Saldo Tabungan Bersama tidak mencukupi untuk transfer!`, 'error');
          return;
        }
        toastMsg = `Pencairan dana ${formatRupiah(nominal)} dari Tabungan ke Kas berhasil.`;
      } else if (arah === 'tarik_tunai') {
        dariKantong = 'kas';
        keKantong = 'kas';
        dariWadah = 'rekening';
        keWadah = 'tunai';
        if (nominal > stats.totalRekening) {
          showToast(`Saldo Bank (${formatRupiah(stats.totalRekening)}) tidak mencukupi untuk tarik tunai!`, 'error');
          return;
        }
        toastMsg = `Tarik tunai ATM ${formatRupiah(nominal)} (Bank ➔ Tunai) berhasil dicatat.`;
      } else if (arah === 'setor_tunai') {
        dariKantong = 'kas';
        keKantong = 'kas';
        dariWadah = 'tunai';
        keWadah = 'rekening';
        if (nominal > stats.totalTunai) {
          showToast(`Uang tunai fisik (${formatRupiah(stats.totalTunai)}) tidak mencukupi untuk disetor!`, 'error');
          return;
        }
        toastMsg = `Setor tunai ${formatRupiah(nominal)} (Tunai ➔ Bank) berhasil dicatat.`;
      }

      await transferAntarKantong(user.uid, dariKantong, keKantong, nominal, catatan, getTodayString(), dariWadah, keWadah);
      showToast(toastMsg, 'success');

      formTransfer.reset();
      inputNominalTransfer.value = '';
      toggleModal('modal-transfer', false);
      loadDashboardMetrics();
    });
  }

  // ------------------------------------------------------------------------
  // MODAL 4: EDIT TRANSAKSI (DYNAMIC, FAST & REALTIME)
  // ------------------------------------------------------------------------
  const formEdit = document.getElementById('form-modal-edit');
  const btnCloseEdit = document.getElementById('btn-close-modal-edit');
  const btnCancelEdit = document.getElementById('btn-cancel-modal-edit');
  const inputNominalEdit = document.getElementById('edit-nominal');
  const inputKantongEdit = document.getElementById('edit-kantong');
  const inputWadahEdit = document.getElementById('edit-wadah');
  const btnEditKas = document.getElementById('btn-edit-kantong-kas');
  const btnEditTab = document.getElementById('btn-edit-kantong-tabungan');
  const btnEditWadahRek = document.getElementById('btn-edit-wadah-rekening');
  const btnEditWadahTun = document.getElementById('btn-edit-wadah-tunai');

  function setEditKantong(pocket) {
    if (inputKantongEdit) inputKantongEdit.value = pocket;
    if (btnEditKas && btnEditTab) {
      if (pocket === 'kas') {
        btnEditKas.className = 'py-2.5 px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
        btnEditTab.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
        btnEditKas.querySelector('span').className = 'w-2 h-2 rounded-full bg-cyan-400';
        btnEditTab.querySelector('span').className = 'w-2 h-2 rounded-full bg-slate-600';
      } else {
        btnEditTab.className = 'py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
        btnEditKas.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
        btnEditTab.querySelector('span').className = 'w-2 h-2 rounded-full bg-emerald-400';
        btnEditKas.querySelector('span').className = 'w-2 h-2 rounded-full bg-slate-600';
      }
    }
  }

  function setEditWadah(wadah) {
    if (inputWadahEdit) inputWadahEdit.value = wadah;
    if (btnEditWadahRek && btnEditWadahTun) {
      if (wadah === 'rekening') {
        btnEditWadahRek.className = 'py-2 px-3 rounded-xl border border-indigo-500/40 bg-indigo-500/20 text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
        btnEditWadahTun.className = 'py-2 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
      } else {
        btnEditWadahTun.className = 'py-2 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
        btnEditWadahRek.className = 'py-2 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
      }
    }
  }

  if (btnEditKas) btnEditKas.addEventListener('click', () => setEditKantong('kas'));
  if (btnEditTab) btnEditTab.addEventListener('click', () => setEditKantong('tabungan'));
  if (btnEditWadahRek) btnEditWadahRek.addEventListener('click', () => setEditWadah('rekening'));
  if (btnEditWadahTun) btnEditWadahTun.addEventListener('click', () => setEditWadah('tunai'));

  if (btnCloseEdit) btnCloseEdit.addEventListener('click', () => toggleModal('modal-edit-transaksi', false));
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => toggleModal('modal-edit-transaksi', false));

  if (inputNominalEdit) {
    inputNominalEdit.addEventListener('input', (e) => {
      const numeric = parseRupiah(e.target.value);
      e.target.value = numeric ? new Intl.NumberFormat('id-ID').format(numeric) : '';
    });
  }

  function openDashboardEditModal(id, type) {
    const transactions = getAllTransactions();
    const item = transactions.find(t => t.id === id);
    if (!item) return;

    const inputId = document.getElementById('edit-transaksi-id');
    const inputType = document.getElementById('edit-transaksi-type');
    const inputTitle = document.getElementById('edit-title');
    const inputNominal = document.getElementById('edit-nominal');
    const inputTanggal = document.getElementById('edit-tanggal');
    const boxKategori = document.getElementById('box-edit-kategori');
    const selectKategori = document.getElementById('edit-kategori');
    const titleElem = document.getElementById('edit-modal-title');
    const subTitleElem = document.getElementById('edit-modal-subtitle');
    const iconBox = document.getElementById('edit-header-icon');

    if (inputId) inputId.value = item.id;
    if (inputType) inputType.value = item.type;
    if (inputTitle) inputTitle.value = item.title;
    if (inputNominal) inputNominal.value = new Intl.NumberFormat('id-ID').format(item.amount);
    if (inputTanggal) inputTanggal.value = item.tanggal || getTodayString();

    setEditKantong(item.pocket || 'kas');
    setEditWadah(item.wadah || 'rekening');

    if (item.type === 'belanja') {
      if (boxKategori) boxKategori.classList.remove('hidden');
      if (selectKategori) {
        const normCat = normalizeCategoryName(item.kategori);
        selectKategori.value = normCat;
        if (!selectKategori.value) selectKategori.value = 'Lainnya';
      }
      if (titleElem) titleElem.textContent = 'Edit Pengeluaran Bersama';
      if (subTitleElem) subTitleElem.textContent = 'Koreksi rincian pengeluaran dana.';
      if (iconBox) iconBox.className = 'w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center';
    } else {
      if (boxKategori) boxKategori.classList.add('hidden');
      if (titleElem) titleElem.textContent = 'Edit Pemasukan Bersama';
      if (subTitleElem) subTitleElem.textContent = 'Koreksi rincian dana masuk.';
      if (iconBox) iconBox.className = 'w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center';
    }

    toggleModal('modal-edit-transaksi', true);
  }
  window.openDashboardEditModal = openDashboardEditModal;

  if (formEdit) {
    formEdit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-transaksi-id').value;
      const type = document.getElementById('edit-transaksi-type').value;
      const title = document.getElementById('edit-title').value.trim();
      const nominal = parseRupiah(inputNominalEdit.value);
      const pocket = document.getElementById('edit-kantong').value || 'kas';
      const wadah = document.getElementById('edit-wadah').value || 'rekening';
      const tanggal = document.getElementById('edit-tanggal').value || getTodayString();
      const kategori = document.getElementById('edit-kategori') ? document.getElementById('edit-kategori').value : 'Umum';

      if (!title) {
        showToast('Keterangan transaksi harus diisi.', 'error');
        return;
      }
      if (!nominal || nominal <= 0) {
        showToast('Nominal transaksi harus lebih dari 0.', 'error');
        return;
      }

      await updateTransactionItem(id, type, {
        title,
        jumlah: nominal,
        tanggal,
        pocket,
        wadah,
        kategori
      });

      showToast('Transaksi berhasil diperbarui.', 'success');
      toggleModal('modal-edit-transaksi', false);
      loadDashboardMetrics();
    });
  }

  // Close modals on clicking background or Escape key
  ['modal-pemasukan', 'modal-pengeluaran', 'modal-transfer', 'modal-edit-transaksi'].forEach(mId => {
    const el = document.getElementById(mId);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) toggleModal(mId, false);
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['modal-pemasukan', 'modal-pengeluaran', 'modal-transfer', 'modal-edit-transaksi'].forEach(mId => toggleModal(mId, false));
    }
  });
}
