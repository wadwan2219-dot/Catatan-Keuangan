/**
 * SaldoKu - Common Helpers & Storage Driver
 * Provides formatters, toast alerts, session guard, and Hybrid Data Engine.
 */

// --------------------------------------------------------------------------
// 1. Currency & Date Formatters
// --------------------------------------------------------------------------
function formatRupiah(number) {
  const val = Number(number) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val);
}

function parseRupiah(inputStr) {
  if (typeof inputStr === 'number') return inputStr;
  if (!inputStr) return 0;
  const clean = String(inputStr).replace(/[^0-9]/g, '');
  return parseInt(clean, 10) || 0;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --------------------------------------------------------------------------
// 2. Toast Alert System
// --------------------------------------------------------------------------
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';
  if (type === 'info') icon = 'ℹ️';

  toast.innerHTML = `
    <span style="font-size: 1.2rem;">${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --------------------------------------------------------------------------
// 3. User Session Guard
// --------------------------------------------------------------------------
function getCurrentUser() {
  const session = localStorage.getItem('saldoku_user_session');
  if (!session) return null;
  try {
    return JSON.parse(session);
  } catch (e) {
    return null;
  }
}

function setCurrentUser(userObj) {
  localStorage.setItem('saldoku_user_session', JSON.stringify(userObj));
}

function logoutUser() {
  localStorage.removeItem('saldoku_user_session');
  showToast('Anda telah keluar dari aplikasi.', 'info');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 600);
}

function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
  }
  return user;
}

// --------------------------------------------------------------------------
// 4. Hybrid Data Engine (Local Storage + Firebase Sync Ready)
// --------------------------------------------------------------------------
const STORAGE_KEY_TABUNGAN = 'saldoku_data_tabungan';
const STORAGE_KEY_BELANJA = 'saldoku_data_belanja';

function getRawTabungan() {
  const raw = localStorage.getItem(STORAGE_KEY_TABUNGAN);
  return raw ? JSON.parse(raw) : [];
}

function saveRawTabungan(list) {
  localStorage.setItem(STORAGE_KEY_TABUNGAN, JSON.stringify(list));
}

function getRawBelanja() {
  const raw = localStorage.getItem(STORAGE_KEY_BELANJA);
  return raw ? JSON.parse(raw) : [];
}

function saveRawBelanja(list) {
  localStorage.setItem(STORAGE_KEY_BELANJA, JSON.stringify(list));
}

// Initialize seed data if empty
function initializeSeedData(userId) {
  const currentSavings = getRawTabungan();
  const currentExpenses = getRawBelanja();

  if (currentSavings.length === 0 && currentExpenses.length === 0) {
    const defaultSavings = [
      {
        id: 'tab_' + Date.now() + '_1',
        user_id: userId,
        jumlah: 1000000,
        keterangan: 'Tabungan Awal / Gaji Bulan Ini',
        tanggal: getTodayString(),
        createdAt: new Date().toISOString()
      }
    ];
    const defaultExpenses = [
      {
        id: 'bel_' + Date.now() + '_1',
        user_id: userId,
        nama_item: 'Beli Beras 10kg',
        jumlah: 150000,
        kategori: 'Belanja Harian',
        tanggal: getTodayString(),
        createdAt: new Date().toISOString()
      }
    ];
    saveRawTabungan(defaultSavings);
    saveRawBelanja(defaultExpenses);
  }
}

// Compute Balances for user
function calculateUserBalance(userId) {
  initializeSeedData(userId);
  
  const savings = getRawTabungan().filter(t => t.user_id === userId);
  const expenses = getRawBelanja().filter(b => b.user_id === userId);

  const totalTabungan = savings.reduce((sum, item) => sum + Number(item.jumlah || 0), 0);
  const totalBelanja = expenses.reduce((sum, item) => sum + Number(item.jumlah || 0), 0);
  const sisaSaldo = totalTabungan - totalBelanja;

  return {
    totalTabungan,
    totalBelanja,
    sisaSaldo,
    countTabungan: savings.length,
    countBelanja: expenses.length
  };
}

// Add Tabungan (Income)
function addTabunganTransaction(userId, jumlah, keterangan, tanggal) {
  const list = getRawTabungan();
  const newItem = {
    id: 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    user_id: userId,
    jumlah: Number(jumlah),
    keterangan: keterangan || 'Tabungan Masuk',
    tanggal: tanggal || getTodayString(),
    createdAt: new Date().toISOString()
  };
  list.unshift(newItem);
  saveRawTabungan(list);
  return newItem;
}

// Add Belanja (Expense)
function addBelanjaTransaction(userId, nama_item, jumlah, kategori, tanggal) {
  const list = getRawBelanja();
  const newItem = {
    id: 'bel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    user_id: userId,
    nama_item: nama_item,
    jumlah: Number(jumlah),
    kategori: kategori || 'Umum',
    tanggal: tanggal || getTodayString(),
    createdAt: new Date().toISOString()
  };
  list.unshift(newItem);
  saveRawBelanja(list);
  return newItem;
}

// Get All Transactions Merged & Sorted
function getAllTransactions(userId) {
  initializeSeedData(userId);

  const savings = getRawTabungan()
    .filter(t => t.user_id === userId)
    .map(t => ({
      ...t,
      type: 'tabungan',
      title: t.keterangan || 'Tabungan',
      amount: t.jumlah
    }));

  const expenses = getRawBelanja()
    .filter(b => b.user_id === userId)
    .map(b => ({
      ...b,
      type: 'belanja',
      title: b.nama_item || 'Belanja',
      amount: b.jumlah
    }));

  const combined = [...savings, ...expenses];
  combined.sort((a, b) => new Date(b.tanggal + 'T' + (b.createdAt ? b.createdAt.substring(11,19) : '00:00:00')) - new Date(a.tanggal + 'T' + (a.createdAt ? a.createdAt.substring(11,19) : '00:00:00')));
  return combined;
}

// Delete Transaction
function deleteTransactionItem(id, type) {
  if (type === 'tabungan') {
    let list = getRawTabungan();
    list = list.filter(item => item.id !== id);
    saveRawTabungan(list);
  } else if (type === 'belanja') {
    let list = getRawBelanja();
    list = list.filter(item => item.id !== id);
    saveRawBelanja(list);
  }
}
