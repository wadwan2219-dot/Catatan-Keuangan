/**
 * SaldoKu - Authentication Logic (auth.js)
 * Implements strict Firebase Auth & Database Account verification.
 * Rejects unregistered/random emails & passwords.
 */

document.addEventListener('DOMContentLoaded', () => {
  // If user is already logged in, redirect to their respective dashboard
  const currentUser = getCurrentUser();
  if (currentUser && (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/'))) {
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

  // Tab switching logic
  if (tabLoginBtn && tabRegisterBtn) {
    tabLoginBtn.addEventListener('click', () => {
      tabLoginBtn.classList.add('bg-indigo-600', 'text-white');
      tabLoginBtn.classList.remove('text-slate-400');
      tabRegisterBtn.classList.remove('bg-indigo-600', 'text-white');
      tabRegisterBtn.classList.add('text-slate-400');
      
      formLogin.classList.remove('hidden');
      formRegister.classList.add('hidden');
    });

    tabRegisterBtn.addEventListener('click', () => {
      tabRegisterBtn.classList.add('bg-indigo-600', 'text-white');
      tabRegisterBtn.classList.remove('text-slate-400');
      tabLoginBtn.classList.remove('bg-indigo-600', 'text-white');
      tabLoginBtn.classList.add('text-slate-400');
      
      formRegister.classList.remove('hidden');
      formLogin.classList.add('hidden');
    });
  }

  // ------------------------------------------------------------------------
  // 1. STRICT REGISTER FORM SUBMISSION (Firebase Auth + Firestore)
  // ------------------------------------------------------------------------
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = document.getElementById('reg-nama').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const confirmPassword = document.getElementById('reg-confirm-password').value;

      if (!nama || !email || !password) {
        showToast('Semua bidang formulir harus diisi!', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showToast('Konfirmasi kata sandi tidak cocok!', 'error');
        return;
      }

      if (password.length < 6) {
        showToast('Kata sandi minimal 6 karakter!', 'error');
        return;
      }

      // Check with Firebase Auth Service if connected
      if (window.firebaseAuth && window.isFirebaseConnected()) {
        try {
          const userCred = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
          const fbUser = userCred.user;

          const userData = {
            uid: fbUser.uid,
            email: email,
            nama: nama,
            role: 'partner',
            isJoint: true,
            groupId: 'group_default',
            memberId: 'bersama',
            createdAt: new Date().toISOString()
          };

          if (window.firebaseDb) {
            await window.firebaseDb.collection('users').doc(fbUser.uid).set(userData);
          }

          setCurrentUser(userData);
          showToast('Pendaftaran akun berhasil.', 'success');
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
          return;
        } catch (err) {
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
        showToast('Email ini sudah terdaftar. Silakan masuk.', 'error');
        return;
      }

      const newUser = {
        uid: 'user_' + Date.now(),
        email: email,
        nama: nama,
        passwordHash: btoa(password),
        role: 'partner',
        isJoint: true,
        groupId: 'group_default',
        memberId: 'bersama',
        createdAt: new Date().toISOString()
      };
      registeredUsers.push(newUser);
      localStorage.setItem('saldoku_registered_accounts', JSON.stringify(registeredUsers));

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

      // Verify with Firebase Auth Service if connected
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
            groupId: 'group_default',
            memberId: 'bersama'
          };

          // Fetch name from Firestore users collection
          if (window.firebaseDb) {
            try {
              const doc = await window.firebaseDb.collection('users').doc(fbUser.uid).get();
              if (doc.exists && doc.data().nama) {
                userObj.nama = doc.data().nama;
              }
            } catch (e) {}
          }

          setCurrentUser(userObj);
          showToast('Autentikasi berhasil. Membuka Akun Bersama.', 'success');
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
          return;
        } catch (err) {
          let errText = 'Email atau kata sandi tidak valid.';
          if (err.code === 'auth/user-not-found') errText = 'Akun tidak ditemukan. Silakan lakukan pendaftaran.';
          if (err.code === 'auth/wrong-password') errText = 'Kata sandi tidak sesuai.';
          if (err.code === 'auth/invalid-email') errText = 'Format email tidak valid.';
          showToast(errText, 'error');
          return;
        }
      }

      // Local Registry Strict Fallback (Rejects unregistered / random accounts)
      let registeredUsers = JSON.parse(localStorage.getItem('saldoku_registered_accounts') || '[]');
      
      // Default seed demo accounts for joint access
      if (registeredUsers.length === 0 || !registeredUsers.some(u => u.email === 'wadwan2219@gmail.com')) {
        registeredUsers = [
          { uid: 'wadwan', memberId: 'bersama', email: 'wadwan2219@gmail.com', passwordHash: btoa('wadwan123'), nama: 'WADWAN2219 (Akun Bersama)', role: 'partner', isJoint: true },
          { uid: 'bersama', memberId: 'bersama', email: 'bersama@gmail.com', passwordHash: btoa('123456'), nama: 'Iwan & Wadda (Akun Bersama)', role: 'partner', isJoint: true },
          { uid: 'iwan', memberId: 'iwan', email: 'iwan@gmail.com', passwordHash: btoa('123456'), nama: 'Iwan & Wadda (Akun Bersama)', role: 'partner', isJoint: true },
          { uid: 'wadda', memberId: 'wadda', email: 'wadda@gmail.com', passwordHash: btoa('123456'), nama: 'Iwan & Wadda (Akun Bersama)', role: 'partner', isJoint: true }
        ];
        localStorage.setItem('saldoku_registered_accounts', JSON.stringify(registeredUsers));
      }

      const foundUser = registeredUsers.find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === btoa(password)
      );

      if (!foundUser) {
        showToast('Kredensial tidak valid. Silakan periksa email dan kata sandi.', 'error');
        return;
      }

      // Login through form is strictly the JOINT ACCOUNT (Akun Bersama Iwan & Wadda with Debt Feature)
      const jointUser = {
        uid: foundUser.uid || 'bersama',
        email: foundUser.email,
        nama: foundUser.nama || 'Iwan & Wadda (Akun Bersama)',
        memberId: 'bersama',
        role: 'partner',
        isJoint: true,
        groupId: 'group_default'
      };

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
      setTimeout(() => {
        if (inputPinCode) inputPinCode.focus();
      }, 100);
    }
  }

  function closePinModal() {
    if (modalPinAuth) modalPinAuth.classList.add('hidden');
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
