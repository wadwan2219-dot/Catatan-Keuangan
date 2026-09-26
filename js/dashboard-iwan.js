/**
 * SaldoKu - Dashboard Pribadi Iwan (dashboard-iwan.js)
 * Dual-Pocket Financial Engine: Kas Siap Pakai vs Tabungan Iwan.
 * Sesuai panduan UI/UX Pro Max (Zero AI Slop, clean typography, SVG only).
 * Beroperasi mandiri pada data Iwan ('iwan').
 */

let activeTransactionFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  let user = getCurrentUser();

  // Pastikan sesi aktif diarahkan ke Iwan (Pribadi)
  if (!user || user.memberId !== 'iwan') {
    user = {
      uid: 'iwan',
      memberId: 'iwan',
      nama: 'Iwan (Pribadi)',
      email: 'iwan@pribadi.com',
      role: 'personal',
      isJoint: false,
      groupId: 'pribadi_iwan'
    };
    setCurrentUser(user);
  }

  // Populate User Header
  const userNameElem = document.getElementById('user-display-name');
  const userEmailElem = document.getElementById('user-display-email');
  if (userNameElem) userNameElem.textContent = 'Iwan (Pribadi)';
  if (userEmailElem) userEmailElem.textContent = 'iwan@pribadi.com';

  // Logout Handler
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  }

  // Init Modals and Actions
  initIwanModals(user);
  initTransactionFilters();

  // Load Initial Dashboard Metrics
  loadIwanDashboardMetrics();

  // Subscribe to Realtime Updates
  syncFirestoreData(() => {
    loadIwanDashboardMetrics();
  });
});

/**
 * Memuat dan mengkalkulasi metrik keuangan Iwan
 */
function loadIwanDashboardMetrics() {
  const stats = calculateUserBalance('iwan');
  const transactions = getAllTransactions('iwan');

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

  // 2. Update Card 2: Tabungan Iwan
  const valTabungan = document.getElementById('val-saldo-tabungan');
  if (valTabungan) valTabungan.textContent = formatRupiah(stats.saldoTabungan);

  // 3. Update Card 3: Total Aset Iwan
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

  // 7. Update Category Expense Analysis & Interactive Chart
  loadCategoryExpenseAnalysis();

  // 8. Render Transactions
  renderIwanTransactions(transactions);
}

// --------------------------------------------------------------------------
// Category Expense Analysis & Interactive Chart.js Implementation
// --------------------------------------------------------------------------
let iwanCategoryChart = null;
let selectedExpenseMonth = 'current'; // 'current' | 'YYYY-MM' | 'all'
let activeCategoryFilter = null;

function normalizeCategoryName(rawCategory) {
  if (!rawCategory) return 'Lainnya';
  const lower = rawCategory.toLowerCase().trim();
  if (lower.includes('bensin') || lower.includes('transport') || lower.includes('bbm') || lower.includes('bahan bakar')) {
    return 'Bensin & Transportasi';
  }
  if (lower.includes('makan') || lower.includes('minum') || lower.includes('kuliner') || lower.includes('snack')) {
    return 'Makanan & Minuman';
  }
  if (lower.includes('belanja') || lower.includes('sembako') || lower.includes('pasar') || lower.includes('kebutuhan')) {
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
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
      iconSvg: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>`
    },
    'Makanan & Minuman': {
      color: '#f59e0b', // Amber
      barClass: 'bg-amber-500',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
      iconSvg: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>`
    },
    'Belanja Kebutuhan': {
      color: '#a855f7', // Purple
      barClass: 'bg-purple-500',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
      iconSvg: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>`
    },
    'Tagihan & Utilitas': {
      color: '#f43f5e', // Rose
      barClass: 'bg-rose-500',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
      iconSvg: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`
    },
    'Kesehatan & Medis': {
      color: '#10b981', // Emerald
      barClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      iconSvg: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>`
    },
    'Hiburan & Rekreasi': {
      color: '#ec4899', // Pink
      barClass: 'bg-pink-500',
      badgeClass: 'bg-pink-500/10 text-pink-400 border-pink-500/25',
      iconSvg: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
    },
    'Pindah Dana': {
      color: '#38bdf8', // Sky
      barClass: 'bg-sky-400',
      badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/25',
      iconSvg: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>`
    }
  };

  return configs[name] || {
    color: '#64748b', // Slate
    barClass: 'bg-slate-500',
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/25',
    iconSvg: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>`
  };
}

function formatIndoMonthYear(ymStr) {
  if (!ymStr || ymStr.length < 7) return ymStr;
  const [year, month] = ymStr.split('-');
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const mIndex = parseInt(month, 10) - 1;
  const mName = monthNames[mIndex] || month;
  return `${mName} ${year}`;
}

function initCategoryMonthSelector(allExpenses) {
  const selectElem = document.getElementById('select-bulan-kategori');
  if (!selectElem) return;

  const currentYM = (getTodayString() || '').slice(0, 7);
  const monthsSet = new Set();
  monthsSet.add(currentYM);

  allExpenses.forEach(item => {
    if (item.tanggal && item.tanggal.length >= 7) {
      monthsSet.add(item.tanggal.slice(0, 7));
    }
  });

  const sortedMonths = Array.from(monthsSet).sort().reverse();

  let optionsHtml = '';
  sortedMonths.forEach(ym => {
    const isCurrent = ym === currentYM;
    const label = isCurrent ? `Bulan Ini (${formatIndoMonthYear(ym)})` : formatIndoMonthYear(ym);
    const selected = (selectedExpenseMonth === 'current' && isCurrent) || selectedExpenseMonth === ym ? 'selected' : '';
    optionsHtml += `<option value="${isCurrent ? 'current' : ym}" ${selected}>${label}</option>`;
  });
  optionsHtml += `<option value="all" ${selectedExpenseMonth === 'all' ? 'selected' : ''}>Semua Periode</option>`;

  selectElem.innerHTML = optionsHtml;

  selectElem.onchange = (e) => {
    selectedExpenseMonth = e.target.value;
    loadCategoryExpenseAnalysis();
  };
}

function loadCategoryExpenseAnalysis() {
  const allExpenses = getUserBelanja('iwan');
  initCategoryMonthSelector(allExpenses);

  const currentYM = (getTodayString() || '').slice(0, 7);
  
  // Deteksi bulan aktif yang memiliki data pengeluaran
  const availableMonthsWithData = Array.from(new Set(
    allExpenses
      .filter(e => e.tanggal && e.tanggal.length >= 7)
      .map(e => e.tanggal.slice(0, 7))
  )).sort().reverse();

  let activeMonth = selectedExpenseMonth;
  // Jika mode default 'current' namun bulan berjalan belum ada transaksi sedangkan bulan lain ada data, otomatis tampilkan bulan terbaru yang ada datanya
  if (selectedExpenseMonth === 'current') {
    const hasCurrentData = allExpenses.some(e => (e.tanggal || '').startsWith(currentYM));
    if (!hasCurrentData && availableMonthsWithData.length > 0) {
      activeMonth = availableMonthsWithData[0];
    }
  }

  let filtered = allExpenses;
  if (activeMonth === 'current') {
    filtered = allExpenses.filter(e => (e.tanggal || '').startsWith(currentYM));
  } else if (activeMonth !== 'all') {
    filtered = allExpenses.filter(e => (e.tanggal || '').startsWith(activeMonth));
  }

  const selectElem = document.getElementById('select-bulan-kategori');
  if (selectElem && activeMonth !== selectedExpenseMonth) {
    selectElem.value = activeMonth;
  }

  const categoryTotals = {};
  const categoryCounts = {};
  let totalExpense = 0;

  filtered.forEach(item => {
    const cat = normalizeCategoryName(item.kategori);
    const amt = Number(item.jumlah || 0);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    totalExpense += amt;
  });

  const sortedCategories = Object.keys(categoryTotals).map(catName => ({
    name: catName,
    amount: categoryTotals[catName],
    count: categoryCounts[catName],
    percentage: totalExpense > 0 ? Math.round((categoryTotals[catName] / totalExpense) * 100) : 0,
    config: getCategoryConfig(catName)
  })).sort((a, b) => b.amount - a.amount);

  // Update Total Badge in Header
  const badgeTotal = document.getElementById('badge-total-kategori-bulan');
  if (badgeTotal) badgeTotal.textContent = formatRupiah(totalExpense);

  const containerContent = document.getElementById('container-kategori-content');
  const emptyState = document.getElementById('empty-state-kategori');

  if (sortedCategories.length === 0 || totalExpense <= 0) {
    if (containerContent) containerContent.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    renderCategoryChart([], 0);
    return;
  }

  if (containerContent) containerContent.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');

  // Update Central Donut Labels
  const centerLabel = document.getElementById('donut-center-label');
  const centerTotal = document.getElementById('donut-center-total');
  const centerTop = document.getElementById('donut-center-top');

  if (centerLabel) {
    centerLabel.textContent = activeMonth === 'current' ? 'Bulan Ini' : (activeMonth === 'all' ? 'Total Belanja' : formatIndoMonthYear(activeMonth));
  }
  if (centerTotal) centerTotal.textContent = formatRupiah(totalExpense);
  if (centerTop && sortedCategories[0]) {
    centerTop.textContent = `Top: ${sortedCategories[0].name} (${sortedCategories[0].percentage}%)`;
  }

  // Render Visual Chart & Category Progress Bars
  renderCategoryChart(sortedCategories, totalExpense);
  renderCategoryBars(sortedCategories, totalExpense);
}

function renderCategoryChart(categories, totalAmount) {
  const canvas = document.getElementById('chart-kategori-pengeluaran');
  if (!canvas) return;

  if (typeof Chart === 'undefined') {
    console.warn('Chart.js sedang memuat...');
    setTimeout(() => renderCategoryChart(categories, totalAmount), 250);
    return;
  }

  const ctx = canvas.getContext('2d');

  if (iwanCategoryChart) {
    iwanCategoryChart.destroy();
    iwanCategoryChart = null;
  }

  if (categories.length === 0 || totalAmount <= 0) {
    iwanCategoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Belum Ada Pengeluaran'],
        datasets: [{
          data: [1],
          backgroundColor: ['#1e293b'],
          borderColor: '#0f172a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
    return;
  }

  const labels = categories.map(c => c.name);
  const data = categories.map(c => c.amount);
  const bgColors = categories.map(c => c.config.color);
  const borderColors = categories.map(() => '#080d1a');

  iwanCategoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '74%',
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 800
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0c1427',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          borderWidth: 1,
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: function(context) {
              const val = context.raw || 0;
              const pct = totalAmount > 0 ? Math.round((val / totalAmount) * 100) : 0;
              return ` ${formatRupiah(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderCategoryBars(categories, totalAmount) {
  const container = document.getElementById('list-kategori-progress');
  if (!container) return;

  let html = '';
  categories.forEach(cat => {
    const isActive = activeCategoryFilter === cat.name;
    const ringClass = isActive 
      ? 'ring-2 ring-emerald-400 bg-[#0e172e] border-emerald-500/50' 
      : 'hover:border-slate-700 bg-[#090f20]/90 border-slate-800/90';

    html += `
      <div class="category-progress-item p-3.5 rounded-xl border ${ringClass} transition-all cursor-pointer group" data-category="${cat.name}">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-lg ${cat.config.badgeClass} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              ${cat.config.iconSvg}
            </div>
            <div class="truncate">
              <span class="text-xs sm:text-sm font-bold text-white block truncate">${cat.name}</span>
              <span class="text-[10px] text-slate-400 font-mono">${cat.count} transaksi di periode ini</span>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <span class="text-xs sm:text-sm font-black font-mono text-white">${formatRupiah(cat.amount)}</span>
            <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-400 bg-rose-500/10 ml-1.5 font-mono">${cat.percentage}%</span>
          </div>
        </div>
        
        <!-- Progress Bar -->
        <div class="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div class="h-full ${cat.config.barClass} rounded-full transition-all duration-700" style="width: ${cat.percentage}%;"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Add click to filter event on category items
  container.querySelectorAll('.category-progress-item').forEach(el => {
    el.addEventListener('click', () => {
      const catName = el.getAttribute('data-category');
      if (activeCategoryFilter === catName) {
        activeCategoryFilter = null;
      } else {
        activeCategoryFilter = catName;
      }
      renderCategoryBars(categories, totalAmount);
      renderIwanTransactions(getAllTransactions('iwan'));
      
      const trxSection = document.getElementById('recent-transactions-list');
      if (trxSection) {
        trxSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });
}

/**
 * Filter handler untuk daftar transaksi
 */
function initTransactionFilters() {
  const btnAll = document.getElementById('filter-all');
  const btnKas = document.getElementById('filter-kas');
  const btnTabungan = document.getElementById('filter-tabungan');
  const btnClearCategory = document.getElementById('btn-clear-category-filter');

  function setFilter(filterType) {
    activeTransactionFilter = filterType;
    [btnAll, btnKas, btnTabungan].forEach(b => {
      if (b) {
        b.className = 'btn-filter px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition-all cursor-pointer';
      }
    });

    if (filterType === 'all' && btnAll) {
      btnAll.className = 'btn-filter px-3 py-1.5 rounded-lg font-bold transition-all bg-emerald-600 text-white cursor-pointer';
      activeCategoryFilter = null;
      loadCategoryExpenseAnalysis();
    } else if (filterType === 'kas' && btnKas) {
      btnKas.className = 'btn-filter px-3 py-1.5 rounded-lg font-bold transition-all bg-cyan-600 text-white cursor-pointer';
    } else if (filterType === 'tabungan' && btnTabungan) {
      btnTabungan.className = 'btn-filter px-3 py-1.5 rounded-lg font-bold transition-all bg-emerald-600 text-white cursor-pointer';
    }

    renderIwanTransactions(getAllTransactions('iwan'));
  }

  if (btnAll) btnAll.addEventListener('click', () => setFilter('all'));
  if (btnKas) btnKas.addEventListener('click', () => setFilter('kas'));
  if (btnTabungan) btnTabungan.addEventListener('click', () => setFilter('tabungan'));

  if (btnClearCategory) {
    btnClearCategory.addEventListener('click', () => {
      activeCategoryFilter = null;
      loadCategoryExpenseAnalysis();
      renderIwanTransactions(getAllTransactions('iwan'));
    });
  }
}

/**
 * Render Riwayat Transaksi Iwan
 */
function renderIwanTransactions(allList) {
  const container = document.getElementById('recent-transactions-list');
  if (!container) return;

  // Filter based on active pocket filter (all / kas / tabungan)
  let filtered = allList;
  if (activeTransactionFilter === 'kas') {
    filtered = allList.filter(t => t.pocket === 'kas');
  } else if (activeTransactionFilter === 'tabungan') {
    filtered = allList.filter(t => t.pocket === 'tabungan');
  }

  // Filter based on active category filter (if selected from category chart)
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
        loadIwanDashboardMetrics();
      }
    });
  });
}

/**
 * Inisialisasi 3 Modal Interaktif: Pemasukan, Pengeluaran, Pindah Dana
 */
function initIwanModals(user) {
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
  // MODAL 1: CATAT PEMASUKAN
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
  const hintAlokasi = document.getElementById('pemasukan-kantong-hint');

  function setAlokasiTujuan(kantong) {
    inputKantongIn.value = kantong;
    if (kantong === 'kas') {
      btnAlokasiKas.className = 'py-2.5 px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnAlokasiTabungan.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
      if (hintAlokasi) hintAlokasi.textContent = 'Uang masuk dapat langsung digunakan untuk kebutuhan harian.';
      if (hintAlokasi) hintAlokasi.className = 'text-[11px] text-cyan-400/80 mt-1';
    } else {
      btnAlokasiTabungan.className = 'py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer';
      btnAlokasiKas.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer';
      if (hintAlokasi) hintAlokasi.textContent = 'Uang dialokasikan sebagai simpanan aman masa depan.';
      if (hintAlokasi) hintAlokasi.className = 'text-[11px] text-emerald-400/80 mt-1';
    }
  }

  if (btnAlokasiKas) btnAlokasiKas.addEventListener('click', () => setAlokasiTujuan('kas'));
  if (btnAlokasiTabungan) btnAlokasiTabungan.addEventListener('click', () => setAlokasiTujuan('tabungan'));

  if (inputTanggalIn) inputTanggalIn.value = getTodayString();

  if (btnOpenPemasukan) {
    btnOpenPemasukan.addEventListener('click', () => {
      if (inputTanggalIn) inputTanggalIn.value = getTodayString();
      setAlokasiTujuan('kas');
      toggleModal('modal-pemasukan', true);
    });
  }

  if (btnClosePemasukan) {
    btnClosePemasukan.addEventListener('click', () => toggleModal('modal-pemasukan', false));
  }

  // Preset Buttons
  document.querySelectorAll('.btn-preset-in').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = Number(btn.getAttribute('data-preset') || 0);
      const current = parseRupiah(inputNominalIn.value) || 0;
      const total = current + preset;
      inputNominalIn.value = new Intl.NumberFormat('id-ID').format(total);
    });
  });

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
      const keterangan = inputKeteranganIn.value.trim() || 'Pemasukan Kas';
      const tanggal = inputTanggalIn.value || getTodayString();
      const kantong = inputKantongIn.value || 'kas';

      if (!nominal || nominal <= 0) {
        showToast('Nominal pemasukan harus lebih dari 0.', 'error');
        return;
      }

      await addTabunganTransaction(user.uid, nominal, keterangan, tanggal, kantong);
      const pocketLabel = kantong === 'kas' ? 'Kas Siap Pakai' : 'Tabungan';
      showToast(`Pemasukan ${formatRupiah(nominal)} berhasil ditambahkan ke ${pocketLabel}!`, 'success');

      formPemasukan.reset();
      inputNominalIn.value = '';
      setAlokasiTujuan('kas');
      toggleModal('modal-pemasukan', false);
      loadIwanDashboardMetrics();
    });
  }

  // ------------------------------------------------------------------------
  // MODAL 2: CATAT PENGELUARAN
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
  const hintSumber = document.getElementById('pengeluaran-sumber-hint');
  const boxWarning = document.getElementById('box-warning-defisit');

  function setSumberPengeluaran(sumber) {
    inputSumberOut.value = sumber;
    if (sumber === 'kas') {
      btnSumberKas.className = 'py-2.5 px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      btnSumberTabungan.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      if (hintSumber) hintSumber.textContent = 'Standar belanja harian: tabungan tetap aman tidak tersentuh.';
      if (hintSumber) hintSumber.className = 'text-[11px] text-cyan-400/80 mt-1';
    } else {
      btnSumberTabungan.className = 'py-2.5 px-3 rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-300 text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      btnSumberKas.className = 'py-2.5 px-3 rounded-xl border border-slate-700 bg-[#080d1a] text-slate-400 text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer';
      if (hintSumber) hintSumber.textContent = 'Perhatian: Mengambil dana simpanan tabungan.';
      if (hintSumber) hintSumber.className = 'text-[11px] text-rose-400/80 mt-1';
    }
    checkDefisit();
  }

  if (btnSumberKas) btnSumberKas.addEventListener('click', () => setSumberPengeluaran('kas'));
  if (btnSumberTabungan) btnSumberTabungan.addEventListener('click', () => setSumberPengeluaran('tabungan'));

  if (inputTanggalOut) inputTanggalOut.value = getTodayString();

  if (btnOpenPengeluaran) {
    btnOpenPengeluaran.addEventListener('click', () => {
      if (inputTanggalOut) inputTanggalOut.value = getTodayString();
      setSumberPengeluaran('kas');
      toggleModal('modal-pengeluaran', true);
    });
  }

  if (btnClosePengeluaran) {
    btnClosePengeluaran.addEventListener('click', () => toggleModal('modal-pengeluaran', false));
  }

  function checkDefisit() {
    if (!boxWarning) return;
    const nominal = parseRupiah(inputNominalOut.value) || 0;
    const sumber = inputSumberOut.value;
    const stats = calculateUserBalance('iwan');
    const available = sumber === 'kas' ? stats.saldoKas : stats.saldoTabungan;

    if (nominal > 0 && available < nominal) {
      boxWarning.classList.remove('hidden');
      boxWarning.textContent = `Perhatian: Nominal (${formatRupiah(nominal)}) melebihi sisa ${sumber === 'kas' ? 'Kas Siap Pakai' : 'Tabungan'} (${formatRupiah(available)}). Saldo akan menjadi defisit.`;
    } else {
      boxWarning.classList.add('hidden');
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
      loadIwanDashboardMetrics();
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

      const stats = calculateUserBalance('iwan');
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
      loadIwanDashboardMetrics();
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
