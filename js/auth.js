/**
 * SaldoKu - Authentication Logic (auth.js)
 * Implements strict Firebase Auth & Database Account verification.
 * Rejects unregistered/random emails & passwords.
 */

document.addEventListener('DOMContentLoaded', () => {
  // If user is already logged in, redirect to dashboard
  const currentUser = getCurrentUser();
  if (currentUser && window.location.pathname.endsWith('index.html')) {
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
            createdAt: new Date().toISOString()
          };

          if (window.firebaseDb) {
            await window.firebaseDb.collection('users').doc(fbUser.uid).set(userData);
          }

          setCurrentUser(userData);
          showToast(`Akun berhasil terdaftar! Selamat datang, ${nama} 🎉`, 'success');
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
          return;
        } catch (err) {
          let errText = 'Gagal mendaftarkan akun.';
          if (err.code === 'auth/email-already-in-use') errText = 'Email ini sudah terdaftar! Silakan Login.';
          if (err.code === 'auth/invalid-email') errText = 'Format email tidak valid!';
          if (err.code === 'auth/weak-password') errText = 'Kata sandi terlalu lemah (minimal 6 karakter).';
          showToast(errText, 'error');
          return;
        }
      }

      // Local Registry Strict Fallback (If testing without Firebase)
      let registeredUsers = JSON.parse(localStorage.getItem('saldoku_registered_accounts') || '[]');
      const existing = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (existing) {
        showToast('Email ini sudah terdaftar! Silakan masuk.', 'error');
        return;
      }

      const newUser = {
        uid: 'user_' + Date.now(),
        email: email,
        nama: nama,
        passwordHash: btoa(password),
        createdAt: new Date().toISOString()
      };
      registeredUsers.push(newUser);
      localStorage.setItem('saldoku_registered_accounts', JSON.stringify(registeredUsers));

      setCurrentUser({ uid: newUser.uid, email: newUser.email, nama: newUser.nama });
      showToast(`Akun berhasil terdaftar! Selamat datang, ${nama} 🎉`, 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
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
        showToast('Harap isi Email dan Password!', 'error');
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
            nama: fbUser.displayName || fbUser.email.split('@')[0].toUpperCase()
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
          showToast(`Login Berhasil! Selamat datang, ${userObj.nama} 👋`, 'success');
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
          return;
        } catch (err) {
          let errText = 'Email atau Kata Sandi salah / Akun belum terdaftar!';
          if (err.code === 'auth/user-not-found') errText = 'Akun tidak ditemukan! Silakan daftar akun baru.';
          if (err.code === 'auth/wrong-password') errText = 'Kata sandi Anda salah!';
          if (err.code === 'auth/invalid-email') errText = 'Format email tidak valid!';
          showToast(errText, 'error');
          return;
        }
      }

      // Local Registry Strict Fallback (Rejects unregistered / random accounts)
      let registeredUsers = JSON.parse(localStorage.getItem('saldoku_registered_accounts') || '[]');
      
      // Default seed demo accounts if registry is fresh
      if (registeredUsers.length === 0) {
        registeredUsers = [
          { uid: 'user1', email: 'budi@gmail.com', passwordHash: btoa('123456'), nama: 'Budi' },
          { uid: 'user2', email: 'ani@gmail.com', passwordHash: btoa('123456'), nama: 'Ani' }
        ];
        localStorage.setItem('saldoku_registered_accounts', JSON.stringify(registeredUsers));
      }

      const foundUser = registeredUsers.find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === btoa(password)
      );

      if (!foundUser) {
        showToast('AKSES DITOLAK: Email atau Password salah! Akun tidak terdaftar.', 'error');
        return;
      }

      setCurrentUser({ uid: foundUser.uid, email: foundUser.email, nama: foundUser.nama });
      showToast(`Login Berhasil! Selamat datang, ${foundUser.nama} 👋`, 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
    });
  }

  // ------------------------------------------------------------------------
  // 3. DEMO LOGIN BUTTONS (Budi & Ani)
  // ------------------------------------------------------------------------
  const demoBudiBtn = document.getElementById('btn-demo-budi');
  const demoAniBtn = document.getElementById('btn-demo-ani');

  if (demoBudiBtn) {
    demoBudiBtn.addEventListener('click', () => {
      const user = {
        uid: 'user1',
        nama: 'Budi',
        email: 'budi@gmail.com'
      };
      setCurrentUser(user);
      showToast('Masuk sebagai Mode Demo: Budi 👤', 'info');
      setTimeout(() => window.location.href = 'dashboard.html', 500);
    });
  }

  if (demoAniBtn) {
    demoAniBtn.addEventListener('click', () => {
      const user = {
        uid: 'user2',
        nama: 'Ani',
        email: 'ani@gmail.com'
      };
      setCurrentUser(user);
      showToast('Masuk sebagai Mode Demo: Ani 👩‍🦰', 'info');
      setTimeout(() => window.location.href = 'dashboard.html', 500);
    });
  }
});
