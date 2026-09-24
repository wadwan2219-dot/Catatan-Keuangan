/**
 * SaldoKu - Debt Engine (js/debt-engine.js)
 * Pure Mathematical & Logic Engine for Net Debt Calculations.
 * Strictly decoupled from DOM and Firebase.
 */

(function (window) {
  'use strict';

  const MEMBER_IWAN = 'iwan';
  const MEMBER_WADDA = 'wadda';

  const MEMBERS = [
    { id: MEMBER_IWAN, name: 'Iwan' },
    { id: MEMBER_WADDA, name: 'Wadda' }
  ];

  /**
   * Returns counterparty member ID (the other person in a 2-person group).
   */
  function getCounterparty(memberId) {
    if (memberId === MEMBER_IWAN) return MEMBER_WADDA;
    if (memberId === MEMBER_WADDA) return MEMBER_IWAN;
    return null;
  }

  /**
   * Returns member display name.
   */
  function getMemberName(memberId) {
    const member = MEMBERS.find(m => m.id === memberId);
    return member ? member.name : (memberId || 'Pengguna');
  }

  /**
   * Validates a debt entry payload before persisting.
   * Returns { valid: boolean, error?: string }
   */
  function validateEntry(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Data entri tidak valid.' };
    }

    const { kind, fromMemberId, toMemberId, amount } = payload;

    if (!['debt', 'payment', 'reversal'].includes(kind)) {
      return { valid: false, error: 'Jenis entri tidak dikenali (harus debt, payment, atau reversal).' };
    }

    // Amount validation: strictly positive integer
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      return { valid: false, error: 'Nominal harus berupa angka bulat positif lebih dari 0.' };
    }

    if (numericAmount > 1000000000) {
      return { valid: false, error: 'Nominal melebihi batas wajar (maksimum Rp1.000.000.000).' };
    }

    if (kind === 'reversal') {
      if (!payload.reversesEntryId) {
        return { valid: false, error: 'Reversal membutuhkan ID entri yang dibatalkan.' };
      }
      if (typeof payload.originalDelta !== 'number' || isNaN(payload.originalDelta)) {
        return { valid: false, error: 'Reversal membutuhkan nilai originalDelta yang valid.' };
      }
      return { valid: true };
    }

    if (!fromMemberId || !toMemberId) {
      return { valid: false, error: 'Pihak pengirim dan penerima harus ditentukan.' };
    }

    if (fromMemberId === toMemberId) {
      return { valid: false, error: 'Pihak berhutang dan pihak pemberi tidak boleh sama.' };
    }

    const validMemberIds = [MEMBER_IWAN, MEMBER_WADDA];
    if (!validMemberIds.includes(fromMemberId) || !validMemberIds.includes(toMemberId)) {
      return { valid: false, error: 'Pihak harus terdaftar (Iwan atau Wadda).' };
    }

    if (payload.note && typeof payload.note === 'string' && payload.note.length > 120) {
      return { valid: false, error: 'Catatan tidak boleh melebihi 120 karakter.' };
    }

    return { valid: true };
  }

  /**
   * Converts an entry into a signed net delta relative to memberA (Iwan).
   *
   * Convention relative to memberA (Iwan):
   * Positive (+) delta means Iwan owes Wadda (net debt increases).
   * Negative (-) delta means Wadda owes Iwan (or Iwan paid back).
   *
   * Rules:
   * 1. kind === 'debt':
   *    from Iwan -> Wadda: +amount
   *    from Wadda -> Iwan: -amount
   * 2. kind === 'payment':
   *    from Iwan -> Wadda: -amount (Iwan reduced debt)
   *    from Wadda -> Iwan: +amount (Wadda reduced debt)
   * 3. kind === 'reversal':
   *    cancels originalDelta: -originalDelta
   */
  function toSignedDelta(entry, memberAId = MEMBER_IWAN) {
    if (!entry) return 0;

    const kind = entry.kind;
    const amount = Number(entry.amount) || 0;

    if (kind === 'reversal') {
      return -(Number(entry.originalDelta) || 0);
    }

    const fromA = entry.fromMemberId === memberAId;

    if (kind === 'debt') {
      return fromA ? +amount : -amount;
    }

    if (kind === 'payment') {
      return fromA ? -amount : +amount;
    }

    return 0;
  }

  /**
   * Calculates net debt from an array of ledger entries.
   * Result:
   * > 0 : memberA owes memberB
   * < 0 : memberB owes memberA
   * = 0 : balanced / lunas
   */
  function calculateNet(entries, memberAId = MEMBER_IWAN) {
    if (!Array.isArray(entries)) return 0;
    return entries.reduce((total, entry) => {
      return total + toSignedDelta(entry, memberAId);
    }, 0);
  }

  /**
   * Generates human-readable position description text and status badge metadata.
   */
  function describePosition(netDebt, memberAName = 'Iwan', memberBName = 'Wadda') {
    const val = Number(netDebt) || 0;

    if (val > 0) {
      return {
        netDebt: val,
        status: 'debt_a',
        debtor: memberAName,
        creditor: memberBName,
        amount: val,
        text: `${memberAName} berhutang ${formatCurrency(val)} kepada ${memberBName}`,
        shortText: `${memberAName} berhutang ke ${memberBName}`,
        badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
      };
    }

    if (val < 0) {
      const absVal = Math.abs(val);
      return {
        netDebt: val,
        status: 'debt_b',
        debtor: memberBName,
        creditor: memberAName,
        amount: absVal,
        text: `${memberBName} berhutang ${formatCurrency(absVal)} kepada ${memberAName}`,
        shortText: `${memberBName} berhutang ke ${memberAName}`,
        badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      };
    }

    return {
      netDebt: 0,
      status: 'balanced',
      debtor: null,
      creditor: null,
      amount: 0,
      text: 'Tidak ada hutang bersih',
      shortText: 'Lunas / Seimbang',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    };
  }

  /**
   * Fallback currency formatter if window.formatRupiah is not yet loaded
   */
  function formatCurrency(number) {
    if (typeof window.formatRupiah === 'function') {
      return window.formatRupiah(number);
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(number);
  }

  // Export to global scope
  window.DebtEngine = {
    MEMBER_IWAN,
    MEMBER_WADDA,
    MEMBERS,
    getCounterparty,
    getMemberName,
    validateEntry,
    toSignedDelta,
    calculateNet,
    describePosition
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.DebtEngine;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
