/**
 * SaldoKu - Transaction History Logic (riwayat.js)
 * Real-time Firestore sync, filtering, searching, deletion, and CSV Export.
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();

  const filterTypeSelect = document.getElementById('filter-type');
  const searchInput = document.getElementById('search-keyword');
  const btnExportCsv = document.getElementById('btn-export-csv');

  let allTransactions = [];

  function reloadData() {
    allTransactions = getAllTransactions(user.uid);
    renderTable();
    updateSummaryHeader();
  }

  function updateSummaryHeader() {
    const stats = calculateUserBalance(user.uid);
    const countElem = document.getElementById('total-trx-count');
    const saldoElem = document.getElementById('val-riwayat-saldo');

    if (countElem) countElem.textContent = `${allTransactions.length} Transaksi`;
    if (saldoElem) saldoElem.textContent = formatRupiah(stats.sisaSaldo);
  }

  function renderTable() {
    const tableBody = document.getElementById('table-riwayat-body');
    const emptyState = document.getElementById('riwayat-empty-state');
    if (!tableBody) return;

    const filterType = filterTypeSelect ? filterTypeSelect.value : 'all';
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = allTransactions.filter(t => {
      if (filterType === 'tabungan' && t.type !== 'tabungan') return false;
      if (filterType === 'belanja' && t.type !== 'belanja') return false;

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
      const isIncome = t.type === 'tabungan';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
      const badgeClass = isIncome ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      const typeLabel = isIncome ? 'Tabungan ➕' : 'Belanja ➖';

      rowsHtml += `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
          <td class="px-4 py-3.5 text-xs text-slate-400 font-medium">${formatDate(t.tanggal)}</td>
          <td class="px-4 py-3.5">
            <span class="px-2.5 py-1 text-xs font-semibold rounded-lg border ${badgeClass}">
              ${typeLabel}
            </span>
          </td>
          <td class="px-4 py-3.5">
            <div class="text-sm font-semibold text-slate-100">${t.title}</div>
            ${t.kategori ? `<div class="text-xs text-slate-400">${t.kategori}</div>` : ''}
          </td>
          <td class="px-4 py-3.5 text-sm ${amountClass}">
            ${sign} ${formatRupiah(t.amount)}
          </td>
          <td class="px-4 py-3.5 text-right">
            <button data-id="${t.id}" data-type="${t.type}" class="btn-delete-trx px-2.5 py-1 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-md border border-rose-500/30 transition-all">
              🗑️ Hapus
            </button>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = rowsHtml;

    // Attach delete listeners
    document.querySelectorAll('.btn-delete-trx').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const type = e.currentTarget.getAttribute('data-type');
        
        if (confirm('Apakah Anda yakin ingin menghapus transaksi ini? Saldo akan dihitung ulang.')) {
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
      if (allTransactions.length === 0) {
        showToast('Tidak ada transaksi untuk diexport!', 'warning');
        return;
      }

      let csv = 'Tanggal,Jenis Transaksi,Keterangan/Barang,Kategori,Nominal (IDR)\n';
      allTransactions.forEach(t => {
        const jenis = t.type === 'tabungan' ? 'Tabungan Masuk' : 'Belanja Keluar';
        const title = `"${(t.title || '').replace(/"/g, '""')}"`;
        const cat = `"${(t.kategori || '-').replace(/"/g, '""')}"`;
        const nominal = t.amount;
        csv += `${t.tanggal},${jenis},${title},${cat},${nominal}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `riwayat_saldoku_${getTodayString()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('File CSV berhasil diunduh! 📊', 'success');
    });
  }

  // Initial Load & Firestore Real-time listener
  reloadData();
  syncFirestoreData(() => reloadData());
});
