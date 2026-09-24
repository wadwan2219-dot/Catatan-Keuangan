/**
 * SaldoKu - Debt Service (js/debt-service.js)
 * Data Access Layer for Net Debt Ledger.
 * Integrates Cloud Firestore (Zero-Config In-Memory Sorting) & LocalStorage Hybrid Driver.
 */

(function (window) {
  'use strict';

  const STORAGE_KEY_DEBT = 'saldoku_debt_entries';
  const DEFAULT_GROUP_ID = 'group_default';

  let activeUnsubscribe = null;
  let isSubmitting = false;

  /**
   * Generates a unique client request ID for idempotency and anti-duplicate submits.
   */
  function generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Reads raw debt entries from LocalStorage.
   */
  function getLocalEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DEBT);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse local debt entries:', e);
      return [];
    }
  }

  /**
   * Saves debt entries to LocalStorage.
   */
  function saveLocalEntries(list) {
    try {
      localStorage.setItem(STORAGE_KEY_DEBT, JSON.stringify(list));
      // Dispatch custom event for cross-component reactive updates
      window.dispatchEvent(new CustomEvent('saldoku_debt_updated', { detail: list }));
    } catch (e) {
      console.warn('Failed to save local debt entries:', e);
    }
  }

  /**
   * Sorts entries in-memory by date (descending) without needing Firestore composite indexes.
   */
  function sortEntries(entries) {
    return [...entries].sort((a, b) => {
      const dateA = (a.occurredAt || '') + ' ' + (a.createdAt || '');
      const dateB = (b.occurredAt || '') + ' ' + (b.createdAt || '');
      return dateB.localeCompare(dateA);
    });
  }

  /**
   * Checks if a given entry has already been reversed.
   */
  function isEntryReversed(entryId, entries) {
    if (!entryId || !Array.isArray(entries)) return false;
    return entries.some(e => e.kind === 'reversal' && e.reversesEntryId === entryId);
  }

  /**
   * Subscribes to real-time debt entries.
   * Works seamlessly with Cloud Firestore (if available) or LocalStorage.
   * Returns an unsubscribe function.
   */
  function subscribeEntries(callback) {
    if (typeof callback !== 'function') return () => {};

    // Initial emit from local cache immediately
    const initialList = sortEntries(getLocalEntries());
    callback(initialList);

    // If Firestore is connected, listen to Cloud collection
    if (window.firebaseDb && typeof window.isFirebaseConnected === 'function' && window.isFirebaseConnected()) {
      try {
        const debtCol = window.firebaseDb
          .collection('groups')
          .doc(DEFAULT_GROUP_ID)
          .collection('debtEntries');

        // Simple query without composite ordering -> Zero-Config, no index needed!
        const fbUnsubscribe = debtCol.onSnapshot(
          (snapshot) => {
            const cloudEntries = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              cloudEntries.push({ id: doc.id, ...data });
            });

            const sorted = sortEntries(cloudEntries);
            saveLocalEntries(sorted);
            callback(sorted);
          },
          (err) => {
            console.warn('Firestore debt subscription error, falling back to local storage:', err);
            callback(sortEntries(getLocalEntries()));
          }
        );

        activeUnsubscribe = fbUnsubscribe;
        return () => {
          if (typeof activeUnsubscribe === 'function') {
            activeUnsubscribe();
            activeUnsubscribe = null;
          }
        };
      } catch (err) {
        console.warn('Failed to start Firestore debt subscription:', err);
      }
    }

    // Fallback: Listen to local window events
    const localHandler = (e) => {
      callback(sortEntries(e.detail || getLocalEntries()));
    };
    window.addEventListener('saldoku_debt_updated', localHandler);

    return () => {
      window.removeEventListener('saldoku_debt_updated', localHandler);
    };
  }

  /**
   * Records a new Debt entry (Iwan owes Wadda or Wadda owes Iwan).
   */
  async function createDebt({ fromMemberId, toMemberId, amount, note, occurredAt }) {
    if (isSubmitting) {
      throw new Error('Transaksi sedang diproses, mohon tunggu sebentar.');
    }
    isSubmitting = true;

    try {
      const payload = {
        schemaVersion: 1,
        kind: 'debt',
        fromMemberId,
        toMemberId,
        amount: Number(amount),
        note: (note || '').trim(),
        occurredAt: occurredAt || (typeof window.getTodayString === 'function' ? window.getTodayString() : new Date().toISOString().slice(0, 10))
      };

      const validation = window.DebtEngine.validateEntry(payload);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const currentUser = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;

      const newEntry = {
        ...payload,
        createdAt: new Date().toISOString(),
        createdByUid: currentUser ? (currentUser.uid || 'anon') : 'anon',
        createdByName: currentUser ? (currentUser.nama || currentUser.email || 'Pengguna') : 'Pengguna',
        clientRequestId: generateRequestId()
      };

      // 1. Try writing to Firestore if connected
      if (window.firebaseDb && typeof window.isFirebaseConnected === 'function' && window.isFirebaseConnected()) {
        try {
          const docData = { ...newEntry };
          if (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
            docData.createdAtServer = window.firebase.firestore.FieldValue.serverTimestamp();
          }
          const docRef = await window.firebaseDb
            .collection('groups')
            .doc(DEFAULT_GROUP_ID)
            .collection('debtEntries')
            .add(docData);
          newEntry.id = docRef.id;
        } catch (fbErr) {
          console.warn('Firestore write fallback to local ID:', fbErr);
          newEntry.id = 'debt_' + Date.now();
        }
      } else {
        newEntry.id = 'debt_' + Date.now();
      }

      // 2. Always update local storage cache
      const currentList = getLocalEntries();
      // Guard against duplicate clientRequestId
      if (!currentList.some(item => item.clientRequestId === newEntry.clientRequestId)) {
        currentList.unshift(newEntry);
        saveLocalEntries(sortEntries(currentList));
      }

      return newEntry;
    } finally {
      isSubmitting = false;
    }
  }

  /**
   * Records a Debt Payment entry.
   */
  async function createPayment({ fromMemberId, toMemberId, amount, note, occurredAt }) {
    if (isSubmitting) {
      throw new Error('Transaksi sedang diproses, mohon tunggu sebentar.');
    }
    isSubmitting = true;

    try {
      const payload = {
        schemaVersion: 1,
        kind: 'payment',
        fromMemberId,
        toMemberId,
        amount: Number(amount),
        note: (note || '').trim(),
        occurredAt: occurredAt || (typeof window.getTodayString === 'function' ? window.getTodayString() : new Date().toISOString().slice(0, 10))
      };

      const validation = window.DebtEngine.validateEntry(payload);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const currentUser = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;

      const newEntry = {
        ...payload,
        createdAt: new Date().toISOString(),
        createdByUid: currentUser ? (currentUser.uid || 'anon') : 'anon',
        createdByName: currentUser ? (currentUser.nama || currentUser.email || 'Pengguna') : 'Pengguna',
        clientRequestId: generateRequestId()
      };

      // 1. Try writing to Firestore if connected
      if (window.firebaseDb && typeof window.isFirebaseConnected === 'function' && window.isFirebaseConnected()) {
        try {
          const docData = { ...newEntry };
          if (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
            docData.createdAtServer = window.firebase.firestore.FieldValue.serverTimestamp();
          }
          const docRef = await window.firebaseDb
            .collection('groups')
            .doc(DEFAULT_GROUP_ID)
            .collection('debtEntries')
            .add(docData);
          newEntry.id = docRef.id;
        } catch (fbErr) {
          console.warn('Firestore write fallback to local ID:', fbErr);
          newEntry.id = 'pay_' + Date.now();
        }
      } else {
        newEntry.id = 'pay_' + Date.now();
      }

      // 2. Update local storage cache
      const currentList = getLocalEntries();
      if (!currentList.some(item => item.clientRequestId === newEntry.clientRequestId)) {
        currentList.unshift(newEntry);
        saveLocalEntries(sortEntries(currentList));
      }

      return newEntry;
    } finally {
      isSubmitting = false;
    }
  }

  /**
   * Reverses (cancels) an existing entry without hard-deleting, preserving audit trail.
   */
  async function reverseEntry(originalEntry, note = '') {
    if (!originalEntry || !originalEntry.id) {
      throw new Error('Data entri asli tidak ditemukan untuk dibatalkan.');
    }

    if (originalEntry.kind === 'reversal') {
      throw new Error('Entri pembatalan tidak dapat dibatalkan kembali.');
    }

    const currentList = getLocalEntries();
    if (isEntryReversed(originalEntry.id, currentList)) {
      throw new Error('Entri ini sudah pernah dibatalkan sebelumnya.');
    }

    if (isSubmitting) {
      throw new Error('Proses sedang berjalan, mohon tunggu.');
    }
    isSubmitting = true;

    try {
      const originalDelta = window.DebtEngine.toSignedDelta(originalEntry);
      const currentUser = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;

      const reversalPayload = {
        schemaVersion: 1,
        kind: 'reversal',
        reversesEntryId: originalEntry.id,
        originalDelta: originalDelta,
        amount: originalEntry.amount,
        note: (note || '').trim() || `Pembatalan ${originalEntry.kind === 'debt' ? 'Hutang' : 'Pembayaran'} (${originalEntry.id})`,
        occurredAt: typeof window.getTodayString === 'function' ? window.getTodayString() : new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        createdByUid: currentUser ? (currentUser.uid || 'anon') : 'anon',
        createdByName: currentUser ? (currentUser.nama || currentUser.email || 'Pengguna') : 'Pengguna',
        clientRequestId: generateRequestId()
      };

      // 1. Try writing to Firestore if connected
      if (window.firebaseDb && typeof window.isFirebaseConnected === 'function' && window.isFirebaseConnected()) {
        try {
          const docData = { ...reversalPayload };
          if (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
            docData.createdAtServer = window.firebase.firestore.FieldValue.serverTimestamp();
          }
          const docRef = await window.firebaseDb
            .collection('groups')
            .doc(DEFAULT_GROUP_ID)
            .collection('debtEntries')
            .add(docData);
          reversalPayload.id = docRef.id;
        } catch (fbErr) {
          console.warn('Firestore write reversal fallback:', fbErr);
          reversalPayload.id = 'rev_' + Date.now();
        }
      } else {
        reversalPayload.id = 'rev_' + Date.now();
      }

      // 2. Update local storage cache
      currentList.unshift(reversalPayload);
      saveLocalEntries(sortEntries(currentList));

      return reversalPayload;
    } finally {
      isSubmitting = false;
    }
  }

  // Export to global scope
  window.DebtService = {
    DEFAULT_GROUP_ID,
    getLocalEntries,
    saveLocalEntries,
    isEntryReversed,
    subscribeEntries,
    createDebt,
    createPayment,
    reverseEntry
  };

})(typeof window !== 'undefined' ? window : this);
