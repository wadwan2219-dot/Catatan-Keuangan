/**
 * SaldoKu - Controller Halaman Hutang (js/hutang.js)
 * Manages net debt UI, reactive simulation, live table filtering, and accessible reversal modal.
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();

  // Guard: Fitur Hutang hanya untuk Akun Bersama (Login Email)
  if (!isJointAccount()) {
    showToast('Fitur Hutang Bersih hanya tersedia untuk Akun Bersama (Iwan & Wadda). Mengalihkan...', 'warning');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1000);
    return;
  }

  // 1. Populate User Header
  const userNameElem = document.getElementById('user-display-name');
  const userEmailElem = document.getElementById('user-display-email');
  const userAvatarElem = document.getElementById('user-avatar-initial');
  const logoutBtn = document.getElementById('btn-logout');

  if (userNameElem) userNameElem.textContent = user.nama || 'Pengguna';
  if (userEmailElem) userEmailElem.textContent = user.email || '';
  if (userAvatarElem) userAvatarElem.textContent = (user.nama || 'U').charAt(0).toUpperCase();

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  }

  // 2. DOM Elements
  const formDebt = document.getElementById('form-debt');
  const inputAmount = document.getElementById('input-debt-amount');
  const inputDate = document.getElementById('input-debt-date');
  const inputNote = document.getElementById('input-debt-note');
  const btnSubmit = document.getElementById('btn-submit-debt');
  const btnSubmitText = document.getElementById('btn-submit-text');

  const textPosition = document.getElementById('text-debt-position');
  const badgeStatus = document.getElementById('badge-debt-status');
  const textSimulation = document.getElementById('text-preview-simulation');

  const filterKindSelect = document.getElementById('filter-debt-kind');
  const searchInput = document.getElementById('search-debt-keyword');
  const tableBody = document.getElementById('table-debt-body');
  const emptyState = document.getElementById('debt-empty-state');

  const modalReversal = document.getElementById('modal-reversal');
  const modalTargetSummary = document.getElementById('modal-target-summary');
  const inputReversalReason = document.getElementById('input-reversal-reason');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const btnConfirmReversal = document.getElementById('btn-confirm-reversal');

  const labelParty = document.getElementById('label-debtor-party');
  const sublabelIwan = document.getElementById('sublabel-iwan');
  const sublabelWadda = document.getElementById('sublabel-wadda');

  let allEntries = [];
  let entryToReverse = null;

  // Set default date to today
  if (inputDate && !inputDate.value) {
    inputDate.value = getTodayString();
  }

  // Auto-select party based on current logged in user if applicable
  const partyRadios = document.querySelectorAll('input[name="debtor-party"]');
  if (user.memberId === 'wadda' && partyRadios.length >= 2) {
    partyRadios[1].checked = true;
  }

  // 3. UI State Helpers
  function getSelectedKind() {
    const checked = document.querySelector('input[name="debt-kind"]:checked');
    return checked ? checked.value : 'debt';
  }

  function getSelectedParty() {
    const checked = document.querySelector('input[name="debtor-party"]:checked');
    return checked ? checked.value : 'iwan';
  }

  function updateFormKindLabels() {
    const kind = getSelectedKind();
    if (kind === 'payment') {
      if (labelParty) labelParty.textContent = 'Siapa yang Membayar?';
      if (sublabelIwan) sublabelIwan.textContent = 'membayar kepada Wadda';
      if (sublabelWadda) sublabelWadda.textContent = 'membayar kepada Iwan';
      if (btnSubmitText) btnSubmitText.textContent = 'Simpan Pembayaran Hutang';
    } else {
      if (labelParty) labelParty.textContent = 'Siapa yang Berhutang?';
      if (sublabelIwan) sublabelIwan.textContent = 'berhutang ke Wadda';
      if (sublabelWadda) sublabelWadda.textContent = 'berhutang ke Iwan';
      if (btnSubmitText) btnSubmitText.textContent = 'Simpan Entri Hutang';
    }
    updateSimulationPreview();
  }

  // 4. Live Simulation Calculation
  function updateSimulationPreview() {
    if (!textSimulation) return;

    const rawAmount = parseRupiah(inputAmount ? inputAmount.value : 0);
    if (!rawAmount || rawAmount <= 0) {
      textSimulation.textContent = 'Masukkan nominal untuk melihat simulasi posisi akhir.';
      return;
    }

    const kind = getSelectedKind();
    const fromMemberId = getSelectedParty();
    const toMemberId = window.DebtEngine.getCounterparty(fromMemberId);

    const hypotheticalEntry = {
      kind,
      fromMemberId,
      toMemberId,
      amount: rawAmount
    };

    const simulatedEntries = [...allEntries, hypotheticalEntry];
    const simulatedNet = window.DebtEngine.calculateNet(simulatedEntries);
    const desc = window.DebtEngine.describePosition(simulatedNet);

    const currentNet = window.DebtEngine.calculateNet(allEntries);
    let noteFlip = '';
    if (kind === 'payment' && ((currentNet > 0 && simulatedNet < 0) || (currentNet < 0 && simulatedNet > 0))) {
      noteFlip = ' (Perhatian: Pembayaran ini melebihi saldo hutang berjalan dan membalik posisi kewajiban)';
    }

    textSimulation.innerHTML = `Posisi baru akan menjadi: <strong class="text-white">${desc.text}</strong>${noteFlip}`;
  }

  // 5. Update Position Hero Header
  function updatePositionDisplay() {
    const netDebt = window.DebtEngine.calculateNet(allEntries);
    const desc = window.DebtEngine.describePosition(netDebt);

    if (textPosition) {
      textPosition.textContent = desc.text;
      if (desc.status === 'debt_a') {
        textPosition.className = 'text-xl sm:text-2xl font-extrabold text-rose-400 tracking-tight';
      } else if (desc.status === 'debt_b') {
        textPosition.className = 'text-xl sm:text-2xl font-extrabold text-amber-400 tracking-tight';
      } else {
        textPosition.className = 'text-xl sm:text-2xl font-extrabold text-emerald-400 tracking-tight';
      }
    }

    if (badgeStatus) {
      badgeStatus.className = `px-2.5 py-0.5 text-xs font-bold rounded-full border ${desc.badgeClass}`;
      badgeStatus.textContent = desc.shortText;
    }
  }

  // 6. Render Ledger Table
  function renderLedgerTable() {
    if (!tableBody) return;

    const filterKind = filterKindSelect ? filterKindSelect.value : 'all';
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = allEntries.filter(entry => {
      if (filterKind !== 'all' && entry.kind !== filterKind) {
        return false;
      }
      if (keyword) {
        const noteMatch = (entry.note || '').toLowerCase().includes(keyword);
        const fromMatch = (entry.fromMemberId || '').toLowerCase().includes(keyword);
        const toMatch = (entry.toMemberId || '').toLowerCase().includes(keyword);
        const creatorMatch = (entry.createdByName || '').toLowerCase().includes(keyword);
        if (!noteMatch && !fromMatch && !toMatch && !creatorMatch) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let rowsHtml = '';
    filtered.forEach(entry => {
      const isReversed = window.DebtService.isEntryReversed(entry.id, allEntries);
      const isReversalDoc = entry.kind === 'reversal';

      let kindBadge = '';
      let partyLabel = '';
      let amountDisplay = '';

      if (entry.kind === 'debt') {
        kindBadge = '<span class="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[11px] font-semibold">Hutang</span>';
        const fromName = window.DebtEngine.getMemberName(entry.fromMemberId);
        const toName = window.DebtEngine.getMemberName(entry.toMemberId);
        partyLabel = `<span class="text-slate-200 font-semibold">${fromName}</span> <span class="text-slate-500">ke</span> <span class="text-slate-200">${toName}</span>`;
        amountDisplay = `<span class="${isReversed ? 'line-through text-slate-500' : 'text-rose-400 font-bold'}">${formatRupiah(entry.amount)}</span>`;
      } else if (entry.kind === 'payment') {
        kindBadge = '<span class="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">Pembayaran</span>';
        const fromName = window.DebtEngine.getMemberName(entry.fromMemberId);
        const toName = window.DebtEngine.getMemberName(entry.toMemberId);
        partyLabel = `<span class="text-slate-200 font-semibold">${fromName}</span> <span class="text-slate-500">ke</span> <span class="text-slate-200">${toName}</span>`;
        amountDisplay = `<span class="${isReversed ? 'line-through text-slate-500' : 'text-emerald-400 font-bold'}">${formatRupiah(entry.amount)}</span>`;
      } else if (entry.kind === 'reversal') {
        kindBadge = '<span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-semibold">Pembatalan</span>';
        partyLabel = '<span class="text-slate-400 italic">Reversal Sistem</span>';
        amountDisplay = `<span class="text-slate-400">${formatRupiah(entry.amount)}</span>`;
      }

      // Reversal status flag
      let statusTag = '';
      if (isReversed) {
        statusTag = '<span class="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">Dibatalkan</span>';
      }

      // Action button
      let actionBtn = '<span class="text-slate-600 text-xs">-</span>';
      if (!isReversed && !isReversalDoc) {
        actionBtn = `
          <button type="button" data-id="${entry.id}" class="btn-open-reverse px-2.5 py-1 text-[11px] font-medium text-rose-400 hover:text-white hover:bg-rose-600/30 rounded-lg border border-rose-500/30 transition-all">
            Batalkan
          </button>
        `;
      }

      rowsHtml += `
        <tr class="hover:bg-slate-800/40 transition-colors">
          <td class="py-3 px-3 text-slate-400 font-mono whitespace-nowrap">${formatDate(entry.occurredAt)}</td>
          <td class="py-3 px-3 whitespace-nowrap">${kindBadge} ${statusTag}</td>
          <td class="py-3 px-3 whitespace-nowrap">${partyLabel}</td>
          <td class="py-3 px-3 whitespace-nowrap">${amountDisplay}</td>
          <td class="py-3 px-3 text-slate-300 max-w-[200px] truncate" title="${entry.note || '-'}">${entry.note || '-'}</td>
          <td class="py-3 px-3 text-right whitespace-nowrap">${actionBtn}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = rowsHtml;

    // Attach listeners for reversal modal trigger
    document.querySelectorAll('.btn-open-reverse').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const target = allEntries.find(e => e.id === id);
        if (target) {
          openReversalModal(target);
        }
      });
    });
  }

  // 7. Modal Reversal Logic
  function openReversalModal(entry) {
    entryToReverse = entry;
    if (!modalReversal || !modalTargetSummary) return;

    const fromName = window.DebtEngine.getMemberName(entry.fromMemberId);
    const toName = window.DebtEngine.getMemberName(entry.toMemberId);
    const kindLabel = entry.kind === 'debt' ? 'Hutang' : 'Pembayaran';

    modalTargetSummary.innerHTML = `
      <div><strong>Jenis:</strong> ${kindLabel}</div>
      <div><strong>Pihak:</strong> ${fromName} kepada ${toName}</div>
      <div><strong>Nominal:</strong> ${formatRupiah(entry.amount)}</div>
      <div><strong>Tanggal:</strong> ${formatDate(entry.occurredAt)}</div>
      <div><strong>Catatan:</strong> ${entry.note || '-'}</div>
    `;

    if (inputReversalReason) inputReversalReason.value = '';
    modalReversal.classList.remove('hidden');
    if (inputReversalReason) inputReversalReason.focus();
  }

  function closeReversalModal() {
    entryToReverse = null;
    if (modalReversal) modalReversal.classList.add('hidden');
  }

  if (btnCancelModal) {
    btnCancelModal.addEventListener('click', closeReversalModal);
  }

  // Close modal on click outside backdrop
  if (modalReversal) {
    modalReversal.addEventListener('click', (e) => {
      if (e.target === modalReversal) closeReversalModal();
    });
  }

  // Keyboard accessibility: ESC closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalReversal && !modalReversal.classList.contains('hidden')) {
      closeReversalModal();
    }
  });

  if (btnConfirmReversal) {
    btnConfirmReversal.addEventListener('click', async () => {
      if (!entryToReverse) return;

      btnConfirmReversal.disabled = true;
      btnConfirmReversal.textContent = 'Membatalkan...';

      try {
        const reason = inputReversalReason ? inputReversalReason.value.trim() : '';
        await window.DebtService.reverseEntry(entryToReverse, reason);
        showToast('Entri berhasil dibatalkan (reversal tercatat).', 'info');
        closeReversalModal();
      } catch (err) {
        showToast(err.message || 'Gagal membatalkan entri.', 'error');
      } finally {
        btnConfirmReversal.disabled = false;
        btnConfirmReversal.textContent = 'Ya, Batalkan Entri Ini';
      }
    });
  }

  // 8. Event Listeners for Form Controls
  document.querySelectorAll('input[name="debt-kind"]').forEach(radio => {
    radio.addEventListener('change', updateFormKindLabels);
  });

  document.querySelectorAll('input[name="debtor-party"]').forEach(radio => {
    radio.addEventListener('change', updateSimulationPreview);
  });

  if (inputAmount) {
    inputAmount.addEventListener('input', (e) => {
      const numeric = parseRupiah(e.target.value);
      if (numeric === 0) {
        e.target.value = '';
      } else {
        e.target.value = new Intl.NumberFormat('id-ID').format(numeric);
      }
      updateSimulationPreview();
    });
  }

  // Preset quick buttons
  document.querySelectorAll('.preset-debt').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = Number(btn.getAttribute('data-amount')) || 0;
      if (inputAmount) {
        inputAmount.value = new Intl.NumberFormat('id-ID').format(amount);
        updateSimulationPreview();
      }
    });
  });

  if (filterKindSelect) filterKindSelect.addEventListener('change', renderLedgerTable);
  if (searchInput) searchInput.addEventListener('input', renderLedgerTable);

  // 9. Form Submit Handler
  if (formDebt) {
    formDebt.addEventListener('submit', async (e) => {
      e.preventDefault();

      const kind = getSelectedKind();
      const fromMemberId = getSelectedParty();
      const toMemberId = window.DebtEngine.getCounterparty(fromMemberId);
      const amount = parseRupiah(inputAmount ? inputAmount.value : 0);
      const occurredAt = inputDate ? (inputDate.value || getTodayString()) : getTodayString();
      const note = inputNote ? inputNote.value.trim() : '';

      if (!amount || amount <= 0) {
        showToast('Nominal transaksi tidak valid.', 'error');
        return;
      }

      // Check for excessive payment alert
      if (kind === 'payment') {
        const currentNet = window.DebtEngine.calculateNet(allEntries);
        const fromA = fromMemberId === window.DebtEngine.MEMBER_IWAN;
        const currentOwed = fromA ? Math.max(0, currentNet) : Math.max(0, -currentNet);
        if (amount > currentOwed && currentOwed > 0) {
          const confirmOverpay = confirm(
            `Nominal pembayaran (${formatRupiah(amount)}) melampaui sisa kewajiban (${formatRupiah(currentOwed)}).\n\nPosisi hutang akan berbalik pihak. Lanjutkan transaksi?`
          );
          if (!confirmOverpay) return;
        }
      }

      // Lock UI
      if (btnSubmit) btnSubmit.disabled = true;
      if (btnSubmitText) btnSubmitText.textContent = 'Menyimpan...';

      try {
        if (kind === 'debt') {
          await window.DebtService.createDebt({ fromMemberId, toMemberId, amount, note, occurredAt });
          showToast(`Entri hutang sebesar ${formatRupiah(amount)} berhasil disimpan.`, 'success');
        } else {
          await window.DebtService.createPayment({ fromMemberId, toMemberId, amount, note, occurredAt });
          showToast(`Entri pembayaran sebesar ${formatRupiah(amount)} berhasil disimpan.`, 'success');
        }

        // Reset form inputs (preserve date)
        if (inputAmount) inputAmount.value = '';
        if (inputNote) inputNote.value = '';
        updateSimulationPreview();
      } catch (err) {
        showToast(err.message || 'Gagal menyimpan transaksi hutang.', 'error');
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        updateFormKindLabels();
      }
    });
  }

  // 10. Subscribe to Realtime Data
  updateFormKindLabels();
  window.DebtService.subscribeEntries((entries) => {
    allEntries = entries;
    updatePositionDisplay();
    renderLedgerTable();
    updateSimulationPreview();
  });
});
