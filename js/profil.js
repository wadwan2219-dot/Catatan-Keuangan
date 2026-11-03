/**
 * SaldoKu - Profil & Preferensi Controller (js/profil.js)
 * Manages User Profile, Accounting Cycle Schedules, and Manual/Auto Reset.
 * Conforms to UI/UX Pro Max (Zero AI Slop, clean typography, SVG only).
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();
  if (!user) return;

  const userId = user.memberId || user.uid || 'default';

  // 1. Setup Header & Navigation links based on role
  setupProfileNavigation(user);

  // 2. Initialize Cut-off Day Options (1 to 31)
  initCutoffSelectOptions();

  // 3. Populate Profile Information
  renderUserProfile(user);

  // 4. Load & Populate Cycle Preferences
  loadCyclePreferences(userId);

  // 5. Initialize Modals and Event Listeners
  initCycleEventListeners(userId);
});

/**
 * Configure navigation links back to user's native dashboard
 */
function setupProfileNavigation(user) {
  let dashboardHref = 'dashboard.html';
  if (user.memberId === 'iwan') {
    dashboardHref = 'dashboard-iwan.html';
  } else if (user.memberId === 'wadda') {
    dashboardHref = 'dashboard-wadda.html';
  }

  const brandLink = document.getElementById('brand-logo-link');
  const navDashboardLink = document.getElementById('nav-dashboard-link');
  const btnBack = document.getElementById('btn-back-to-dashboard');

  if (brandLink) brandLink.href = dashboardHref;
  if (navDashboardLink) navDashboardLink.href = dashboardHref;
  if (btnBack) btnBack.href = dashboardHref;
}

/**
 * Populate cut-off dropdown with days 1 to 31
 */
function initCutoffSelectOptions() {
  const select = document.getElementById('select-cutoff-day');
  if (!select) return;

  select.innerHTML = '';
  for (let i = 1; i <= 31; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Tanggal ${i}`;
    select.appendChild(opt);
  }
}

/**
 * Render user profile summary
 */
function renderUserProfile(user) {
  const displayName = user.nama || (user.memberId ? user.memberId.toUpperCase() : user.email.split('@')[0]);
  const displayEmail = user.email || 'user@saldoku.id';
  const initial = displayName.charAt(0).toUpperCase();

  const headerAvatar = document.getElementById('header-avatar');
  const headerName = document.getElementById('header-user-name');
  const headerRole = document.getElementById('header-user-role');

  if (headerAvatar) headerAvatar.textContent = initial;
  if (headerName) headerName.textContent = displayName;

  let roleLabel = 'Mode Personal';
  if (user.role === 'admin' || user.role === 'superadmin') {
    roleLabel = 'Super Administrator';
  } else if (user.role === 'partner' || user.isJoint) {
    roleLabel = 'Akun Bersama (Partner)';
  }

  if (headerRole) headerRole.textContent = roleLabel;

  const cardRoleBadge = document.getElementById('card-role-badge');
  if (cardRoleBadge) cardRoleBadge.textContent = roleLabel;

  const profileName = document.getElementById('profile-display-name');
  const profileEmail = document.getElementById('profile-display-email');
  const profileWorkspace = document.getElementById('profile-display-workspace');

  if (profileName) profileName.textContent = displayName;
  if (profileEmail) profileEmail.textContent = displayEmail;
  if (profileWorkspace) profileWorkspace.textContent = user.groupId || user.workspace_id || 'pribadi_' + (user.memberId || user.uid);
}

/**
 * Load and display cycle configuration and preview
 */
function loadCyclePreferences(userId) {
  const config = getUserCycleConfig(userId);

  const toggleAuto = document.getElementById('toggle-auto-reset');
  const badgeToggle = document.getElementById('badge-toggle-status');
  const selectCutoff = document.getElementById('select-cutoff-day');
  const previewNext = document.getElementById('preview-next-reset-date');
  const cycleStartText = document.getElementById('current-cycle-start-text');
  const lastResetText = document.getElementById('last-reset-date-text');

  if (toggleAuto) {
    toggleAuto.checked = config.auto_reset_enabled !== false;
    updateToggleBadge(toggleAuto.checked);
  }

  if (selectCutoff) {
    selectCutoff.value = config.cutoff_day || 1;
  }

  if (previewNext) {
    previewNext.textContent = formatNextResetDate(config.cutoff_day || 1);
  }

  if (cycleStartText) {
    cycleStartText.textContent = formatDateTimeIndo(config.current_cycle_start);
  }

  if (lastResetText) {
    lastResetText.textContent = formatDateTimeIndo(config.last_reset_at);
  }

  renderCycleHistoryTable(config.history_checkpoints || []);
}

function updateToggleBadge(isEnabled) {
  const badge = document.getElementById('badge-toggle-status');
  if (!badge) return;

  if (isEnabled) {
    badge.className = 'px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    badge.textContent = 'Aktif';
  } else {
    badge.className = 'px-2 py-0.5 rounded text-[9.5px] font-bold bg-slate-800 text-slate-400 border border-slate-700';
    badge.textContent = 'Nonaktif';
  }
}

/**
 * Calculates the next upcoming cut-off date
 */
function formatNextResetDate(cutoffDay) {
  const now = new Date();
  const day = Math.min(Math.max(1, Number(cutoffDay) || 1), 31);
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth();

  if (now.getDate() >= day) {
    // Falls into next month
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const actualDay = Math.min(day, daysInTargetMonth);
  const targetDate = new Date(targetYear, targetMonth, actualDay);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return `${actualDay} ${months[targetMonth]} ${targetYear}`;
}

function formatDateTimeIndo(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${mins}`;
  } catch (e) {
    return isoStr;
  }
}

/**
 * Render historical cycle checkpoints
 */
function renderCycleHistoryTable(checkpoints) {
  const tbody = document.getElementById('tbody-cycle-history');
  const countBadge = document.getElementById('count-archived-cycles');
  if (!tbody) return;

  if (countBadge) {
    countBadge.textContent = `${checkpoints.length} Arsip Siklus`;
  }

  if (!checkpoints || checkpoints.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-500 font-sans">
          Belum ada arsip siklus penutupan buku sebelumnya.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = checkpoints.map(cp => {
    const startStr = (cp.start_date || '').slice(0, 10);
    const endStr = (cp.end_date || '').slice(0, 10);
    const closedStr = formatDateTimeIndo(cp.closed_at);
    const isAuto = cp.note && cp.note.toLowerCase().includes('otomatis');

    const badgeType = isAuto
      ? '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/25">Otomatis</span>'
      : '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">Manual</span>';

    return `
      <tr class="hover:bg-slate-800/30 transition-colors">
        <td class="py-3 px-3 text-white font-semibold">
          ${startStr} <span class="text-slate-500 font-normal">s/d</span> ${endStr}
        </td>
        <td class="py-3 px-3 text-emerald-400 font-bold">
          + ${formatRupiah(cp.total_masuk || 0)}
        </td>
        <td class="py-3 px-3 text-rose-400 font-bold">
          - ${formatRupiah(cp.total_keluar || 0)}
        </td>
        <td class="py-3 px-3 text-cyan-300 font-bold">
          ${formatRupiah(cp.saldo_akhir_kas || 0)}
        </td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-1.5">
            ${badgeType}
            <span class="text-[10px] text-slate-400 font-sans">${closedStr}</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Event listeners and forms
 */
function initCycleEventListeners(userId) {
  const toggleAuto = document.getElementById('toggle-auto-reset');
  if (toggleAuto) {
    toggleAuto.addEventListener('change', (e) => {
      updateToggleBadge(e.target.checked);
    });
  }

  const selectCutoff = document.getElementById('select-cutoff-day');
  const previewNext = document.getElementById('preview-next-reset-date');

  if (selectCutoff) {
    selectCutoff.addEventListener('change', (e) => {
      if (previewNext) {
        previewNext.textContent = formatNextResetDate(e.target.value);
      }
    });
  }

  // Preset buttons
  document.querySelectorAll('.btn-preset-cutoff').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = btn.dataset.day;
      if (selectCutoff) {
        selectCutoff.value = day;
        if (previewNext) {
          previewNext.textContent = formatNextResetDate(day);
        }
      }
    });
  });

  // Save Settings Form
  const form = document.getElementById('form-cycle-settings');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const currentConfig = getUserCycleConfig(userId);
      const isAuto = toggleAuto ? toggleAuto.checked : true;
      const cutoffVal = selectCutoff ? Number(selectCutoff.value) : 1;

      const updated = {
        ...currentConfig,
        auto_reset_enabled: isAuto,
        cutoff_day: cutoffVal
      };

      saveUserCycleConfig(userId, updated);
      showToast('Preferensi jadwal siklus pembukuan berhasil disimpan!', 'success');
      loadCyclePreferences(userId);
    });
  }

  // Modal Tutup Buku Handlers
  initTutupBukuModal(userId);
}

function initTutupBukuModal(userId) {
  const modal = document.getElementById('modal-tutup-buku');
  const btnOpen = document.getElementById('btn-open-modal-tutup-buku');
  const btnClose = document.getElementById('btn-close-modal-tutup-buku');
  const btnCancel = document.getElementById('btn-cancel-tutup-buku');
  const btnConfirm = document.getElementById('btn-confirm-tutup-buku');

  const closeModal = () => {
    if (modal) modal.classList.add('hidden');
  };

  const openModal = () => {
    if (!modal) return;
    const config = getUserCycleConfig(userId);
    const allList = getAllTransactions(userId);
    const activeTransactions = filterTransactionsByCycle(allList, config, 'current');

    let totalMasuk = 0;
    let totalKeluar = 0;

    activeTransactions.forEach(t => {
      const amt = Number(t.amount || t.jumlah || 0);
      if (t.type === 'tabungan') {
        totalMasuk += amt;
      } else {
        totalKeluar += amt;
      }
    });

    const stats = calculateUserBalance(userId);

    const startText = (config.current_cycle_start || '').slice(0, 10);
    const todayText = getTodayString();

    const periodElem = document.getElementById('modal-summary-period');
    const incomeElem = document.getElementById('modal-summary-income');
    const expenseElem = document.getElementById('modal-summary-expense');
    const balanceElem = document.getElementById('modal-summary-balance');

    if (periodElem) periodElem.textContent = `${startText} s/d ${todayText}`;
    if (incomeElem) incomeElem.textContent = `+ ${formatRupiah(totalMasuk)}`;
    if (expenseElem) expenseElem.textContent = `- ${formatRupiah(totalKeluar)}`;
    if (balanceElem) balanceElem.textContent = formatRupiah(stats.saldoKas);

    // Dynamic balance action setup
    const sisaKas = stats.saldoKas;
    const rolloverAmounts = modal.querySelectorAll('.val-rollover-amount');
    const transferAmounts = modal.querySelectorAll('.val-transfer-amount');
    const zeroNotice = modal.querySelector('#box-balance-zero-notice');

    rolloverAmounts.forEach(el => el.textContent = formatRupiah(Math.max(0, sisaKas)));
    transferAmounts.forEach(el => el.textContent = formatRupiah(Math.max(0, sisaKas)));

    const radioRollover = modal.querySelector('input[value="rollover"]');
    const radioTransfer = modal.querySelector('input[value="transfer_to_savings"]');
    const radioResetZero = modal.querySelector('input[value="reset_kas_zero"]');

    if (sisaKas <= 0) {
      if (zeroNotice) zeroNotice.classList.remove('hidden');
      if (radioTransfer) radioTransfer.disabled = true;
      if (radioResetZero) radioResetZero.disabled = true;
      if (radioRollover) radioRollover.checked = true;
    } else {
      if (zeroNotice) zeroNotice.classList.add('hidden');
      if (radioTransfer) {
        radioTransfer.disabled = false;
        radioTransfer.checked = true;
      }
      if (radioResetZero) radioResetZero.disabled = false;
    }

    modal.classList.remove('hidden');
  };

  if (btnOpen) btnOpen.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (btnConfirm) {
    btnConfirm.addEventListener('click', async () => {
      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Memproses...';

      try {
        const selectedRadio = modal.querySelector('input[name="cycle_balance_action"]:checked');
        const balanceAction = selectedRadio ? selectedRadio.value : 'rollover';

        const stats = calculateUserBalance(userId);
        const sisaKas = stats.saldoKas;

        await closeCurrentCycle(userId, 'Tutup buku manual dari Profil', balanceAction);

        let successMsg = 'Buku periode berhasil ditutup! Siklus baru telah dimulai.';
        if (balanceAction === 'transfer_to_savings' && sisaKas > 0) {
          successMsg = `Buku ditutup! Sisa kas ${formatRupiah(sisaKas)} dialihkan ke Tabungan.`;
        } else if (balanceAction === 'reset_kas_zero' && sisaKas > 0) {
          successMsg = `Buku ditutup! Saldo kas berhasil di-reset ke Rp 0.`;
        }
        showToast(successMsg, 'success');

        closeModal();
        loadCyclePreferences(userId);
      } catch (err) {
        showToast('Gagal melakukan tutup buku: ' + (err.message || ''), 'error');
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = 'Konfirmasi & Tutup Buku';
      }
    });
  }
}

