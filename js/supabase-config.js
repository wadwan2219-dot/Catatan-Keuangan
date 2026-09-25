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

if (typeof window.supabase !== 'undefined' && window.SUPABASE_CONFIG.url) {
  try {
    supabaseClient = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    console.log('[Supabase] Initialized successfully:', window.SUPABASE_CONFIG.url);
  } catch (err) {
    console.warn('[Supabase] Init error:', err);
  }
}

window.supabaseClient = supabaseClient;

window.isSupabaseConnected = function () {
  return window.supabaseClient !== null &&
         window.SUPABASE_CONFIG &&
         Boolean(window.SUPABASE_CONFIG.url);
};

// Save Supabase credentials helper
window.saveSupabaseCredentials = function (url, anonKey) {
  if (!url || !anonKey) return;
  localStorage.setItem('saldoku_supabase_url', url.trim());
  localStorage.setItem('saldoku_supabase_anon_key', anonKey.trim());
  window.location.reload();
};
