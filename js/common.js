/**
 * SaldoKu - Common Helpers & Firestore Cloud Engine (common.js)
 * Pure Live Database - Starts strictly from ZERO (Rp 0) for new accounts.
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
// 3. User Session Guard & Local Cache Cleanup
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
  if (window.firebaseAuth) {
    try { window.firebaseAuth.signOut(); } catch (e) {}
  }
  localStorage.removeItem('saldoku_user_session');
  localStorage.removeItem('saldoku_data_tabungan');
  localStorage.removeItem('saldoku_data_belanja');
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
// 4. Data Storage Engine (Strict Zero Baseline)
// --------------------------------------------------------------------------
const STORAGE_KEY_TABUNGAN = 'saldoku_data_tabungan';
const STORAGE_KEY_BELANJA = 'saldoku_data_belanja';

function cleanDummySeedData(list) {
  // Filters out old dummy seed items (e.g. tab_seed_1 or 1.000.000 dummy initial item)
  return list.filter(item => item.id !== 'tab_seed_1' && item.id !== 'bel_seed_1' && !String(item.id).includes('_seed_'));
}

function getRawTabungan() {
  const raw = localStorage.getItem(STORAGE_KEY_TABUNGAN);
  if (!raw) return [];
  const list = JSON.parse(raw);
  const cleaned = cleanDummySeedData(list);
  if (cleaned.length !== list.length) {
    saveRawTabungan(cleaned);
  }
  return cleaned;
}

function saveRawTabungan(list) {
  localStorage.setItem(STORAGE_KEY_TABUNGAN, JSON.stringify(list));
}

function getRawBelanja() {
  const raw = localStorage.getItem(STORAGE_KEY_BELANJA);
  if (!raw) return [];
  const list = JSON.parse(raw);
  const cleaned = cleanDummySeedData(list);
  if (cleaned.length !== list.length) {
    saveRawBelanja(cleaned);
  }
  return cleaned;
}

function saveRawBelanja(list) {
  localStorage.setItem(STORAGE_KEY_BELANJA, JSON.stringify(list));
}

/**
 * Real-time Firestore Cloud Sync:
 * Subscribes to Cloud Firestore Database collections `tabungan` and `belanja`.
 * Updates UI dynamically whenever any device inputs new data!
 */
function syncFirestoreData(onUpdateCallback) {
  if (!window.firebaseDb || !window.isFirebaseConnected()) {
    if (onUpdateCallback) onUpdateCallback();
    return;
  }

  try {
    // 1. Realtime Listener for Collection 'tabungan'
    window.firebaseDb.collection('tabungan').onSnapshot((snapshot) => {
      const cloudSavings = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        cloudSavings.push({ id: doc.id, ...d });
      });
      saveRawTabungan(cloudSavings);
      if (onUpdateCallback) onUpdateCallback();
    }, err => {
      console.warn('Firestore tabungan stream error:', err);
    });

    // 2. Realtime Listener for Collection 'belanja'
    window.firebaseDb.collection('belanja').onSnapshot((snapshot) => {
      const cloudExpenses = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        cloudExpenses.push({ id: doc.id, ...d });
      });
      saveRawBelanja(cloudExpenses);
      if (onUpdateCallback) onUpdateCallback();
    }, err => {
      console.warn('Firestore belanja stream error:', err);
    });

  } catch (err) {
    console.warn('Firestore subscription failed:', err);
    if (onUpdateCallback) onUpdateCallback();
  }
}

// Compute Balances dynamically from active database
function calculateUserBalance(userId) {
  const savings = getRawTabungan();
  const expenses = getRawBelanja();

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

// Add Tabungan (Income) directly to Firebase Cloud Firestore DB
async function addTabunganTransaction(userId, jumlah, keterangan, tanggal) {
  const newItem = {
    user_id: userId,
    jumlah: Number(jumlah),
    keterangan: keterangan || 'Tabungan Masuk',
    tanggal: tanggal || getTodayString(),
    createdAt: new Date().toISOString()
  };

  if (window.firebaseDb && window.isFirebaseConnected()) {
    try {
      const docRef = await window.firebaseDb.collection('tabungan').add(newItem);
      newItem.id = docRef.id;
    } catch (e) {
      console.warn('Firestore write tabungan fallback:', e);
      newItem.id = 'tab_' + Date.now();
    }
  } else {
    newItem.id = 'tab_' + Date.now();
  }

  // Update Local Storage Cache
  const list = getRawTabungan();
  list.unshift(newItem);
  saveRawTabungan(list);

  return newItem;
}

// Add Belanja (Expense) directly to Firebase Cloud Firestore DB
async function addBelanjaTransaction(userId, nama_item, jumlah, kategori, tanggal) {
  const newItem = {
    user_id: userId,
    nama_item: nama_item,
    jumlah: Number(jumlah),
    kategori: kategori || 'Umum',
    tanggal: tanggal || getTodayString(),
    createdAt: new Date().toISOString()
  };

  if (window.firebaseDb && window.isFirebaseConnected()) {
    try {
      const docRef = await window.firebaseDb.collection('belanja').add(newItem);
      newItem.id = docRef.id;
    } catch (e) {
      console.warn('Firestore write belanja fallback:', e);
      newItem.id = 'bel_' + Date.now();
    }
  } else {
    newItem.id = 'bel_' + Date.now();
  }

  // Update Local Storage Cache
  const list = getRawBelanja();
  list.unshift(newItem);
  saveRawBelanja(list);

  return newItem;
}

// Get All Transactions Merged & Sorted
function getAllTransactions(userId) {
  const savings = getRawTabungan().map(t => ({
    ...t,
    type: 'tabungan',
    title: t.keterangan || 'Tabungan',
    amount: t.jumlah
  }));

  const expenses = getRawBelanja().map(b => ({
    ...b,
    type: 'belanja',
    title: b.nama_item || 'Belanja',
    amount: b.jumlah
  }));

  const combined = [...savings, ...expenses];
  combined.sort((a, b) => new Date(b.tanggal + 'T' + (b.createdAt ? b.createdAt.substring(11,19) : '00:00:00')) - new Date(a.tanggal + 'T' + (a.createdAt ? a.createdAt.substring(11,19) : '00:00:00')));
  return combined;
}

// Delete Transaction from Cloud & Local
async function deleteTransactionItem(id, type) {
  if (type === 'tabungan') {
    let list = getRawTabungan();
    list = list.filter(item => item.id !== id);
    saveRawTabungan(list);
    if (window.firebaseDb && window.isFirebaseConnected()) {
      try { await window.firebaseDb.collection('tabungan').doc(id).delete(); } catch(e){}
    }
  } else if (type === 'belanja') {
    let list = getRawBelanja();
    list = list.filter(item => item.id !== id);
    saveRawBelanja(list);
    if (window.firebaseDb && window.isFirebaseConnected()) {
      try { await window.firebaseDb.collection('belanja').doc(id).delete(); } catch(e){}
    }
  }
}
