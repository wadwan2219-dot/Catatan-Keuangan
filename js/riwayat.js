/**
 * SaldoKu - Transaction History Logic (riwayat.js)
 * Real-time Firestore sync, filtering, searching, deletion, and CSV Export.
 * Integrates Cash & Debt domain view model while strictly preserving Cash balance isolation.
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();

  const filterTypeSelect = document.getElementById('filter-type');
  const searchInput = document.getElementById('search-keyword');
  const btnExportCsv = document.getElementById('btn-export-csv');

  let cashTransactions = [];
  let debtEntries = [];
  let unifiedList = [];

  function reloadData() {
    cashTransactions = getAllTransactions(user.uid);
    debtEntries = (isJointAccount() && window.DebtService) ? window.DebtService.getLocalEntries() : [];

    // Map Cash Transactions to unified view model
    const mappedCash = cashTransactions.map(t => ({
      domain: 'cash',
      id: t.id,
      type: t.type, // 'tabungan' | 'belanja'
      title: t.title,
      kategori: t.kategori || (t.type === 'tabungan' ? 'Pemasukan' : 'Pengeluaran'),
      amount: Number(t.amount || 0),
      tanggal: t.tanggal,
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

    renderTable();
    updateSummaryHeader();
  }

  function updateSummaryHeader() {
    const stats = calculateUserBalance(user.uid);
    const countElem = document.getElementById('total-trx-count');
    const saldoElem = document.getElementById('val-riwayat-saldo');

    if (countElem) countElem.textContent = `${unifiedList.length} Transaksi`;
    if (saldoElem) saldoElem.textContent = formatRupiah(stats.sisaSaldo);
  }

  function renderTable() {
    const tableBody = document.getElementById('table-riwayat-body');
    const emptyState = document.getElementById('riwayat-empty-state');
    if (!tableBody) return;

    const filterType = filterTypeSelect ? filterTypeSelect.value : 'all';
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = unifiedList.filter(t => {
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

    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let rowsHtml = '';
    filtered.forEach(t => {
      let badgeClass = '';
      let typeLabel = '';
      let amountClass = '';
      let amountSign = '';
      let actionHtml = '';

      if (t.domain === 'cash') {
        const isIncome = t.type === 'tabungan';
        amountSign = isIncome ? '+' : '-';
        amountClass = isIncome ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
        badgeClass = isIncome ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30';
        typeLabel = isIncome ? 'Tabungan ➕' : 'Belanja ➖';

        actionHtml = `
          <button data-id="${t.id}" data-type="${t.type}" class="btn-delete-trx px-2.5 py-1 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-md border border-rose-500/30 transition-all">
            🗑️ Hapus
          </button>
        `;
      } else {
        // Debt domain
        if (t.type === 'debt') {
          badgeClass = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
          typeLabel = 'Hutang 🤝';
          amountClass = 'text-indigo-300 font-bold';
          amountSign = '';
        } else if (t.type === 'payment') {
          badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
          typeLabel = 'Bayar Hutang 💸';
          amountClass = 'text-emerald-300 font-bold';
          amountSign = '';
        } else {
          badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
          typeLabel = 'Pembatalan ⚠️';
          amountClass = 'text-slate-400';
          amountSign = '';
        }

        actionHtml = `
          <a href="hutang.html" class="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md border border-slate-700 transition-all inline-block">
            Kelola ➔
          </a>
        `;
      }

      rowsHtml += `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
          <td class="px-4 py-3.5 text-xs text-slate-400 font-medium whitespace-nowrap">${formatDate(t.tanggal)}</td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            <span class="px-2.5 py-1 text-xs font-semibold rounded-lg border ${badgeClass}">
              ${typeLabel}
            </span>
          </td>
          <td class="px-4 py-3.5">
            <div class="text-sm font-semibold text-slate-100">${t.title}</div>
            ${t.kategori ? `<div class="text-xs text-slate-400">${t.kategori}</div>` : ''}
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

    // Attach delete listeners for cash transactions
    document.querySelectorAll('.btn-delete-trx').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const type = e.currentTarget.getAttribute('data-type');
        
        if (confirm('Apakah Anda yakin ingin menghapus transaksi ini? Saldo kas akan dihitung ulang.')) {
          await deleteTransactionItem(id, type);
          showToast('Transaksi berhasil dihapus.', 'info');
          reloadData();
        }
      });
    });
  }

  // Filter & Search Events
  if (filterTypeSelect) filterTypeSelect.addEventListener('change', renderTable);
  if (searchInput) searchInput.addEventListener('input', renderTable);

  // CSV Export Feature
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      if (unifiedList.length === 0) {
        showToast('Tidak ada transaksi untuk diexport!', 'warning');
        return;
      }

      let csv = 'Tanggal,Domain,Jenis Transaksi,Keterangan/Pihak,Kategori,Nominal (IDR)\n';
      unifiedList.forEach(t => {
        const domainLabel = t.domain === 'cash' ? 'Kas Bersama' : 'Hutang Antaranggota';
        let jenis = '';
        if (t.domain === 'cash') {
          jenis = t.type === 'tabungan' ? 'Tabungan Masuk' : 'Belanja Keluar';
        } else {
          jenis = t.type === 'debt' ? 'Hutang Baru' : (t.type === 'payment' ? 'Pembayaran' : 'Pembatalan');
        }

        const title = `"${(t.title || '').replace(/"/g, '""')}"`;
        const cat = `"${(t.kategori || '-').replace(/"/g, '""')}"`;
        const nominal = t.amount;
        csv += `${t.tanggal},${domainLabel},${jenis},${title},${cat},${nominal}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `riwayat_lengkap_saldoku_${getTodayString()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('File CSV lengkap berhasil diunduh! 📊', 'success');
    });
  }

  // Initial Load & Real-time listeners
  reloadData();
  syncFirestoreData(() => reloadData());

  if (isJointAccount() && window.DebtService) {
    window.DebtService.subscribeEntries(() => {
      reloadData();
    });
  }
});
