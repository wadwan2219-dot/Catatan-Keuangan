/**
 * SaldoKu - Supabase Configuration & Initializer (js/supabase-config.js)
 * High-performance, Realtime PostgreSQL database replacement for Firebase.
 * Project ID: kurdvmvokdpewjhkdjwb
 */

const DEFAULT_SUPABASE_CONFIG = {
  url: "https://kurdvmvokdpewjhkdjwb.supabase.co",
  anonKey: "sb_publishable_rNB9X_3Q0FxYZup5ka4ndA_5uYiypLW"
};

// Retrieve custom Supabase credentials from localStorage if configured
function getSupabaseConfig() {
  const savedUrl = localStorage.getItem('saldoku_supabase_url');
  const savedKey = localStorage.getItem('saldoku_supabase_anon_key');
  if (savedUrl && savedKey) {
    return { url: savedUrl, anonKey: savedKey };
  }
  return DEFAULT_SUPABASE_CONFIG;
}

window.SUPABASE_CONFIG = getSupabaseConfig();

let supabaseClient = null;

function initSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (typeof window.supabase !== 'undefined' && window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) {
    try {
      supabaseClient = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
      window.supabaseClient = supabaseClient;
      console.log('[Supabase] Initialized successfully:', window.SUPABASE_CONFIG.url);
      if (typeof window.onSupabaseReady === 'function') {
        window.onSupabaseReady();
      }
      return supabaseClient;
    } catch (err) {
      console.warn('[Supabase] Init error:', err);
    }
  }
  return null;
}

initSupabaseClient();

// If SDK script is still loading in background, retry periodically
if (!supabaseClient) {
  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if (initSupabaseClient() || attempts > 25) {
      clearInterval(timer);
    }
  }, 100);
}

window.supabaseClient = supabaseClient;

window.isSupabaseConnected = function () {
  return window.supabaseClient !== null &&
         window.SUPABASE_CONFIG &&
         Boolean(window.SUPABASE_CONFIG.url);
};

// Direct REST API Fallback (Guaranteed to work with zero dependencies)
window.fetchSupabaseRest = async function (table) {
  const cfg = window.SUPABASE_CONFIG || DEFAULT_SUPABASE_CONFIG;
  if (!cfg || !cfg.url) return null;
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`
      }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('[Supabase REST] Fetch error:', e);
  }
  return null;
};

// Save Supabase credentials helper
window.saveSupabaseCredentials = function (url, anonKey) {
  if (!url || !anonKey) return;
  localStorage.setItem('saldoku_supabase_url', url.trim());
  localStorage.setItem('saldoku_supabase_anon_key', anonKey.trim());
  window.location.reload();
};
