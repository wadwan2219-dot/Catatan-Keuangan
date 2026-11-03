/**
 * SaldoKu - Transaction History Logic (riwayat.js)
 * Real-time dynamic period discovery, accounting cycle filter chips, keyword search,
 * isolated multi-role personal accounting, and CSV export.
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();
  if (!user) return;

  const userId = user.memberId || user.uid || 'bersama';
  setupRiwayatNavigation(user);

  // Logout Handler
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  }

  // DOM Elements
  const filterTypeSelect = document.getElementById('filter-type');
  const filterPeriodSelect = document.getElementById('filter-period');
  const searchInput = document.getElementById('search-keyword');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnResetPeriod = document.getElementById('btn-reset-period');

  // State
  let cashTransactions = [];
  let debtEntries = [];
  let unifiedList = [];
  let availablePeriods = [];
  
  // Default period: check URL parameter ?period=... or default to 'all'
  const urlParams = new URLSearchParams(window.location.search);
  let selectedPeriod = urlParams.get('period') || 'all';

  /**
   * Configure header and navigation back links according to the active user role
   */
  function setupRiwayatNavigation(currUser) {
    let dashboardHref = 'dashboard.html';
    if (currUser.memberId === 'iwan' || currUser.uid === 'iwan') {
      dashboardHref = 'dashboard-iwan.html';
    } else if (currUser.memberId === 'wadda' || currUser.uid === 'wadda') {
      dashboardHref = 'dashboard-wadda.html';
    } else if (currUser.role === 'admin' || currUser.role === 'superadmin') {
      dashboardHref = 'admin.html';
    }

    const brandLink = document.getElementById('brand-logo-link');
    const navDashboardLink = document.getElementById('nav-dashboard-link');
    const btnBack = document.getElementById('btn-back-dashboard');
    const mobileHome = document.getElementById('mobile-home-link');

    if (brandLink) brandLink.href = dashboardHref;
    if (navDashboardLink) navDashboardLink.href = dashboardHref;
    if (btnBack) btnBack.href = dashboardHref;
    if (mobileHome) mobileHome.href = dashboardHref;

    // Header Profile Pill
    const headerAvatar = document.getElementById('header-avatar');
    const headerName = document.getElementById('header-user-name');
    const headerRole = document.getElementById('header-user-role');

    const displayName = currUser.nama || (currUser.memberId === 'iwan' ? 'Iwan' : (currUser.memberId === 'wadda' ? 'Wadda' : (currUser.email ? currUser.email.split('@')[0] : 'Pengguna')));
    if (headerAvatar) headerAvatar.textContent = (displayName[0] || 'U').toUpperCase();
    if (headerName) headerName.textContent = displayName;
    if (headerRole) {
      if (currUser.memberId === 'iwan' || currUser.memberId === 'wadda' || currUser.role === 'personal') {
        headerRole.textContent = 'Mode Personal';
      } else if (currUser.role === 'admin' || currUser.role === 'superadmin') {
        headerRole.textContent = 'Administrator';
      } else {
        headerRole.textContent = 'Akun Bersama';
      }
    }
  }

  /**
   * Helper formatting functions
   */
  function formatMonthYear(ymStr) {
    if (!ymStr) return '-';
    const parts = ymStr.split('-');
    if (parts.length < 2) return ymStr;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }

  function formatMonthYearShort(ymStr) {
    if (!ymStr) return '-';
    const parts = ymStr.split('-');
    if (parts.length < 2) return ymStr;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  /**
   * Dynamically discover available accounting cycles and calendar months for this account
   */
  function discoverAvailablePeriods(transactions, cycleConfig) {
    const periods = [];

    // 1. All Time (default full view)
    periods.push({
      id: 'all',
      title: 'Semua Riwayat Waktu',
      shortLabel: 'Semua Waktu',
      dateText: 'Seluruh riwayat transaksi',
      badge: 'Semua Waktu',
      group: 'cycle',
      filterFn: () => true
    });

    // 2. Current Active Cycle (Periode Berjalan)
    const currentStart = (cycleConfig && cycleConfig.current_cycle_start) ? cycleConfig.current_cycle_start.slice(0, 10) : '';
    const currentStartFormatted = currentStart ? formatDate(currentStart) : 'Awal';
    periods.push({
      id: 'current',
      title: 'Periode Berjalan (Siklus Aktif)',
      shortLabel: 'Siklus Aktif',
      dateText: `Sejak ${currentStartFormatted}`,
      badge: `Siklus Aktif (${currentStart ? formatDateShort(currentStart) : 'Kini'})`,
      group: 'cycle',
      filterFn: (t) => {
        if (!currentStart) return true;
        const d = (t.tanggal || (t.createdAt ? t.createdAt.slice(0, 10) : '')).slice(0, 10);
        return !d || d >= currentStart;
      }
    });

    // 3. Historical Checkpoints from User Cycle Config
    if (cycleConfig && Array.isArray(cycleConfig.history_checkpoints) && cycleConfig.history_checkpoints.length > 0) {
      cycleConfig.history_checkpoints.forEach((cp, idx) => {
        const s = (cp.start_date || '').slice(0, 10);
        const e = (cp.end_date || '').slice(0, 10);
        const shortS = s ? formatDateShort(s) : '?';
        const shortE = e ? formatDateShort(e) : '?';
        const num = cycleConfig.history_checkpoints.length - idx;

        periods.push({
          id: cp.cycle_id,
          title: `Siklus Tertutup #${num}: ${formatDate(s)} s/d ${formatDate(e)}`,
          shortLabel: `Siklus #${num} (${shortS} - ${shortE})`,
          dateText: `${formatDate(s)} s/d ${formatDate(e)}`,
          badge: `Siklus #${num}`,
          group: 'cycle',
          checkpoint: cp,
          filterFn: (t) => {
            const d = (t.tanggal || (t.createdAt ? t.createdAt.slice(0, 10) : '')).slice(0, 10);
            return (!s || d >= s) && (!e || d <= e);
          }
        });
      });
    }

    // 4. Calendar Months extracted dynamically from transactions
    const monthMap = new Map();
    transactions.forEach(t => {
      const ym = (t.tanggal || (t.createdAt ? t.createdAt.slice(0, 10) : '')).slice(0, 7);
      if (ym && /^\d{4}-\d{2}$/.test(ym)) {
        monthMap.set(ym, (monthMap.get(ym) || 0) + 1);
      }
    });

    const sortedMonths = Array.from(monthMap.keys()).sort().reverse();
    sortedMonths.forEach(ym => {
      const mFull = formatMonthYear(ym);
      const mShort = formatMonthYearShort(ym);

      periods.push({
        id: 'month_' + ym,
        title: `Bulan ${mFull}`,
        shortLabel: mShort,
        dateText: `Bulan ${mFull}`,
        badge: mShort,
        group: 'month',
        monthKey: ym,
        filterFn: (t) => {
          const d = (t.tanggal || (t.createdAt ? t.createdAt.slice(0, 10) : '')).slice(0, 7);
          return d === ym;
        }
      });
    });

    return periods;
  }

  /**
   * Render dynamic clickable period filter chips
   */
  function renderPeriodChips(periods, activeId) {
    const container = document.getElementById('container-period-chips');
    if (!container) return;

    container.innerHTML = '';
    periods.forEach(p => {
      const isActive = p.id === activeId;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-period-id', p.id);
      btn.className = `btn-period-chip px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
        isActive
          ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold border-teal-300 shadow-md shadow-teal-500/25 ring-2 ring-teal-400/40'
          : 'bg-[#090f20]/90 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/80 hover:border-slate-600'
      }`;

      let iconHtml = '';
      if (p.id === 'all') {
        iconHtml = `<svg class="w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>`;
      } else if (p.id === 'current') {
        iconHtml = `<span class="w-2 h-2 rounded-full ${isActive ? 'bg-slate-950' : 'bg-emerald-400 animate-pulse'}"></span>`;
      } else if (p.group === 'cycle') {
        iconHtml = `<svg class="w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-teal-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>`;
      } else {
        iconHtml = `<svg class="w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-indigo-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>`;
      }

      btn.innerHTML = `${iconHtml}<span>${p.shortLabel}</span>`;
      btn.addEventListener('click', () => {
        setPeriod(p.id);
      });
      container.appendChild(btn);
    });
  }

  /**
   * Populate the period select dropdown
   */
  function renderPeriodDropdown(periods, activeId) {
    if (!filterPeriodSelect) return;

    const cyclePeriods = periods.filter(p => p.group === 'cycle');
    const monthPeriods = periods.filter(p => p.group === 'month');

    let html = '';
    if (cyclePeriods.length > 0) {
      html += '<optgroup label="Siklus Pembukuan Akun">';
      cyclePeriods.forEach(p => {
        html += `<option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>${p.title}</option>`;
      });
      html += '</optgroup>';
    }

    if (monthPeriods.length > 0) {
      html += '<optgroup label="Bulan Kalender">';
      monthPeriods.forEach(p => {
        html += `<option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>${p.title}</option>`;
      });
      html += '</optgroup>';
    }

    filterPeriodSelect.innerHTML = html;
    filterPeriodSelect.value = activeId;
  }

  /**
   * Update active period state and sync UI
   */
  function setPeriod(periodId) {
    selectedPeriod = periodId;
    if (!availablePeriods.some(p => p.id === periodId)) {
      selectedPeriod = 'all';
    }

    renderPeriodChips(availablePeriods, selectedPeriod);
    if (filterPeriodSelect && filterPeriodSelect.value !== selectedPeriod) {
      filterPeriodSelect.value = selectedPeriod;
    }

    renderTable();
  }

  /**
   * Update active period summary banner
   */
  function updatePeriodSummaryBanner(period, inAmount, outAmount, netAmount) {
    const titleElem = document.getElementById('summary-period-title');
    const datesElem = document.getElementById('summary-period-dates');
    const inElem = document.getElementById('summary-period-in');
    const outElem = document.getElementById('summary-period-out');
    const netElem = document.getElementById('summary-period-net');
    const badgeIndicator = document.getElementById('badge-active-period-indicator');

    if (titleElem) titleElem.textContent = period.title;
    if (datesElem) datesElem.textContent = `(${period.dateText})`;
    if (inElem) inElem.textContent = `+ ${formatRupiah(inAmount)}`;
    if (outElem) outElem.textContent = `- ${formatRupiah(outAmount)}`;
    if (netElem) {
      const sign = netAmount > 0 ? '+' : '';
      netElem.textContent = `${sign}${formatRupiah(netAmount)}`;
      netElem.className = netAmount >= 0 ? 'text-emerald-400 font-bold font-mono' : 'text-rose-400 font-bold font-mono';
    }

    if (badgeIndicator) badgeIndicator.textContent = period.badge;

    if (btnResetPeriod) {
      if (period.id === 'all') {
        btnResetPeriod.classList.add('hidden');
      } else {
        btnResetPeriod.classList.remove('hidden');
      }
    }
  }

  /**
   * Reload all user transactions and refresh view
   */
  function reloadData() {
    cashTransactions = getAllTransactions(userId);
    debtEntries = (isJointAccount() && window.DebtService) ? window.DebtService.getLocalEntries() : [];

    // Map Cash Transactions to unified view model
    const mappedCash = cashTransactions.map(t => ({
      domain: 'cash',
      id: t.id,
      type: t.type, // 'tabungan' | 'belanja'
      title: t.title || t.keterangan || t.nama_item || 'Transaksi',
      kategori: t.kategori || (t.type === 'tabungan' ? 'Pemasukan' : 'Pengeluaran'),
      amount: Number(t.amount || t.jumlah || 0),
      pocket: t.pocket || (t.type === 'tabungan' ? 'tabungan' : 'kas'),
      wadah: t.wadah || 'rekening',
      tanggal: t.tanggal || (t.createdAt ? t.createdAt.slice(0, 10) : ''),
      createdAt: t.createdAt
    }));

    // Map Debt Entries to unified view model
    const mappedDebt = debtEntries.map(d => {
      const fromName = window.DebtEngine ? window.DebtEngine.getMemberName(d.fromMemberId) : d.fromMemberId;
      const toName = window.DebtEngine ? window.DebtEngine.getMemberName(d.toMemberId) : d.toMemberId;

      let title = '';
      if (d.kind === 'debt') {
        title = `Hutang: ${fromName} ke ${toName}`;
      } else if (d.kind === 'payment') {
        title = `Pembayaran: ${fromName} ke ${toName}`;
      } else if (d.kind === 'reversal') {
        title = `Pembatalan: ${d.note || 'Reversal Sistem'}`;
      }

      return {
        domain: 'debt',
        id: d.id,
        type: d.kind, // 'debt' | 'payment' | 'reversal'
        title: title,
        kategori: d.note ? `Hutang (${d.note})` : 'Hutang Bersih',
        amount: Number(d.amount || 0),
        pocket: 'hutang',
        wadah: 'rekening',
        tanggal: d.occurredAt || (d.createdAt ? d.createdAt.slice(0, 10) : ''),
        createdAt: d.createdAt,
        rawDebt: d
      };
    });

    // Combine and sort by date descending
    unifiedList = [...mappedCash, ...mappedDebt];
    unifiedList.sort((a, b) => {
      const dateA = (a.tanggal || '') + ' ' + (a.createdAt || '');
      const dateB = (b.tanggal || '') + ' ' + (b.createdAt || '');
      return dateB.localeCompare(dateA);
    });

    // Retrieve cycle configuration & discover periods
    const cycleConfig = (typeof getUserCycleConfig === 'function')
      ? getUserCycleConfig(userId)
      : { current_cycle_start: '', history_checkpoints: [] };

    availablePeriods = discoverAvailablePeriods(unifiedList, cycleConfig);

    // Validate selectedPeriod
    if (!availablePeriods.some(p => p.id === selectedPeriod)) {
      selectedPeriod = 'all';
    }

    renderPeriodChips(availablePeriods, selectedPeriod);
    renderPeriodDropdown(availablePeriods, selectedPeriod);

    renderTable();
    updateSummaryHeader();
  }

  /**
   * Update top header overall wallet balance
   */
  function updateSummaryHeader() {
    const stats = calculateUserBalance(userId);
    const saldoElem = document.getElementById('val-riwayat-saldo');
    if (saldoElem) saldoElem.textContent = formatRupiah(stats.sisaSaldo);
  }

  /**
   * Render table rows based on period, type, and keyword
   */
  function renderTable() {
    const tableBody = document.getElementById('table-riwayat-body');
    const emptyState = document.getElementById('riwayat-empty-state');
    if (!tableBody) return;

    const activePeriod = availablePeriods.find(p => p.id === selectedPeriod) || availablePeriods[0] || { filterFn: () => true, title: 'Semua Waktu', dateText: '', badge: 'Semua Waktu' };
    const filterType = filterTypeSelect ? filterTypeSelect.value : 'all';
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Step 1: Filter by active period
    const periodFiltered = unifiedList.filter(t => activePeriod.filterFn(t));

    // Step 2: Calculate financial statistics for this period
    let totalIn = 0;
    let totalOut = 0;
    periodFiltered.forEach(t => {
      if (t.domain === 'cash') {
        if (t.type === 'tabungan') totalIn += t.amount;
        else if (t.type === 'belanja') totalOut += t.amount;
      } else {
        if (t.type === 'payment') totalIn += t.amount;
      }
    });
    const netFlow = totalIn - totalOut;
    updatePeriodSummaryBanner(activePeriod, totalIn, totalOut, netFlow);

    // Step 3: Filter by type and keyword
    const finalFiltered = periodFiltered.filter(t => {
      if (filterType === 'cash' && t.domain !== 'cash') return false;
      if (filterType === 'tabungan' && (t.domain !== 'cash' || t.type !== 'tabungan')) return false;
      if (filterType === 'belanja' && (t.domain !== 'cash' || t.type !== 'belanja')) return false;
      if (filterType === 'debt_domain' && t.domain !== 'debt') return false;

      if (keyword) {
        const titleMatch = (t.title || '').toLowerCase().includes(keyword);
        const catMatch = (t.kategori || '').toLowerCase().includes(keyword);
        const pocketMatch = (t.pocket || '').toLowerCase().includes(keyword);
        const wadahMatch = (t.wadah || '').toLowerCase().includes(keyword);
        if (!titleMatch && !catMatch && !pocketMatch && !wadahMatch) return false;
      }

      return true;
    });

    // Update count badge
    const countElem = document.getElementById('total-trx-count');
    if (countElem) countElem.textContent = `${finalFiltered.length} Transaksi`;

    if (finalFiltered.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const isPersonalUser = (user.memberId === 'iwan' || user.memberId === 'wadda' || user.role === 'personal');

    let rowsHtml = '';
    finalFiltered.forEach(t => {
      let badgeClass = '';
      let typeLabel = '';
      let amountClass = '';
      let amountSign = '';
      let actionHtml = '';

      if (t.domain === 'cash') {
        const isIncome = t.type === 'tabungan';
        amountSign = isIncome ? '+' : '-';
        amountClass = isIncome ? 'text-emerald-400 font-bold font-mono' : 'text-rose-400 font-bold font-mono';
        badgeClass = isIncome ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30';
        typeLabel = isIncome ? 'Tabungan' : 'Belanja';

        actionHtml = `
          <button data-id="${t.id}" data-type="${t.type}" title="Hapus transaksi" class="btn-delete-trx px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-500/25 rounded-lg border border-rose-500/30 transition-all cursor-pointer">
            Hapus
          </button>
        `;
      } else {
        // Debt domain
        if (t.type === 'debt') {
          badgeClass = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
          typeLabel = 'Hutang';
          amountClass = 'text-indigo-300 font-bold font-mono';
          amountSign = '';
        } else if (t.type === 'payment') {
          badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
          typeLabel = 'Pembayaran';
          amountClass = 'text-emerald-300 font-bold font-mono';
          amountSign = '';
        } else {
          badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
          typeLabel = 'Pembatalan';
          amountClass = 'text-slate-400 font-mono';
          amountSign = '';
        }

        actionHtml = `
          <a href="hutang.html" class="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700 transition-all inline-block">
            Detail
          </a>
        `;
      }

      // Pocket & Wadah tags (for Personal Mode)
      let tagsHtml = '';
      if (t.domain === 'cash' && isPersonalUser) {
        const pocketLabel = t.pocket === 'tabungan' ? 'Tabungan' : 'Kas Siap Pakai';
        const pocketClass = t.pocket === 'tabungan'
          ? 'bg-teal-500/10 border-teal-500/25 text-teal-300'
          : 'bg-cyan-500/10 border-cyan-500/25 text-cyan-300';

        const wadahLabel = t.wadah === 'tunai' ? 'Tunai' : 'Bank';

        tagsHtml = `
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${pocketClass} border font-mono">
            ${pocketLabel}
          </span>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300 font-mono">
            ${wadahLabel}
          </span>
        `;
      }

      rowsHtml += `
        <tr class="border-b border-slate-800/60 hover:bg-[#090f20]/60 transition-colors">
          <td class="px-4 py-3.5 text-xs text-slate-400 font-mono whitespace-nowrap">${formatDate(t.tanggal)}</td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            <span class="px-2.5 py-1 text-xs font-semibold rounded-lg border ${badgeClass}">
              ${typeLabel}
            </span>
          </td>
          <td class="px-4 py-3.5">
            <div class="text-sm font-semibold text-slate-100">${t.title}</div>
            <div class="flex items-center gap-1.5 mt-1 flex-wrap">
              ${t.kategori ? `<span class="text-xs text-slate-400">${t.kategori}</span>` : ''}
              ${tagsHtml}
            </div>
          </td>
          <td class="px-4 py-3.5 text-sm whitespace-nowrap ${amountClass}">
            ${amountSign ? amountSign + ' ' : ''}${formatRupiah(t.amount)}
          </td>
          <td class="px-4 py-3.5 text-right whitespace-nowrap">
            ${actionHtml}
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = rowsHtml;

    // Attach delete listeners
    tableBody.querySelectorAll('.btn-delete-trx').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const type = e.currentTarget.getAttribute('data-type');
        
        if (confirm('Hapus transaksi ini? Tindakan ini tidak dapat dibatalkan.')) {
          await deleteTransactionItem(id, type);
          showToast('Transaksi berhasil dihapus.', 'info');
          reloadData();
        }
      });
    });
  }

  // Filter & Search Events
  if (filterTypeSelect) {
    filterTypeSelect.addEventListener('change', renderTable);
  }

  if (filterPeriodSelect) {
    filterPeriodSelect.addEventListener('change', (e) => {
      setPeriod(e.target.value);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderTable);
  }

  if (btnResetPeriod) {
    btnResetPeriod.addEventListener('click', () => {
      setPeriod('all');
    });
  }

  // CSV Export Feature with Period awareness
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      const activePeriod = availablePeriods.find(p => p.id === selectedPeriod) || availablePeriods[0] || { filterFn: () => true, shortLabel: 'Semua' };
      const filterType = filterTypeSelect ? filterTypeSelect.value : 'all';
      const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';

      const toExport = unifiedList.filter(t => {
        if (!activePeriod.filterFn(t)) return false;
        if (filterType === 'cash' && t.domain !== 'cash') return false;
        if (filterType === 'tabungan' && (t.domain !== 'cash' || t.type !== 'tabungan')) return false;
        if (filterType === 'belanja' && (t.domain !== 'cash' || t.type !== 'belanja')) return false;
        if (filterType === 'debt_domain' && t.domain !== 'debt') return false;

        if (keyword) {
          const titleMatch = (t.title || '').toLowerCase().includes(keyword);
          const catMatch = (t.kategori || '').toLowerCase().includes(keyword);
          if (!titleMatch && !catMatch) return false;
        }

        return true;
      });

      if (toExport.length === 0) {
        showToast('Tidak ada data transaksi pada filter ini untuk diekspor.', 'warning');
        return;
      }

      let csv = 'Tanggal,Domain,Jenis Transaksi,Keterangan/Pihak,Kategori,Alokasi Kantong,Wadah Penyimpanan,Nominal (IDR)\n';
      toExport.forEach(t => {
        const domainLabel = t.domain === 'cash' ? 'Kas Pribadi' : 'Hutang Antaranggota';
        let jenis = '';
        if (t.domain === 'cash') {
          jenis = t.type === 'tabungan' ? 'Tabungan Masuk' : 'Belanja Keluar';
        } else {
          jenis = t.type === 'debt' ? 'Hutang Baru' : (t.type === 'payment' ? 'Pembayaran' : 'Pembatalan');
        }

        const pocketLabel = t.pocket === 'kas' ? 'Kas Siap Pakai' : (t.pocket === 'tabungan' ? 'Tabungan Simpanan' : '-');
        const wadahLabel = t.wadah === 'tunai' ? 'Dompet Tunai' : (t.wadah === 'rekening' ? 'Rekening Bank' : '-');

        const title = `"${(t.title || '').replace(/"/g, '""')}"`;
        const cat = `"${(t.kategori || '-').replace(/"/g, '""')}"`;
        const nominal = t.amount;
        csv += `${t.tanggal},${domainLabel},${jenis},${title},${cat},"${pocketLabel}","${wadahLabel}",${nominal}\n`;
      });

      const safePeriodSlug = (activePeriod.shortLabel || 'rekap')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_');
      const filename = `riwayat_transaksi_${safePeriodSlug}_${getTodayString()}.csv`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Berhasil mengekspor ${toExport.length} transaksi (${activePeriod.shortLabel}).`, 'success');
    });
  }

  // Real-time synchronization
  reloadData();
  syncFirestoreData(() => reloadData());

  window.addEventListener('saldoku_cycle_updated', () => {
    reloadData();
  });

  if (isJointAccount() && window.DebtService) {
    window.DebtService.subscribeEntries(() => {
      reloadData();
    });
  }
});