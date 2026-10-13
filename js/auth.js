/**
 * SaldoKu - Authentication Logic (auth.js)
 * Implements strict Firebase Auth & Database Account verification.
 * Rejects unregistered/random emails & passwords.
 */

document.addEventListener('DOMContentLoaded', () => {
  // If user is already logged in, redirect to their respective dashboard
  const currentUser = getCurrentUser();
  if (currentUser && (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/'))) {
    if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
      window.location.href = 'admin.html';
      return;
    }
    if (currentUser.memberId === 'iwan') {
      window.location.href = 'dashboard-iwan.html';
      return;
    }
    if (currentUser.memberId === 'wadda') {
      window.location.href = 'dashboard-wadda.html';
      return;
    }
    window.location.href = 'dashboard.html';
    return;
  }

  const tabLoginBtn = document.getElementById('tab-login');
  const tabRegisterBtn = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  // Background cloud registry sync
  try {
    const raw = localStorage.getItem('saldoku_registered_accounts');
    if (raw) {
      const list = JSON.parse(raw);
      list.filter(u => u && u.email && u.role !== 'admin').forEach(u => {
        if (typeof window.syncUserToSupabaseCloud === 'function') {
          window.syncUserToSupabaseCloud(u);
        }
      });
    }
  } catch (e) {}

  // Tab switching logic
  if (tabLoginBtn && tabRegisterBtn) {
    tabLoginBtn.addEventListener('click', () => {
      tabLoginBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25';
      tabRegisterBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-400 hover:text-white';
      
      formLogin.classList.remove('hidden');
      formRegister.classList.add('hidden');
    });

    tabRegisterBtn.addEventListener('click', () => {
      tabRegisterBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25';
      tabLoginBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-400 hover:text-white';
      
      formRegister.classList.remove('hidden');
      formLogin.classList.add('hidden');
    });
  }

  // ------------------------------------------------------------------------
  // Helper: Setup Password Visibility Toggle
  // ------------------------------------------------------------------------
  function setupPasswordToggle(btnId, inputId, eyeOpenId, eyeClosedId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    const eyeOpen = document.getElementById(eyeOpenId);
    const eyeClosed = document.getElementById(eyeClosedId);

    if (btn && input) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        if (eyeOpen && eyeClosed) {
          eyeOpen.classList.toggle('hidden', !isPassword);
          eyeClosed.classList.toggle('hidden', isPassword);
        }
      });
    }
  }

  // Initialize Password Toggles
  setupPasswordToggle('btn-toggle-password', 'login-password', 'icon-eye-open', 'icon-eye-closed');
  setupPasswordToggle('btn-toggle-reg-password', 'reg-password', 'icon-reg-eye-open', 'icon-reg-eye-closed');
  setupPasswordToggle('btn-toggle-reg-confirm-password', 'reg-confirm-password', 'icon-reg-confirm-eye-open', 'icon-reg-confirm-eye-closed');

  // ------------------------------------------------------------------------
  // Helper: Real-Time Password Validation Feedback
  // ------------------------------------------------------------------------
  const SVG_ICON_CHECK = `<svg class="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>`;
  const SVG_ICON_CROSS = `<svg class="w-3.5 h-3.5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>`;
  const SVG_ICON_DOT = `<span class="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0"></span>`;

  function initRegisterRealtimeValidation() {
    const regPass = document.getElementById('reg-password');
    const regConfirm = document.getElementById('reg-confirm-password');
    const ruleLength = document.getElementById('rule-length');
    const ruleMatch = document.getElementById('rule-match');
    const iconLength = document.getElementById('icon-rule-length');
    const iconMatch = document.getElementById('icon-rule-match');

    if (!regPass || !regConfirm || !ruleLength || !ruleMatch) return;

    function evaluateRules() {
      const p = regPass.value;
      const c = regConfirm.value;

      // 1. Min 6 characters
      if (p.length >= 6) {
        ruleLength.className = 'flex items-center gap-2 text-[11px] text-emerald-400 font-medium transition-colors';
        if (iconLength) iconLength.innerHTML = SVG_ICON_CHECK;
      } else {
        ruleLength.className = 'flex items-center gap-2 text-[11px] text-slate-400 transition-colors';
        if (iconLength) iconLength.innerHTML = SVG_ICON_DOT;
      }

      // 2. Password Match
      if (c.length > 0) {
        if (p === c && p.length >= 6) {
          ruleMatch.className = 'flex items-center gap-2 text-[11px] text-emerald-400 font-medium transition-colors';
          if (iconMatch) iconMatch.innerHTML = SVG_ICON_CHECK;
        } else {
          ruleMatch.className = 'flex items-center gap-2 text-[11px] text-rose-400 font-medium transition-colors';
          if (iconMatch) iconMatch.innerHTML = SVG_ICON_CROSS;
        }
      } else {
        ruleMatch.className = 'flex items-center gap-2 text-[11px] text-slate-400 transition-colors';
        if (iconMatch) iconMatch.innerHTML = SVG_ICON_DOT;
      }
    }

    regPass.addEventListener('input', evaluateRules);
    regConfirm.addEventListener('input', evaluateRules);
  }

  initRegisterRealtimeValidation();

  // ------------------------------------------------------------------------
  // Helper: Register Button Loading State
  // ------------------------------------------------------------------------
  function setRegisterLoading(isLoading) {
    const btn = document.getElementById('btn-submit-register');
    const spinner = document.getElementById('btn-reg-spinner');
    const text = document.getElementById('btn-reg-text');
    if (!btn) return;

    if (isLoading) {
      btn.disabled = true;
      btn.classList.add('opacity-75', 'cursor-not-allowed');
      btn.classList.remove('active:scale-[0.98]');
      if (spinner) spinner.classList.remove('hidden');
      if (text) text.textContent = 'Mendaftarkan Akun...';
    } else {
      btn.disabled = false;
      btn.classList.remove('opacity-75', 'cursor-not-allowed');
      btn.classList.add('active:scale-[0.98]');
      if (spinner) spinner.classList.add('hidden');
      if (text) text.textContent = 'Daftar Akun';
    }
  }

  // ------------------------------------------------------------------------
  // 1. STRICT REGISTER FORM SUBMISSION (Firebase Auth + Firestore)
  // ------------------------------------------------------------------------
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = (document.getElementById('reg-nama')?.value || '').trim();
      const email = (document.getElementById('reg-email')?.value || '').trim().toLowerCase();
      const password = document.getElementById('reg-password')?.value || '';
      const confirmPassword = document.getElementById('reg-confirm-password')?.value || '';

      if (!nama || !email || !password) {
        showToast('Semua bidang formulir harus diisi!', 'error');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Format email tidak valid!', 'error');
        return;
      }

      if (password.length < 6) {
        showToast('Kata sandi minimal 6 karakter!', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showToast('Konfirmasi kata sandi tidak cocok!', 'error');
        return;
      }

      setRegisterLoading(true);

      // Check with Firebase Auth Service if connected
      if (window.firebaseAuth && window.isFirebaseConnected()) {
        try {
          const userCred = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
          const fbUser = userCred.user;

          const workspaceId = 'fam_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
          const userData = {
            uid: fbUser.uid,
            email: email,
            nama: nama,
            role: 'user',
            status: 'active',
            isJoint: true,
            groupId: workspaceId,
            memberId: 'bersama',
            features: {
              debt_ledger: true,
              dual_pocket: true,
              cash_bank_split: true,
              export_reports: true
            },
            createdAt: new Date().toISOString()
          };

          if (window.firebaseDb) {
            await window.firebaseDb.collection('users').doc(fbUser.uid).set(userData);
          }

          // Also save in local registry
          try {
            let reg = JSON.parse(localStorage.getItem('saldoku_registered_accounts') || '[]');
            if (!reg.some(u => u.email.toLowerCase() === email.toLowerCase())) {
              reg.push(userData);
              localStorage.setItem('saldoku_registered_accounts', JSON.stringify(reg));
            }
          } catch (e) {}

          // Mirror to Supabase public.users in realtime with full metadata
          if (typeof window.syncUserToSupabaseCloud === 'function') {
            await window.syncUserToSupabaseCloud(userData);
          }

          setCurrentUser(userData);
          showToast('Pendaftaran akun berhasil.', 'success');
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
          return;
        } catch (err) {
          setRegisterLoading(false);
          let errText = 'Gagal mendaftarkan akun.';
          if (err.code === 'auth/email-already-in-use') errText = 'Email ini sudah terdaftar. Silakan masuk.';
          if (err.code === 'auth/invalid-email') errText = 'Format email tidak valid.';
          if (err.code === 'auth/weak-password') errText = 'Kata sandi minimal 6 karakter.';
          showToast(errText, 'error');
          return;
        }
      }

      // Local Registry Strict Fallback (If testing without Firebase)
      let registeredUsers = JSON.parse(localStorage.getItem('saldoku_registered_accounts') || '[]');
      const existing = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (existing) {
        setRegisterLoading(false);
        showToast('Email ini sudah terdaftar. Silakan masuk.', 'error');
        return;
      }

      const workspaceId = 'fam_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
      const newUser = {
        uid: 'user_' + Date.now(),
        email: email,
        nama: nama,
        passwordHash: btoa(password),
        role: 'user',
        status: 'active',
        isJoint: true,
        groupId: workspaceId,
        memberId: 'bersama',
        features: {
          debt_ledger: true,
          dual_pocket: true,
          cash_bank_split: true,
          export_reports: true
        },
        createdAt: new Date().toISOString()
      };
      registeredUsers.push(newUser);
      localStorage.setItem('saldoku_registered_accounts', JSON.stringify(registeredUsers));

      // Mirror to Supabase public.users if connected with full metadata
      if (typeof window.syncUserToSupabaseCloud === 'function') {
        await window.syncUserToSupabaseCloud(newUser);
      }

      setCurrentUser(newUser);
      showToast('Pendaftaran akun berhasil.', 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
    });
  }

  // ------------------------------------------------------------------------
  // 2. STRICT LOGIN FORM SUBMISSION (Firebase Auth + Registry Check)
  // ------------------------------------------------------------------------
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        showToast('Email dan kata sandi wajib diisi.', 'error');
        return;
      }

      // 0. Super Admin Immediate Verification
      if (email.toLowerCase() === 'admin@saldoku.id' && password === 'admin123') {
        const adminUser = {
          uid: 'admin_master',
          email: 'admin@saldoku.id',
          nama: 'Super Administrator',
          role: 'admin',
          status: 'active',
          isJoint: false,
          groupId: 'admin_workspace'
        };
        setCurrentUser(adminUser);
        showToast('Autentikasi Administrator Berhasil.', 'success');
        setTimeout(() => { window.location.href = 'admin.html'; }, 500);
        return;
      }

      // 1. Verify with Firebase Auth Service if connected
      if (window.firebaseAuth && window.isFirebaseConnected()) {
        try {
          const userCred = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
          const fbUser = userCred.user;

          let userObj = {
            uid: fbUser.uid,
            email: fbUser.email,
            nama: fbUser.displayName || fbUser.email.split('@')[0].toUpperCase(),
            role: 'partner',
            isJoint: true,
            groupId: 'fam_wadwan_main',
            memberId: 'bersama'
          };

          // Fetch name and workspace groupId from Firestore users collection
          if (window.firebaseDb) {
            try {
              const doc = await window.firebaseDb.collection('users').doc(fbUser.uid).get();
              if (doc.exists) {
                const data = doc.data();
                if (data.nama) userObj.nama = data.nama;
                if (data.groupId) userObj.groupId = data.groupId;
              }
            } catch (e) {}
          }

          if (typeof getActiveWorkspaceId === 'function') {
            userObj.groupId = getActiveWorkspaceId(userObj);
          }

          // Sync to Supabase public.users on successful login
          if (typeof window.syncUserToSupabaseCloud === 'function') {
            window.syncUserToSupabaseCloud(userObj);
          }

          setCurrentUser(userObj);
          showToast('Autentikasi berhasil. Membuka Akun Bersama.', 'success');
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
          return;
        } catch (err) {
          // If not found in Firebase, fall through to check local registry before failing
          let localAccounts = JSON.parse(localStorage.getItem('saldoku_registered_accounts') || '[]');
          const matchesLocal = localAccounts.some(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === btoa(password));
          if (!matchesLocal) {
            let errText = 'Email atau kata sandi tidak valid.';
            if (err.code === 'auth/user-not-found') errText = 'Akun tidak ditemukan. Silakan lakukan pendaftaran.';
            if (err.code === 'auth/wrong-password') errText = 'Kata sandi tidak sesuai.';
            if (err.code === 'auth/invalid-email') errText = 'Format email tidak valid.';
            showToast(errText, 'error');
            return;
          }
        }
      }

      // Local Registry Strict Fallback (Rejects unregistered / random accounts)
      let registeredUsers = JSON.parse(localStorage.getItem('saldoku_registered_accounts') || '[]');
      
      // Ensure default accounts and Super Admin exist
      if (!registeredUsers.some(u => u.email === 'admin@saldoku.id')) {
        registeredUsers.unshift({
          uid: 'admin_master',
          memberId: 'admin',
          email: 'admin@saldoku.id',
          passwordHash: btoa('admin123'),
          nama: 'Super Administrator',
          role: 'admin',
          status: 'active',
          isJoint: false,
          groupId: 'admin_workspace',
          features: { debt_ledger: true, dual_pocket: true, cash_bank_split: true, export_reports: true }
        });
        localStorage.setItem('saldoku_registered_accounts', JSON.stringify(registeredUsers));
      }

      if (!registeredUsers.some(u => u.email === 'wadwan2219@gmail.com')) {
        registeredUsers.push(
          { uid: 'wadwan', memberId: 'bersama', email: 'wadwan2219@gmail.com', passwordHash: btoa('wadwan123'), nama: 'WADWAN2219 (Akun Bersama)', role: 'partner', isJoint: true, groupId: 'fam_wadwan_main', status: 'active' },
          { uid: 'bersama', memberId: 'bersama', email: 'bersama@gmail.com', passwordHash: btoa('123456'), nama: 'Iwan & Wadda (Akun Bersama)', role: 'partner', isJoint: true, groupId: 'fam_wadwan_main', status: 'active' },
          { uid: 'iwan', memberId: 'iwan', email: 'iwan@gmail.com', passwordHash: btoa('123456'), nama: 'Iwan & Wadda (Akun Bersama)', role: 'partner', isJoint: true, groupId: 'pribadi_iwan', status: 'active' },
          { uid: 'wadda', memberId: 'wadda', email: 'wadda@gmail.com', passwordHash: btoa('123456'), nama: 'Iwan & Wadda (Akun Bersama)', role: 'partner', isJoint: true, groupId: 'pribadi_wadda', status: 'active' }
        );
        localStorage.setItem('saldoku_registered_accounts', JSON.stringify(registeredUsers));
      }

      const foundUser = registeredUsers.find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === btoa(password)
      );

      if (!foundUser) {
        showToast('Kredensial tidak valid. Silakan periksa email dan kata sandi.', 'error');
        return;
      }

      // Check Account Status (Suspended Guard)
      if (foundUser.status === 'suspended') {
        showToast('Akun Anda dinonaktifkan oleh Administrator.', 'error');
        return;
      }

      // 1. Super Admin Authentication Route
      if (foundUser.role === 'admin' || foundUser.role === 'superadmin' || foundUser.email === 'admin@saldoku.id') {
        const adminUser = {
          uid: foundUser.uid || 'admin_master',
          email: foundUser.email,
          nama: foundUser.nama || 'Super Administrator',
          role: 'admin',
          status: 'active',
          isJoint: false,
          groupId: 'admin_workspace'
        };
        setCurrentUser(adminUser);
        showToast('Autentikasi Administrator Berhasil.', 'success');
        setTimeout(() => { window.location.href = 'admin.html'; }, 600);
        return;
      }

      // 2. Standard / Joint User Authentication Route
      const jointUser = {
        uid: foundUser.uid || 'bersama',
        email: foundUser.email,
        nama: foundUser.nama || 'Iwan & Wadda (Akun Bersama)',
        memberId: foundUser.memberId || 'bersama',
        role: foundUser.role || 'partner',
        status: foundUser.status || 'active',
        features: foundUser.features || null,
        isJoint: true,
        groupId: foundUser.groupId || (typeof getActiveWorkspaceId === 'function' ? getActiveWorkspaceId(foundUser) : 'fam_wadwan_main')
      };

      // Sync user to Supabase public.users
      if (window.isSupabaseConnected && window.isSupabaseConnected() && foundUser.email !== 'admin@saldoku.id') {
        try {
          window.supabaseClient.from('users').upsert([{
            id: foundUser.uid || foundUser.email,
            nama: foundUser.nama || foundUser.email.split('@')[0],
            email: foundUser.email,
            role: foundUser.role || 'user'
          }], { onConflict: 'id' }).then(() => {});
        } catch (sbErr) {}
      }

      setCurrentUser(jointUser);
      showToast('Berhasil masuk ke Akun Bersama.', 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
    });
  }

  // ------------------------------------------------------------------------
  // 3. PIN AUTHENTICATION MODAL FOR PERSONAL MODE: IWAN (1912) & WADDA (2206)
  // ------------------------------------------------------------------------
  const PIN_CREDENTIALS = {
    iwan: '1912',
    wadda: '2206'
  };

  let activePinTarget = 'iwan';

  const modalPinAuth = document.getElementById('modal-pin-auth');
  const pinModalTitle = document.getElementById('pin-modal-title');
  const inputPinCode = document.getElementById('input-pin-code');
  const formPinAuth = document.getElementById('form-pin-auth');
  const btnClosePinModal = document.getElementById('btn-close-pin-modal');

  const demoIwanBtn = document.getElementById('btn-demo-iwan') || document.getElementById('btn-demo-budi');
  const demoWaddaBtn = document.getElementById('btn-demo-wadda') || document.getElementById('btn-demo-ani');

  function openPinModal(target) {
    activePinTarget = target;
    const isIwan = target === 'iwan';
    if (pinModalTitle) {
      pinModalTitle.textContent = isIwan ? 'PIN Pribadi Iwan' : 'PIN Pribadi Wadda';
    }
    if (inputPinCode) {
      inputPinCode.value = '';
    }
    if (modalPinAuth) {
      modalPinAuth.classList.remove('hidden');
      modalPinAuth.classList.add('flex');
      setTimeout(() => {
        if (inputPinCode) inputPinCode.focus();
      }, 100);
    }
  }

  function closePinModal() {
    if (modalPinAuth) {
      modalPinAuth.classList.add('hidden');
      modalPinAuth.classList.remove('flex');
    }
    if (inputPinCode) inputPinCode.value = '';
  }

  if (demoIwanBtn) {
    demoIwanBtn.addEventListener('click', () => openPinModal('iwan'));
  }

  if (demoWaddaBtn) {
    demoWaddaBtn.addEventListener('click', () => openPinModal('wadda'));
  }

  if (btnClosePinModal) {
    btnClosePinModal.addEventListener('click', closePinModal);
  }

  if (modalPinAuth) {
    modalPinAuth.addEventListener('click', (e) => {
      if (e.target === modalPinAuth) closePinModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalPinAuth && !modalPinAuth.classList.contains('hidden')) {
      closePinModal();
    }
  });

  if (formPinAuth) {
    formPinAuth.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredPin = inputPinCode ? inputPinCode.value.trim() : '';
      const correctPin = PIN_CREDENTIALS[activePinTarget];

      if (enteredPin !== correctPin) {
        showToast('PIN tidak sesuai. Akses ditolak.', 'error');
        if (inputPinCode) {
          inputPinCode.value = '';
          inputPinCode.focus();
        }
        return;
      }

      // PIN Mode is strictly PERSONAL ACCOUNT (No Debt Feature)
      const isIwan = activePinTarget === 'iwan';
      const personalUser = {
        uid: activePinTarget,
        memberId: activePinTarget,
        nama: isIwan ? 'Iwan (Pribadi)' : 'Wadda (Pribadi)',
        email: isIwan ? 'iwan@pribadi.com' : 'wadda@pribadi.com',
        role: 'personal',
        isJoint: false,
        groupId: 'pribadi_' + activePinTarget
      };

      setCurrentUser(personalUser);
      closePinModal();
      showToast(`Verifikasi berhasil. Membuka sesi ${isIwan ? 'Iwan' : 'Wadda'}.`, 'success');
      setTimeout(() => {
        window.location.href = isIwan ? 'dashboard-iwan.html' : 'dashboard-wadda.html';
      }, 500);
    });
  }
});
