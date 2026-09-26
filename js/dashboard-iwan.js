/**
 * SaldoKu - Dashboard Pribadi Iwan (dashboard-iwan.js)
 * Modul logika khusus untuk dashboard pribadi Iwan.
 * Bebas dikustomisasi khusus Iwan tanpa mempengaruhi pengguna lain.
 */

document.addEventListener('DOMContentLoaded', () => {
  let user = getCurrentUser();

  // Pastikan sesi aktif mengarah ke Iwan (Pribadi)
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

  // Populate User Header Info
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

  // Load Initial Dashboard Data for Iwan
  loadIwanDashboardMetrics();

  // Subscribe to Real-Time Cloud Sync
  syncFirestoreData(() => {
    loadIwanDashboardMetrics();
  });
});

function loadIwanDashboardMetrics() {
  const stats = calculateUserBalance('iwan');
  const transactions = getAllTransactions('iwan');

  // Update Summary Cards
  const saldoElem = document.getElementById('val-sisa-saldo');
  const tabunganElem = document.getElementById('val-total-tabungan');
  const belanjaElem = document.getElementById('val-total-belanja');
  const statusBadgeElem = document.getElementById('badge-status-saldo');

  if (saldoElem) saldoElem.textContent = formatRupiah(stats.sisaSaldo);
  if (tabunganElem) tabunganElem.textContent = formatRupiah(stats.totalTabungan);
  if (belanjaElem) belanjaElem.textContent = formatRupiah(stats.totalBelanja);

  // Health Status Badge
  if (statusBadgeElem) {
    if (stats.sisaSaldo < 0) {
      statusBadgeElem.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30';
      statusBadgeElem.textContent = 'Defisit';
    } else if (stats.sisaSaldo < 100000 && stats.totalBelanja > 0) {
      statusBadgeElem.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30';
      statusBadgeElem.textContent = 'Perhatian: Rendah';
    } else {
      statusBadgeElem.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      statusBadgeElem.textContent = 'Surplus';
    }
  }

  // Budget Progress Bar
  const progressBar = document.getElementById('budget-progress-bar');
  const progressPercentText = document.getElementById('budget-progress-percent');
  
  if (progressBar && progressPercentText) {
    let percentage = 0;
    if (stats.totalTabungan > 0) {
      percentage = Math.round((stats.totalBelanja / stats.totalTabungan) * 100);
      percentage = Math.min(percentage, 100);
    } else if (stats.totalBelanja > 0) {
      percentage = 100;
    }

    progressBar.style.width = `${percentage}%`;
    progressPercentText.textContent = `${percentage}% terpakai`;

    if (percentage > 90) {
      progressBar.className = 'h-full bg-rose-500 rounded-full transition-all duration-500';
      progressPercentText.className = 'text-xs font-bold text-rose-400';
    } else if (percentage > 70) {
      progressBar.className = 'h-full bg-amber-500 rounded-full transition-all duration-500';
      progressPercentText.className = 'text-xs font-bold text-amber-400';
    } else {
      progressBar.className = 'h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500';
      progressPercentText.className = 'text-xs font-bold text-emerald-400';
    }
  }

  // Render Recent Transactions (Top 5)
  renderIwanRecentTransactions(transactions.slice(0, 5));
}

function renderIwanRecentTransactions(recentList) {
  const container = document.getElementById('recent-transactions-list');
  if (!container) return;

  if (recentList.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400">
        <div class="w-12 h-12 rounded-full bg-slate-800 text-slate-500 mx-auto flex items-center justify-center mb-2">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-sm font-medium">Belum ada transaksi pribadi Iwan</p>
      </div>
    `;
    return;
  }

  let html = '';
  recentList.forEach(t => {
    const isIncome = t.type === 'tabungan';
    const sign = isIncome ? '+' : '-';
    const amountColor = isIncome ? 'text-emerald-400' : 'text-rose-400';
    const badgeBg = isIncome ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    const iconSvg = isIncome
      ? `<svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>`
      : `<svg class="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>`;

    html += `
      <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/70 transition-all">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center ${isIncome ? 'bg-emerald-500/20' : 'bg-rose-500/20'}">
            ${iconSvg}
          </div>
          <div>
            <h4 class="text-sm font-semibold text-slate-200">${t.title}</h4>
            <p class="text-xs text-slate-400">${formatDate(t.tanggal)} ${t.kategori ? '• ' + t.kategori : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="text-sm font-bold ${amountColor}">${sign} ${formatRupiah(t.amount)}</span>
          <div>
            <span class="inline-block px-2 py-0.5 text-[10px] font-medium rounded-md border ${badgeBg}">
              ${isIncome ? 'Tabungan' : 'Belanja'}
            </span>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}
