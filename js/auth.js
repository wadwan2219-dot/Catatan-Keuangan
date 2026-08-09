/**
 * SaldoKu - Authentication Logic (auth.js)
 * Handles Login, Registration, Demo Login, and Tab Switching.
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

  // Handle Login Form Submission
  if (formLogin) {
    formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        showToast('Harap isi Email dan Password!', 'error');
        return;
      }

      // Simple Auth Validation / Local Persistence
      const user = {
        uid: 'user_' + btoa(email).substring(0, 10),
        email: email,
        nama: email.split('@')[0].toUpperCase(),
        loginAt: new Date().toISOString()
      };

      setCurrentUser(user);
      showToast(`Selamat datang kembali, ${user.nama}! 👋`, 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    });
  }

  // Handle Register Form Submission
  if (formRegister) {
    formRegister.addEventListener('submit', (e) => {
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

      const user = {
        uid: 'user_' + Date.now(),
        email: email,
        nama: nama,
        createdAt: new Date().toISOString()
      };

      setCurrentUser(user);
      showToast(`Akun berhasil dibuat! Selamat datang, ${nama} 🎉`, 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    });
  }

  // Demo Login Buttons
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
      showToast('Masuk sebagai Mode Demo: Ani 👤', 'info');
      setTimeout(() => window.location.href = 'dashboard.html', 500);
    });
  }
});
