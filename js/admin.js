/**
 * SaldoKu - Super Admin Controller (js/admin.js)
 * Command Center for User Management, Access Control, and Feature Toggles.
 */

let allUsers = [];
let activeStatusFilter = 'all';
let searchQuery = '';
let activeFeatureUser = null;
let activeDeleteUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Strict Security Route Guard: Super Admin Only
  const currentUser = getCurrentUser();
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
    showToast('Akses ditolak. Halaman khusus Super Administrator.', 'error');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 600);
    return;
  }

  // Populate Header Admin Identity
  const nameElem = document.getElementById('admin-user-name');
  const emailElem = document.getElementById('admin-user-email');
  if (nameElem) nameElem.textContent = currentUser.nama || 'Super Administrator';
  if (emailElem) emailElem.textContent = currentUser.email || 'admin@saldoku.id';

  // 2. Initialize Event Listeners
  initAdminFilters();
  initFeatureModal();
  initDeleteModal();

  const btnRefresh = document.getElementById('btn-refresh-users');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      btnRefresh.classList.add('animate-spin');
      loadAndRenderUsers().finally(() => {
        setTimeout(() => btnRefresh.classList.remove('animate-spin'), 600);
      });
    });
  }

  // 3. Load Initial Data
  await loadAndRenderUsers();
});

/**
 * Loads all users and renders the table and metrics
 */
async function loadAndRenderUsers() {
  const tbody = document.getElementById('tbody-users-list');
  if (!tbody) return;

  try {
    allUsers = await window.AdminService.getAllUsers();
    updateMetricCards(allUsers);
    renderUsersTable(allUsers);
  } catch (err) {
    console.error('[Admin] Error loading users:', err);
    showToast('Gagal memuat daftar pengguna.', 'error');
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-rose-400">
          Gagal memuat data pengguna. Silakan segarkan halaman.
        </td>
      </tr>
    `;
  }
}

/**
 * Updates top summary metric cards
 */
function updateMetricCards(users) {
  const metricTotal = document.getElementById('metric-total-users');
  const metricActive = document.getElementById('metric-active-users');
  const metricSuspended = document.getElementById('metric-suspended-users');
  const metricWorkspaces = document.getElementById('metric-workspaces');

  const total = users.length;
  const activeCount = users.filter(u => u.status !== 'suspended').length;
  const suspendedCount = users.filter(u => u.status === 'suspended').length;
  
  const uniqueWorkspaces = new Set(users.map(u => u.workspace_id || u.groupId).filter(Boolean)).size;

  if (metricTotal) metricTotal.textContent = total;
  if (metricActive) metricActive.textContent = activeCount;
  if (metricSuspended) metricSuspended.textContent = suspendedCount;
  if (metricWorkspaces) metricWorkspaces.textContent = uniqueWorkspaces;
}

/**
 * Filters and renders users into table rows
 */
function renderUsersTable(users) {
  const tbody = document.getElementById('tbody-users-list');
  if (!tbody) return;

  // Filter based on search query and status filter
  let filtered = [...users];

  if (activeStatusFilter === 'active') {
    filtered = filtered.filter(u => u.status !== 'suspended');
  } else if (activeStatusFilter === 'suspended') {
    filtered = filtered.filter(u => u.status === 'suspended');
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(u => 
      (u.nama && u.nama.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.uid && u.uid.toLowerCase().includes(q)) ||
      (u.workspace_id && u.workspace_id.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-10 text-center text-slate-500">
          Tidak ada akun yang sesuai dengan filter pencarian.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(user => {
    const isProtected = window.AdminService.isProtectedAccount(user.email) || window.AdminService.isProtectedAccount(user.uid);
    const isSuspended = user.status === 'suspended';
    const features = user.features || window.AdminService.DEFAULT_FEATURES;

    // Avatar color determination
    let avatarBg = 'from-blue-600 to-indigo-600';
    let roleBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">User</span>';
    
    if (user.role === 'admin' || user.role === 'superadmin') {
      avatarBg = 'from-amber-500 to-orange-600';
      roleBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">Admin</span>';
    } else if (user.role === 'partner' || user.uid === 'bersama' || user.uid === 'wadwan') {
      avatarBg = 'from-cyan-500 to-blue-600';
      roleBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Partner</span>';
    }

    const initial = (user.nama || user.email || 'U').charAt(0).toUpperCase();

    // Feature Badges Chips
    const badgeDebt = features.debt_ledger !== false
      ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Hutang ON</span>'
      : '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-slate-800 text-slate-500 border border-slate-700">Hutang OFF</span>';

    const badgePocket = features.dual_pocket !== false
      ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">Kantong ON</span>'
      : '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-slate-800 text-slate-500 border border-slate-700">Kantong OFF</span>';

    const badgeSplit = features.cash_bank_split !== false
      ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">Rekening/Cash ON</span>'
      : '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-slate-800 text-slate-500 border border-slate-700">Rekening/Cash OFF</span>';

    return `
      <tr class="hover:bg-slate-800/20 transition-colors">
        <!-- User Identity -->
        <td class="py-3 px-3">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr ${avatarBg} text-white font-black flex items-center justify-center flex-shrink-0 text-xs shadow-sm">
              ${initial}
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-white text-xs">${user.nama || 'Pengguna'}</span>
                ${roleBadge}
              </div>
              <span class="text-[11px] text-slate-400 block">${user.email}</span>
            </div>
          </div>
        </td>

        <!-- Workspace ID -->
        <td class="py-3 px-3">
          <div class="font-mono text-[11px] text-slate-300">
            <span class="px-2 py-1 rounded-md bg-[#080d1a] border border-slate-800 text-slate-300">
              ${user.workspace_id || 'fam_default'}
            </span>
          </div>
          <span class="text-[10px] text-slate-500 mt-1 block">
            Daftar: ${user.created_at ? user.created_at.slice(0, 10) : '-'}
          </span>
        </td>

        <!-- Status Akun -->
        <td class="py-3 px-3">
          ${isSuspended ? `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              Dinonaktifkan
            </span>
          ` : `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Aktif Normal
            </span>
          `}
        </td>

        <!-- Feature Chips -->
        <td class="py-3 px-3">
          <div class="flex flex-wrap gap-1 max-w-xs">
            ${badgeDebt}
            ${badgePocket}
            ${badgeSplit}
          </div>
        </td>

        <!-- Actions -->
        <td class="py-3 px-3 text-right">
          <div class="inline-flex items-center gap-1.5">
            
            <!-- Button Atur Fitur -->
            <button type="button" class="btn-open-features px-2.5 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                    data-email="${user.email}" data-uid="${user.uid}">
              Atur Fitur
            </button>

            <!-- Button Suspend / Aktifkan -->
            ${!isProtected ? `
              <button type="button" class="btn-toggle-status px-2.5 py-1.5 rounded-lg ${isSuspended ? 'bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400' : 'bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/30 text-amber-400'} hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                      data-email="${user.email}" data-uid="${user.uid}" data-status="${isSuspended ? 'active' : 'suspended'}">
                ${isSuspended ? 'Aktifkan' : 'Bekukan'}
              </button>
            ` : ''}

            <!-- Button Hapus Akun -->
            ${!isProtected ? `
              <button type="button" class="btn-open-delete p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 text-[11px] font-bold transition-all cursor-pointer"
                      title="Hapus Akun Permanen" data-email="${user.email}" data-uid="${user.uid}" data-workspace="${user.workspace_id || ''}">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ` : `
              <span class="text-[10px] text-slate-500 font-mono italic px-2">Protected</span>
            `}

          </div>
        </td>
      </tr>
    `;
  }).join('');

  attachRowButtonEvents();
}

/**
 * Attaches click handlers to dynamically rendered row buttons
 */
function attachRowButtonEvents() {
  // Feature Modal trigger
  document.querySelectorAll('.btn-open-features').forEach(btn => {
    btn.addEventListener('click', () => {
      const email = btn.dataset.email;
      const user = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user) openFeatureModal(user);
    });
  });

  // Toggle Suspend / Active trigger
  document.querySelectorAll('.btn-toggle-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      const newStatus = btn.dataset.status;
      try {
        btn.disabled = true;
        await window.AdminService.updateUserStatus(email, newStatus);
        showToast(`Akun ${email} berhasil di-${newStatus === 'active' ? 'aktifkan kembali' : 'nonaktifkan'}.`, 'success');
        await loadAndRenderUsers();
      } catch (err) {
        showToast(err.message || 'Gagal mengubah status akun.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Delete Modal trigger
  document.querySelectorAll('.btn-open-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const email = btn.dataset.email;
      const workspace = btn.dataset.workspace;
      const user = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user) openDeleteModal(user, workspace);
    });
  });
}

/**
 * Filter & Search initialization
 */
function initAdminFilters() {
  const inputSearch = document.getElementById('input-search-user');
  if (inputSearch) {
    inputSearch.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderUsersTable(allUsers);
    });
  }

  const filterBtns = document.querySelectorAll('.btn-filter-status');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.className = 'btn-filter-status px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white transition-all cursor-pointer';
      });
      btn.className = 'btn-filter-status px-3 py-1.5 rounded-lg font-bold bg-blue-600 text-white transition-all cursor-pointer';
      activeStatusFilter = btn.dataset.filter;
      renderUsersTable(allUsers);
    });
  });
}

/**
 * Feature Modal Logic
 */
function initFeatureModal() {
  const modal = document.getElementById('modal-feature-settings');
  const btnClose = document.getElementById('btn-close-modal-features');
  const btnCancel = document.getElementById('btn-cancel-modal-features');
  const form = document.getElementById('form-feature-settings');

  const closeModal = () => {
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    activeFeatureUser = null;
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeFeatureUser) return;

      const debtChecked = document.getElementById('toggle-debt-ledger').checked;
      const pocketChecked = document.getElementById('toggle-dual-pocket').checked;
      const cashBankChecked = document.getElementById('toggle-cash-bank').checked;
      const exportChecked = document.getElementById('toggle-export-reports').checked;

      const updatedFeatures = {
        debt_ledger: debtChecked,
        dual_pocket: pocketChecked,
        cash_bank_split: cashBankChecked,
        export_reports: exportChecked
      };

      try {
        await window.AdminService.updateUserFeatures(activeFeatureUser.email, updatedFeatures);
        showToast(`Fitur akun ${activeFeatureUser.email} berhasil diperbarui.`, 'success');
        closeModal();
        await loadAndRenderUsers();
      } catch (err) {
        showToast('Gagal menyimpan pengaturan fitur.', 'error');
      }
    });
  }
}

function openFeatureModal(user) {
  activeFeatureUser = user;
  const modal = document.getElementById('modal-feature-settings');
  const emailElem = document.getElementById('target-feature-user-email');
  if (emailElem) emailElem.textContent = `${user.nama || 'Pengguna'} (${user.email})`;

  const features = user.features || window.AdminService.DEFAULT_FEATURES;

  const toggleDebt = document.getElementById('toggle-debt-ledger');
  const togglePocket = document.getElementById('toggle-dual-pocket');
  const toggleCashBank = document.getElementById('toggle-cash-bank');
  const toggleExport = document.getElementById('toggle-export-reports');

  if (toggleDebt) toggleDebt.checked = features.debt_ledger !== false;
  if (togglePocket) togglePocket.checked = features.dual_pocket !== false;
  if (toggleCashBank) toggleCashBank.checked = features.cash_bank_split !== false;
  if (toggleExport) toggleExport.checked = features.export_reports !== false;

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

/**
 * Delete Confirmation Modal Logic
 */
function initDeleteModal() {
  const modal = document.getElementById('modal-confirm-delete');
  const btnCancel = document.getElementById('btn-cancel-delete');
  const btnExecute = document.getElementById('btn-execute-delete');

  const closeModal = () => {
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    activeDeleteUser = null;
  };

  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (btnExecute) {
    btnExecute.addEventListener('click', async () => {
      if (!activeDeleteUser) return;
      try {
        btnExecute.disabled = true;
        btnExecute.textContent = 'Menghapus...';
        await window.AdminService.deleteUser(activeDeleteUser.email, activeDeleteUser.workspace_id);
        showToast(`Akun ${activeDeleteUser.email} dan datanya berhasil dihapus permanen.`, 'success');
        closeModal();
        await loadAndRenderUsers();
      } catch (err) {
        showToast(err.message || 'Gagal menghapus akun.', 'error');
      } finally {
        btnExecute.disabled = false;
        btnExecute.textContent = 'Hapus Akun';
      }
    });
  }
}

function openDeleteModal(user, workspaceId) {
  activeDeleteUser = { ...user, workspace_id: workspaceId || user.workspace_id };
  const modal = document.getElementById('modal-confirm-delete');
  const emailElem = document.getElementById('target-delete-user-email');
  if (emailElem) emailElem.textContent = user.email;

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}
