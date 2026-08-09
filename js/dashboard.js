/**
 * SaldoKu - Dashboard Logic (dashboard.js)
 * Real-time Firestore sync & balance metrics calculation.
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();

  // Populate User Header Info
  const userNameElem = document.getElementById('user-display-name');
  const userEmailElem = document.getElementById('user-display-email');
  const userAvatarElem = document.getElementById('user-avatar-initial');

  if (userNameElem) userNameElem.textContent = user.nama || 'Pengguna';
  if (userEmailElem) userEmailElem.textContent = user.email || '';
  if (userAvatarElem) userAvatarElem.textContent = (user.nama || 'P').charAt(0).toUpperCase();

  // Logout Handler
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  }

  // Load Initial Dashboard Data
  loadDashboardMetrics(user.uid);

  // Subscribe to Real-Time Cloud Firestore Sync
  syncFirestoreData(() => {
    loadDashboardMetrics(user.uid);
  });
});

function loadDashboardMetrics(userId) {
  const stats = calculateUserBalance(userId);
  const transactions = getAllTransactions(userId);

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
      statusBadgeElem.innerHTML = '⚠️ Defisit Saldo';
    } else if (stats.sisaSaldo < 100000 && stats.totalBelanja > 0) {
      statusBadgeElem.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30';
      statusBadgeElem.innerHTML = '⚡ Saldo Menipis';
    } else {
      statusBadgeElem.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      statusBadgeElem.innerHTML = '✨ Saldo Sehat';
    }
  }

  // Budget Progress Bar
  const progressBar = document.getElementById('budget-progress-bar');
  const progressPercentText = document.getElementById('budget-progress-percent');
  
  if (progressBar && progressPercentText) {
    let percentage = 0;
    if (stats.totalTabungan > 0) {
      percentage = Math.min(100, Math.round((stats.totalBelanja / stats.totalTabungan) * 100));
    } else if (stats.totalBelanja > 0) {
      percentage = 100;
    }
    
    progressBar.style.width = `${percentage}%`;
    progressPercentText.textContent = `${percentage}% terpakai`;

    if (percentage > 85) {
      progressBar.className = 'h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-500';
    } else {
      progressBar.className = 'h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all duration-500';
    }
  }

  // Render Recent 5 Transactions
  renderRecentTransactions(transactions.slice(0, 5));
}

function renderRecentTransactions(recentList) {
  const container = document.getElementById('recent-transactions-list');
  if (!container) return;

  if (recentList.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400">
        <p class="text-3xl mb-2">💸</p>
        <p class="text-sm font-medium">Belum ada transaksi tercatat</p>
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
    const icon = isIncome ? '💰' : (t.kategori === 'Makanan' ? '🍔' : (t.kategori === 'Transportasi' ? '🚗' : '🛒'));

    html += `
      <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/70 transition-all">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isIncome ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
            ${icon}
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
              ${isIncome ? 'Tabungan ➕' : 'Belanja ➖'}
            </span>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}
