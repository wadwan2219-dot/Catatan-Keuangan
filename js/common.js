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
// --------------------------------------------------------------------------
// 2. Toast Alert System (Clean Vector Icons)
// --------------------------------------------------------------------------
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold`;

  let iconSvg = '';
  if (type === 'error') {
    iconSvg = '<svg class="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
  } else if (type === 'warning') {
    iconSvg = '<svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
  } else if (type === 'info') {
    iconSvg = '<svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  } else {
    iconSvg = '<svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
  }

  toast.innerHTML = `
    ${iconSvg}
    <span class="text-slate-100">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// --------------------------------------------------------------------------
// 3. User Session Guard & Local Cache Cleanup
// --------------------------------------------------------------------------
function getCurrentUser() {
  const session = localStorage.getItem('saldoku_user_session');
  if (!session) return null;
  try {
    const user = JSON.parse(session);
    if (!user) return null;

    // Auto-normalize session:
    // Any user account with an email (or not explicitly marked as personal PIN mode)
    // is the Joint Account (Akun Bersama) with full debt access and shared cash partition.
    const isExplicitPersonal = user.role === 'personal' || user.isPersonal === true || user.uid === 'iwan' || user.uid === 'wadda';
    if (!isExplicitPersonal) {
      user.isJoint = true;
      user.groupId = user.groupId || 'group_default';
      user.memberId = user.memberId || 'bersama';
      user.role = user.role || 'partner';
    }
    return user;
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
  showToast('Sesi telah diakhiri.', 'info');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 500);
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
// Joint vs Personal Data Partitioning Helper & Debt Feature Visibility
// --------------------------------------------------------------------------
function isJointAccount() {
  const user = getCurrentUser();
  if (!user) return false;
  // Personal mode is strictly when entering via 4-digit PIN for Iwan or Wadda
  if (user.role === 'personal' || user.isPersonal === true || user.isJoint === false) {
    return false;
  }
  return true;
}

function setupDebtVisibility() {
  const hasDebtAccess = isJointAccount();
  if (!hasDebtAccess) {
    // Hide navigation links to hutang.html
    document.querySelectorAll('a[href="hutang.html"]').forEach(el => {
      el.style.display = 'none';
    });
    // Hide all elements marked with data-debt-feature
    document.querySelectorAll('[data-debt-feature]').forEach(el => {
      el.style.display = 'none';
    });
  } else {
    // Ensure all navigation links and debt feature cards are visible
    document.querySelectorAll('a[href="hutang.html"]').forEach(el => {
      el.style.removeProperty('display');
    });
    document.querySelectorAll('[data-debt-feature]').forEach(el => {
      el.style.removeProperty('display');
    });
  }
}
document.addEventListener('DOMContentLoaded', setupDebtVisibility);

// Dynamic Dashboard URL Resolver
function getDashboardUrl() {
  const user = getCurrentUser();
  if (user && user.memberId === 'iwan') return 'dashboard-iwan.html';
  if (user && user.memberId === 'wadda') return 'dashboard-wadda.html';
  return 'dashboard.html';
}

function syncDashboardNavigationLinks() {
  const user = getCurrentUser();
  if (!user) return;
  const dashUrl = getDashboardUrl();
  if (user.memberId === 'iwan' || user.memberId === 'wadda') {
    document.querySelectorAll('a[href="dashboard.html"]').forEach(el => {
      el.setAttribute('href', dashUrl);
    });
  }
}
document.addEventListener('DOMContentLoaded', syncDashboardNavigationLinks);

function getUserTabungan(userId) {
  const all = getRawTabungan();
  const currentUser = getCurrentUser();
  if (isJointAccount()) {
    // Akun bersama: melihat kas bersama (group_default atau tanpa group_id)
    return all.filter(item => !item.group_id || item.group_id === 'group_default');
  }
  // Akun pribadi: hanya melihat catatan pribadinya
  const personalGroup = 'pribadi_' + (userId || (currentUser ? currentUser.uid : ''));
  return all.filter(item => item.group_id === personalGroup || (!item.group_id && item.user_id === userId));
}

function getUserBelanja(userId) {
  const all = getRawBelanja();
  const currentUser = getCurrentUser();
  if (isJointAccount()) {
    // Akun bersama: melihat kas belanja bersama (group_default atau tanpa group_id)
    return all.filter(item => !item.group_id || item.group_id === 'group_default');
  }
  // Akun pribadi: hanya melihat belanja pribadinya
  const personalGroup = 'pribadi_' + (userId || (currentUser ? currentUser.uid : ''));
  return all.filter(item => item.group_id === personalGroup || (!item.group_id && item.user_id === userId));
}

// Compute Balances dynamically from active database (Dual-Pocket: Kas Siap Pakai & Tabungan)
function calculateUserBalance(userId) {
  const savings = getUserTabungan(userId);
  const expenses = getUserBelanja(userId);

  // Income by pocket
  let kasMasuk = 0;
  let tabunganMasuk = 0;
  savings.forEach(item => {
    const amt = Number(item.jumlah || 0);
    if (item.kantong === 'kas') {
      kasMasuk += amt;
    } else {
      // Default & legacy fallback: goes to tabungan
      tabunganMasuk += amt;
    }
  });

  // Expense by pocket
  let kasKeluar = 0;
  let tabunganKeluar = 0;
  expenses.forEach(item => {
    const amt = Number(item.jumlah || 0);
    if (item.sumber_dana === 'tabungan') {
      tabunganKeluar += amt;
    } else {
      // Default & legacy fallback: cuts from kas siap pakai
      kasKeluar += amt;
    }
  });

  const saldoKas = kasMasuk - kasKeluar;
  const saldoTabungan = tabunganMasuk - tabunganKeluar;
  const totalAset = saldoKas + saldoTabungan;
  const totalTabungan = tabunganMasuk + kasMasuk;
  const totalBelanja = kasKeluar + tabunganKeluar;
  const sisaSaldo = totalAset;

  return {
    totalTabungan,
    totalBelanja,
    sisaSaldo,
    countTabungan: savings.length,
    countBelanja: expenses.length,
    // Dual-pocket extensions (Opsi A)
    saldoKas,
    saldoTabungan,
    totalAset,
    kasMasuk,
    tabunganMasuk,
    kasKeluar,
    tabunganKeluar
  };
}

// Add Tabungan / Pemasukan directly to Supabase / Firebase / Local with pocket selector
async function addTabunganTransaction(userId, jumlah, keterangan, tanggal, kantong = 'tabungan') {
  const currentUser = getCurrentUser();
  const isJoint = currentUser && currentUser.isJoint === true;
  const groupId = isJoint ? 'group_default' : ('pribadi_' + userId);
  const pocket = kantong === 'kas' ? 'kas' : 'tabungan';

  const newItem = {
    id: 'tab_' + Date.now(),
    user_id: userId,
    group_id: groupId,
    jumlah: Number(jumlah),
    keterangan: keterangan || (pocket === 'kas' ? 'Pemasukan Kas Siap Pakai' : 'Tabungan Masuk'),
    tanggal: tanggal || getTodayString(),
    kantong: pocket,
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
        tanggal: newItem.tanggal,
        kantong: newItem.kantong
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

// Add Belanja / Pengeluaran directly to Supabase / Firebase / Local with pocket source
async function addBelanjaTransaction(userId, nama_item, jumlah, kategori, tanggal, sumber_dana = 'kas') {
  const currentUser = getCurrentUser();
  const isJoint = currentUser && currentUser.isJoint === true;
  const groupId = isJoint ? 'group_default' : ('pribadi_' + userId);
  const pocketSource = sumber_dana === 'tabungan' ? 'tabungan' : 'kas';

  const newItem = {
    id: 'bel_' + Date.now(),
    user_id: userId,
    group_id: groupId,
    nama_item: nama_item,
    jumlah: Number(jumlah),
    kategori: kategori || 'Umum',
    tanggal: tanggal || getTodayString(),
    sumber_dana: pocketSource,
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
        tanggal: newItem.tanggal,
        sumber_dana: newItem.sumber_dana
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

// Transfer funds between pockets (Kas Siap Pakai <-> Tabungan)
async function transferAntarKantong(userId, dariKantong, keKantong, jumlah, catatan, tanggal) {
  const tgl = tanggal || getTodayString();
  const amt = Number(jumlah);
  if (!amt || amt <= 0) throw new Error('Nominal transfer tidak valid');

  const labelDari = dariKantong === 'kas' ? 'Kas Siap Pakai' : 'Tabungan';
  const labelKe = keKantong === 'tabungan' ? 'Tabungan' : 'Kas Siap Pakai';

  const descOut = catatan ? `Pindah ke ${labelKe}: ${catatan}` : `Pindah Dana ke ${labelKe}`;
  const descIn = catatan ? `Terima dari ${labelDari}: ${catatan}` : `Terima Dana dari ${labelDari}`;

  // Deduct from source pocket
  await addBelanjaTransaction(userId, descOut, amt, 'Pindah Dana', tgl, dariKantong);
  // Add to destination pocket
  await addTabunganTransaction(userId, amt, descIn, tgl, keKantong);

  return true;
}

// Get All Transactions Merged & Sorted
function getAllTransactions(userId) {
  const savings = getUserTabungan(userId).map(t => ({
    ...t,
    type: 'tabungan',
    title: t.keterangan || 'Pemasukan',
    amount: t.jumlah,
    pocket: t.kantong || 'tabungan'
  }));

  const expenses = getUserBelanja(userId).map(b => ({
    ...b,
    type: 'belanja',
    title: b.nama_item || 'Pengeluaran',
    amount: b.jumlah,
    pocket: b.sumber_dana || 'kas'
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
