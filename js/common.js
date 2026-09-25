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
/**
 * Real-time Database Cloud Sync:
 * Supports Supabase Realtime (Priority) and Firebase Firestore.
 */
async function syncSupabaseData(onUpdateCallback) {
  if (!window.supabaseClient || !window.isSupabaseConnected()) return;

  try {
    // 1. Initial fetch from Supabase
    const { data: savings, error: errSav } = await window.supabaseClient.from('tabungan').select('*');
    if (savings && !errSav) saveRawTabungan(savings);

    const { data: expenses, error: errExp } = await window.supabaseClient.from('belanja').select('*');
    if (expenses && !errExp) saveRawBelanja(expenses);

    if (onUpdateCallback) onUpdateCallback();

    // 2. Realtime listener channel
    window.supabaseClient
      .channel('saldoku_cash_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tabungan' }, async () => {
        const { data } = await window.supabaseClient.from('tabungan').select('*');
        if (data) { saveRawTabungan(data); if (onUpdateCallback) onUpdateCallback(); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'belanja' }, async () => {
        const { data } = await window.supabaseClient.from('belanja').select('*');
        if (data) { saveRawBelanja(data); if (onUpdateCallback) onUpdateCallback(); }
      })
      .subscribe();
  } catch (err) {
    console.warn('Supabase sync error:', err);
  }
}

function syncFirestoreData(onUpdateCallback) {
  // If Supabase is connected, use Supabase Realtime
  if (window.isSupabaseConnected && window.isSupabaseConnected()) {
    syncSupabaseData(onUpdateCallback);
    return;
  }

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

// --------------------------------------------------------------------------
// 3-Actor Data Partitioning Helper (Iwan & Wadda share group_default, Umum separated)
// --------------------------------------------------------------------------
function getUserTabungan(userId) {
  const all = getRawTabungan();
  const currentUser = getCurrentUser();
  if (currentUser && (currentUser.role === 'partner' || ['iwan', 'wadda'].includes(currentUser.uid))) {
    return all.filter(item => ['iwan', 'wadda'].includes(item.user_id) || item.group_id === 'group_default');
  }
  return all.filter(item => item.user_id === userId);
}

function getUserBelanja(userId) {
  const all = getRawBelanja();
  const currentUser = getCurrentUser();
  if (currentUser && (currentUser.role === 'partner' || ['iwan', 'wadda'].includes(currentUser.uid))) {
    return all.filter(item => ['iwan', 'wadda'].includes(item.user_id) || item.group_id === 'group_default');
  }
  return all.filter(item => item.user_id === userId);
}

// Compute Balances dynamically from active database
function calculateUserBalance(userId) {
  const savings = getUserTabungan(userId);
  const expenses = getUserBelanja(userId);

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

// Add Tabungan (Income) directly to Supabase / Firebase / Local
async function addTabunganTransaction(userId, jumlah, keterangan, tanggal) {
  const currentUser = getCurrentUser();
  const isPartner = currentUser && (currentUser.role === 'partner' || ['iwan', 'wadda'].includes(userId));
  const groupId = isPartner ? 'group_default' : (userId || 'user_default');

  const newItem = {
    id: 'tab_' + Date.now(),
    user_id: userId,
    group_id: groupId,
    jumlah: Number(jumlah),
    keterangan: keterangan || 'Tabungan Masuk',
    tanggal: tanggal || getTodayString(),
    createdAt: new Date().toISOString()
  };

  // 1. Try Supabase if connected
  if (window.isSupabaseConnected && window.isSupabaseConnected()) {
    try {
      const dbRow = {
        id: newItem.id,
        user_id: newItem.user_id,
        group_id: newItem.group_id,
        jumlah: newItem.jumlah,
        keterangan: newItem.keterangan,
        tanggal: newItem.tanggal
      };
      await window.supabaseClient.from('tabungan').insert([dbRow]);
    } catch (e) {
      console.warn('Supabase write tabungan fallback:', e);
    }
  } else if (window.firebaseDb && window.isFirebaseConnected()) {
    try {
      const docRef = await window.firebaseDb.collection('tabungan').add(newItem);
      newItem.id = docRef.id;
    } catch (e) {
      console.warn('Firestore write tabungan fallback:', e);
    }
  }

  // 2. Update Local Storage Cache
  const list = getRawTabungan();
  list.unshift(newItem);
  saveRawTabungan(list);

  return newItem;
}

// Add Belanja (Expense) directly to Supabase / Firebase / Local
async function addBelanjaTransaction(userId, nama_item, jumlah, kategori, tanggal) {
  const currentUser = getCurrentUser();
  const isPartner = currentUser && (currentUser.role === 'partner' || ['iwan', 'wadda'].includes(userId));
  const groupId = isPartner ? 'group_default' : (userId || 'user_default');

  const newItem = {
    id: 'bel_' + Date.now(),
    user_id: userId,
    group_id: groupId,
    nama_item: nama_item,
    jumlah: Number(jumlah),
    kategori: kategori || 'Umum',
    tanggal: tanggal || getTodayString(),
    createdAt: new Date().toISOString()
  };

  // 1. Try Supabase if connected
  if (window.isSupabaseConnected && window.isSupabaseConnected()) {
    try {
      const dbRow = {
        id: newItem.id,
        user_id: newItem.user_id,
        group_id: newItem.group_id,
        nama_item: newItem.nama_item,
        jumlah: newItem.jumlah,
        kategori: newItem.kategori,
        tanggal: newItem.tanggal
      };
      await window.supabaseClient.from('belanja').insert([dbRow]);
    } catch (e) {
      console.warn('Supabase write belanja fallback:', e);
    }
  } else if (window.firebaseDb && window.isFirebaseConnected()) {
    try {
      const docRef = await window.firebaseDb.collection('belanja').add(newItem);
      newItem.id = docRef.id;
    } catch (e) {
      console.warn('Firestore write belanja fallback:', e);
    }
  }

  // 2. Update Local Storage Cache
  const list = getRawBelanja();
  list.unshift(newItem);
  saveRawBelanja(list);

  return newItem;
}

// Get All Transactions Merged & Sorted
function getAllTransactions(userId) {
  const savings = getUserTabungan(userId).map(t => ({
    ...t,
    type: 'tabungan',
    title: t.keterangan || 'Tabungan',
    amount: t.jumlah
  }));

  const expenses = getUserBelanja(userId).map(b => ({
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
  } else if (type === 'belanja') {
    let list = getRawBelanja();
    list = list.filter(item => item.id !== id);
    saveRawBelanja(list);
  }

  // Delete from Supabase
  if (window.isSupabaseConnected && window.isSupabaseConnected()) {
    try {
      await window.supabaseClient.from(type).delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  } else if (window.firebaseDb && window.isFirebaseConnected()) {
    try {
      await window.firebaseDb.collection(type).doc(id).delete();
    } catch (e) {}
  }
}
