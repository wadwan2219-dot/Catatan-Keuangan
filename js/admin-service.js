/**
 * SaldoKu - Admin Service (js/admin-service.js)
 * Enterprise-grade User Management & Feature Flag Engine.
 * Supports Supabase Database, Cloud Firestore, and LocalStorage Hybrid Drivers.
 */

(function (window) {
  'use strict';

  const STORAGE_KEY_REGISTRY = 'saldoku_registered_accounts';
  const STORAGE_KEY_FEATURES = 'saldoku_feature_flags_registry';

  // Master accounts that cannot be suspended or deleted by anyone
  const PROTECTED_ACCOUNTS = [
    'admin@saldoku.id',
    'admin_master',
    'wadwan2219@gmail.com',
    'wadwan',
    'bersama@gmail.com',
    'bersama',
    'iwan@gmail.com',
    'iwan',
    'wadda@gmail.com',
    'wadda'
  ];

  const DEFAULT_FEATURES = {
    debt_ledger: true,      // Buku Kas Hutang Piutang
    dual_pocket: true,      // Kas Siap Pakai vs Tabungan
    cash_bank_split: true,  // Pemisahan Rekening Bank vs Uang Tunai
    export_reports: true    // Ekspor Laporan Excel/PDF
  };

  /**
   * Checks if an account is protected against suspension or deletion.
   */
  function isProtectedAccount(identifier) {
    if (!identifier) return false;
    const clean = String(identifier).toLowerCase().trim();
    return PROTECTED_ACCOUNTS.some(p => p.toLowerCase() === clean);
  }

  /**
   * Retrieves feature flag overrides stored in LocalStorage.
   */
  function getStoredFeatureFlags() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FEATURES);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Saves feature flag overrides to LocalStorage.
   */
  function saveStoredFeatureFlags(flagsMap) {
    try {
      localStorage.setItem(STORAGE_KEY_FEATURES, JSON.stringify(flagsMap));
      window.dispatchEvent(new CustomEvent('saldoku_features_updated', { detail: flagsMap }));
    } catch (e) {}
  }

  /**
   * Fetches all registered users from LocalStorage, Supabase, and Firestore.
   * Merges and deduplicates into a single unified list.
   */
  async function getAllUsers() {
    const userMap = new Map();
    const flagsMap = getStoredFeatureFlags();

    // 1. Seed Accounts Fallback (Local Registry)
    let localUsers = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REGISTRY);
      if (raw) localUsers = JSON.parse(raw);
    } catch (e) {}

    // Ensure Master Accounts exist in registry
    const defaultMasterAccounts = [
      {
        uid: 'admin_master',
        email: 'admin@saldoku.id',
        nama: 'Super Administrator',
        role: 'admin',
        status: 'active',
        workspace_id: 'admin_workspace',
        created_at: '2026-09-01T00:00:00Z',
        features: { ...DEFAULT_FEATURES }
      },
      {
        uid: 'bersama',
        email: 'bersama@gmail.com',
        nama: 'Iwan & Wadda (Akun Bersama)',
        role: 'partner',
        status: 'active',
        workspace_id: 'fam_wadwan_main',
        created_at: '2026-09-20T00:00:00Z',
        features: { ...DEFAULT_FEATURES }
      },
      {
        uid: 'wadwan',
        email: 'wadwan2219@gmail.com',
        nama: 'WADWAN2219 (Akun Bersama)',
        role: 'partner',
        status: 'active',
        workspace_id: 'fam_wadwan_main',
        created_at: '2026-09-20T00:00:00Z',
        features: { ...DEFAULT_FEATURES }
      },
      {
        uid: 'iwan',
        email: 'iwan@gmail.com',
        nama: 'Iwan (Mode Personal)',
        role: 'partner',
        status: 'active',
        workspace_id: 'pribadi_iwan',
        created_at: '2026-09-20T00:00:00Z',
        features: { ...DEFAULT_FEATURES }
      },
      {
        uid: 'wadda',
        email: 'wadda@gmail.com',
        nama: 'Wadda (Mode Personal)',
        role: 'partner',
        status: 'active',
        workspace_id: 'pribadi_wadda',
        created_at: '2026-09-20T00:00:00Z',
        features: { ...DEFAULT_FEATURES }
      }
    ];

    defaultMasterAccounts.forEach(acc => {
      userMap.set(acc.email.toLowerCase(), { ...acc });
    });

    localUsers.forEach(u => {
      if (u && u.email) {
        const key = u.email.toLowerCase();
        const existing = userMap.get(key) || {};
        userMap.set(key, {
          uid: u.uid || existing.uid || ('user_' + Date.now()),
          email: u.email,
          nama: u.nama || existing.nama || u.email.split('@')[0],
          role: u.role || existing.role || 'user',
          status: u.status || existing.status || 'active',
          workspace_id: u.groupId || u.workspace_id || existing.workspace_id || ('fam_' + (u.uid || 'usr')),
          created_at: u.createdAt || u.created_at || existing.created_at || new Date().toISOString(),
          last_login: u.last_login || existing.last_login || null,
          features: u.features || flagsMap[u.uid] || flagsMap[u.email] || existing.features || { ...DEFAULT_FEATURES }
        });
      }
    });

    // 2. Fetch from Supabase public.users if connected
    if (window.isSupabaseConnected && window.isSupabaseConnected()) {
      try {
        const { data: sbUsers, error } = await window.supabaseClient.from('users').select('*');
        if (sbUsers && !error) {
          sbUsers.forEach(sb => {
            if (sb && sb.email) {
              const key = sb.email.toLowerCase();
              const existing = userMap.get(key) || {};
              userMap.set(key, {
                uid: sb.id || existing.uid || sb.email,
                email: sb.email,
                nama: sb.nama || existing.nama || sb.email.split('@')[0],
                role: sb.role || existing.role || 'user',
                status: sb.status || existing.status || 'active',
                workspace_id: sb.workspace_id || existing.workspace_id || ('fam_' + (sb.id || 'usr')),
                created_at: sb.created_at || existing.created_at || new Date().toISOString(),
                last_login: sb.last_login || existing.last_login || null,
                features: sb.features || flagsMap[sb.id] || flagsMap[sb.email] || existing.features || { ...DEFAULT_FEATURES }
              });
            }
          });
        }
      } catch (err) {
        console.warn('[AdminService] Supabase users fetch fallback:', err);
      }

      // 3. Scan Supabase debt_entries, tabungan, and belanja to discover any active accounts
      try {
        const { data: debtRows } = await window.supabaseClient.from('debt_entries').select('created_by_uid, created_by_name, group_id, created_at');
        if (debtRows) {
          debtRows.forEach(row => {
            if (row && row.created_by_uid && row.created_by_uid !== 'anon') {
              const nameClean = row.created_by_name || 'Pengguna';
              let found = false;
              for (const u of userMap.values()) {
                if (u.uid === row.created_by_uid || (u.nama && u.nama.toLowerCase() === nameClean.toLowerCase())) {
                  found = true;
                  break;
                }
              }
              if (!found) {
                const syntheticEmail = nameClean.toLowerCase().replace(/[^a-z0-9]/g, '') + '@saldoku.id';
                userMap.set(syntheticEmail, {
                  uid: row.created_by_uid,
                  email: syntheticEmail,
                  nama: nameClean,
                  role: 'user',
                  status: 'active',
                  workspace_id: row.group_id ? row.group_id.split(':')[0] : ('fam_' + row.created_by_uid),
                  created_at: row.created_at || new Date().toISOString(),
                  last_login: row.created_at || null,
                  features: { ...DEFAULT_FEATURES }
                });
              }
            }
          });
        }
      } catch (e) {}

      try {
        const { data: tabRows } = await window.supabaseClient.from('tabungan').select('user_id, group_id, created_at');
        if (tabRows) {
          tabRows.forEach(row => {
            if (row && row.user_id && row.user_id !== 'iwan' && row.user_id !== 'wadda' && row.user_id !== 'bersama') {
              let found = false;
              for (const u of userMap.values()) {
                if (u.uid === row.user_id || u.email.toLowerCase().startsWith(row.user_id.toLowerCase())) {
                  found = true;
                  break;
                }
              }
              if (!found) {
                const syntheticEmail = row.user_id.toLowerCase().replace(/[^a-z0-9]/g, '') + '@saldoku.id';
                userMap.set(syntheticEmail, {
                  uid: row.user_id,
                  email: syntheticEmail,
                  nama: 'Pengguna (' + row.user_id + ')',
                  role: 'user',
                  status: 'active',
                  workspace_id: row.group_id ? row.group_id.split(':')[0] : ('fam_' + row.user_id),
                  created_at: row.created_at || new Date().toISOString(),
                  last_login: row.created_at || null,
                  features: { ...DEFAULT_FEATURES }
                });
              }
            }
          });
        }
      } catch (e) {}
    }

    // 4. Fetch from Cloud Firestore with Anonymous Auth if unauthenticated
    if (window.firebaseDb && typeof window.isFirebaseConnected === 'function' && window.isFirebaseConnected()) {
      try {
        if (window.firebaseAuth && !window.firebaseAuth.currentUser) {
          try {
            await window.firebaseAuth.signInAnonymously();
          } catch (authErr) {}
        }
        const snapshot = await window.firebaseDb.collection('users').get();
        snapshot.forEach(doc => {
          const d = doc.data();
          if (d && d.email) {
            const key = d.email.toLowerCase();
            const existing = userMap.get(key) || {};
            userMap.set(key, {
              uid: doc.id || existing.uid,
              email: d.email,
              nama: d.nama || existing.nama || d.email.split('@')[0],
              role: d.role || existing.role || 'user',
              status: d.status || existing.status || 'active',
              workspace_id: d.groupId || d.workspace_id || existing.workspace_id || ('fam_' + doc.id),
              created_at: d.createdAt || d.created_at || existing.created_at || new Date().toISOString(),
              last_login: d.last_login || existing.last_login || null,
              features: d.features || flagsMap[doc.id] || flagsMap[d.email] || existing.features || { ...DEFAULT_FEATURES }
            });
          }
        });
      } catch (err) {
        console.warn('[AdminService] Firestore users fetch fallback:', err);
      }
    }

    // Auto-heal / sync all discovered users to Supabase users table
    if (window.isSupabaseConnected && window.isSupabaseConnected()) {
      try {
        const toSync = [];
        userMap.forEach((u) => {
          if (u.uid && u.email && u.role !== 'admin') {
            toSync.push({
              id: u.uid,
              nama: u.nama || u.email.split('@')[0],
              email: u.email,
              role: u.role || 'user'
            });
          }
        });
        if (toSync.length > 0) {
          window.supabaseClient.from('users').upsert(toSync, { onConflict: 'id' }).then(() => {});
        }
      } catch (syncErr) {}
    }

    // Apply any local feature flags overrides
    const result = Array.from(userMap.values()).map(u => {
      const overrides = flagsMap[u.uid] || flagsMap[u.email] || flagsMap[u.workspace_id];
      if (overrides) {
        u.features = { ...u.features, ...overrides };
      }
      return u;
    });

    // Sort: Admins first, then partners, then latest users
    result.sort((a, b) => {
      if (a.role === 'admin') return -1;
      if (b.role === 'admin') return 1;
      if (a.role === 'partner' && b.role !== 'partner') return -1;
      if (b.role === 'partner' && a.role !== 'partner') return 1;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });

    return result;
  }

  /**
   * Updates an account's status (active vs suspended).
   */
  async function updateUserStatus(uidOrEmail, newStatus) {
    if (!uidOrEmail) throw new Error('ID atau email pengguna wajib diisi.');
    const statusClean = newStatus === 'suspended' ? 'suspended' : 'active';

    if (statusClean === 'suspended' && isProtectedAccount(uidOrEmail)) {
      throw new Error('Akun utama Administrator atau Akun Bersama Iwan & Wadda tidak dapat dinonaktifkan.');
    }

    // 1. Update in LocalStorage Registry
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REGISTRY);
      let localUsers = raw ? JSON.parse(raw) : [];
      let found = false;
      localUsers = localUsers.map(u => {
        if (u.uid === uidOrEmail || u.email.toLowerCase() === uidOrEmail.toLowerCase()) {
          found = true;
          return { ...u, status: statusClean };
        }
        return u;
      });
      if (!found) {
        localUsers.push({ uid: uidOrEmail, email: uidOrEmail, status: statusClean });
      }
      localStorage.setItem(STORAGE_KEY_REGISTRY, JSON.stringify(localUsers));
    } catch (e) {}

    // 2. Update in Supabase public.users if connected
    if (window.isSupabaseConnected && window.isSupabaseConnected()) {
      try {
        await window.supabaseClient.from('users')
          .update({ status: statusClean })
          .or(`id.eq.${uidOrEmail},email.eq.${uidOrEmail}`);
      } catch (e) {}
    }

    // 3. Update in Cloud Firestore if connected
    if (window.firebaseDb && typeof window.isFirebaseConnected === 'function' && window.isFirebaseConnected()) {
      try {
        await window.firebaseDb.collection('users').doc(uidOrEmail).update({ status: statusClean });
      } catch (e) {
        // Query by email fallback
        try {
          const q = await window.firebaseDb.collection('users').where('email', '==', uidOrEmail).get();
          q.forEach(doc => doc.ref.update({ status: statusClean }));
        } catch (err2) {}
      }
    }

    // 4. If current user is suspended, invalidate session
    const current = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (current && (current.uid === uidOrEmail || current.email === uidOrEmail) && statusClean === 'suspended') {
      current.status = 'suspended';
      localStorage.setItem('saldoku_user_session', JSON.stringify(current));
    }

    return true;
  }

  /**
   * Updates feature flags for a specific account.
   */
  async function updateUserFeatures(uidOrEmail, featuresObj) {
    if (!uidOrEmail) throw new Error('ID akun wajib disertakan.');

    const flagsMap = getStoredFeatureFlags();
    flagsMap[uidOrEmail] = { ...(flagsMap[uidOrEmail] || DEFAULT_FEATURES), ...featuresObj };
    saveStoredFeatureFlags(flagsMap);

    // 1. Update LocalStorage accounts
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REGISTRY);
      if (raw) {
        let localUsers = JSON.parse(raw);
        localUsers = localUsers.map(u => {
          if (u.uid === uidOrEmail || (u.email && u.email.toLowerCase() === uidOrEmail.toLowerCase())) {
            return { ...u, features: flagsMap[uidOrEmail] };
          }
          return u;
        });
        localStorage.setItem(STORAGE_KEY_REGISTRY, JSON.stringify(localUsers));
      }
    } catch (e) {}

    // 2. Update Supabase if connected
    if (window.isSupabaseConnected && window.isSupabaseConnected()) {
      try {
        await window.supabaseClient.from('users')
          .update({ features: flagsMap[uidOrEmail] })
          .or(`id.eq.${uidOrEmail},email.eq.${uidOrEmail}`);
      } catch (e) {}
    }

    // 3. Update Firestore if connected
    if (window.firebaseDb && typeof window.isFirebaseConnected === 'function' && window.isFirebaseConnected()) {
      try {
        await window.firebaseDb.collection('users').doc(uidOrEmail).update({ features: flagsMap[uidOrEmail] });
      } catch (e) {
        try {
          const q = await window.firebaseDb.collection('users').where('email', '==', uidOrEmail).get();
          q.forEach(doc => doc.ref.update({ features: flagsMap[uidOrEmail] }));
        } catch (err2) {}
      }
    }

    // 4. Update active session if target is current user
    const current = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (current && (current.uid === uidOrEmail || current.email === uidOrEmail)) {
      current.features = flagsMap[uidOrEmail];
      localStorage.setItem('saldoku_user_session', JSON.stringify(current));
    }

    return flagsMap[uidOrEmail];
  }

  /**
   * Permanently deletes a user account and purges their workspace data.
   */
  async function deleteUser(uidOrEmail, workspaceId) {
    if (!uidOrEmail) throw new Error('Identitas akun wajib ditentukan.');

    if (isProtectedAccount(uidOrEmail) || (workspaceId && isProtectedAccount(workspaceId))) {
      throw new Error('Akun Super Administrator dan Akun Utama Iwan & Wadda tidak dapat dihapus.');
    }

    // 1. Remove from LocalStorage accounts
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REGISTRY);
      if (raw) {
        let localUsers = JSON.parse(raw);
        localUsers = localUsers.filter(u => u.uid !== uidOrEmail && u.email.toLowerCase() !== uidOrEmail.toLowerCase());
        localStorage.setItem(STORAGE_KEY_REGISTRY, JSON.stringify(localUsers));
      }
    } catch (e) {}

    // 2. Remove feature flags
    const flagsMap = getStoredFeatureFlags();
    delete flagsMap[uidOrEmail];
    if (workspaceId) delete flagsMap[workspaceId];
    saveStoredFeatureFlags(flagsMap);

    // 3. Purge workspace transaction records locally
    if (workspaceId && workspaceId !== 'fam_wadwan_main') {
      try {
        const rawTab = localStorage.getItem('saldoku_data_tabungan');
        if (rawTab) {
          const list = JSON.parse(rawTab);
          const filtered = list.filter(item => !String(item.group_id).startsWith(workspaceId));
          localStorage.setItem('saldoku_data_tabungan', JSON.stringify(filtered));
        }
        const rawBel = localStorage.getItem('saldoku_data_belanja');
        if (rawBel) {
          const list = JSON.parse(rawBel);
          const filtered = list.filter(item => !String(item.group_id).startsWith(workspaceId));
          localStorage.setItem('saldoku_data_belanja', JSON.stringify(filtered));
        }
        const rawDebt = localStorage.getItem('saldoku_debt_entries');
        if (rawDebt) {
          const list = JSON.parse(rawDebt);
          const filtered = list.filter(item => !String(item.group_id).startsWith(workspaceId) && !String(item.groupId).startsWith(workspaceId));
          localStorage.setItem('saldoku_debt_entries', JSON.stringify(filtered));
        }
      } catch (e) {}
    }

    // 4. Delete from Supabase public.users and purge tables
    if (window.isSupabaseConnected && window.isSupabaseConnected()) {
      try {
        await window.supabaseClient.from('users').delete().or(`id.eq.${uidOrEmail},email.eq.${uidOrEmail}`);
        if (workspaceId && workspaceId !== 'fam_wadwan_main') {
          await window.supabaseClient.from('tabungan').delete().like('group_id', `${workspaceId}%`);
          await window.supabaseClient.from('belanja').delete().like('group_id', `${workspaceId}%`);
          await window.supabaseClient.from('debt_entries').delete().like('group_id', `${workspaceId}%`);
        }
      } catch (e) {}
    }

    // 5. Delete from Cloud Firestore
    if (window.firebaseDb && typeof window.isFirebaseConnected === 'function' && window.isFirebaseConnected()) {
      try {
        await window.firebaseDb.collection('users').doc(uidOrEmail).delete();
      } catch (e) {
        try {
          const q = await window.firebaseDb.collection('users').where('email', '==', uidOrEmail).get();
          q.forEach(doc => doc.ref.delete());
        } catch (err2) {}
      }
    }

    return true;
  }

  /**
   * Helper to retrieve feature flags for an active user or workspace.
   */
  function getAccountFeatures(userOrIdentifier) {
    if (!userOrIdentifier) return { ...DEFAULT_FEATURES };

    let key = '';
    if (typeof userOrIdentifier === 'string') {
      key = userOrIdentifier;
    } else {
      // Super Admin and Iwan & Wadda always have all features enabled
      if (userOrIdentifier.role === 'admin' || userOrIdentifier.role === 'superadmin') {
        return { ...DEFAULT_FEATURES };
      }
      if (userOrIdentifier.memberId === 'iwan' || userOrIdentifier.memberId === 'wadda' || userOrIdentifier.uid === 'wadwan' || userOrIdentifier.uid === 'bersama') {
        return { ...DEFAULT_FEATURES };
      }
      if (userOrIdentifier.features && typeof userOrIdentifier.features === 'object') {
        return { ...DEFAULT_FEATURES, ...userOrIdentifier.features };
      }
      key = userOrIdentifier.uid || userOrIdentifier.email || userOrIdentifier.workspace_id || userOrIdentifier.groupId;
    }

    const flagsMap = getStoredFeatureFlags();
    if (key && flagsMap[key]) {
      return { ...DEFAULT_FEATURES, ...flagsMap[key] };
    }

    return { ...DEFAULT_FEATURES };
  }

  // Export to global scope
  window.AdminService = {
    DEFAULT_FEATURES,
    PROTECTED_ACCOUNTS,
    isProtectedAccount,
    getAllUsers,
    updateUserStatus,
    updateUserFeatures,
    deleteUser,
    getAccountFeatures
  };

})(typeof window !== 'undefined' ? window : this);
