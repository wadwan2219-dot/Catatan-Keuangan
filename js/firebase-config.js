/**
 * SaldoKu - Firebase Configuration & Initialization
 * Project ID: saldoku-app
 * Supports full Firebase v10 SDK with fallback to LocalStorage for instant testing.
 */

// Default Firebase Configuration for Project: saldoku-app
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSy_DEMO_KEY_SALDOKU_APP_READY",
  authDomain: "saldoku-app.firebaseapp.com",
  projectId: "saldoku-app",
  storageBucket: "saldoku-app.appspot.com",
  messagingSenderId: "915322861447",
  appId: "1:915322861447:web:saldokuwebapp"
};

// Retrieve custom Firebase config from localStorage if set by user, otherwise use default
function getFirebaseConfig() {
  const saved = localStorage.getItem('saldoku_firebase_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved Firebase config, using default.', e);
    }
  }
  return DEFAULT_FIREBASE_CONFIG;
}

// Global Config Expose
window.FIREBASE_CONFIG = getFirebaseConfig();

// Helper to check if Firebase is configured with a real user key
window.isFirebaseConfigured = function() {
  const config = window.FIREBASE_CONFIG;
  return config && 
         config.apiKey && 
         !config.apiKey.includes('DEMO_KEY') && 
         config.projectId === 'saldoku-app';
};

// Save custom config helper
window.saveCustomFirebaseConfig = function(customConfig) {
  localStorage.setItem('saldoku_firebase_config', JSON.stringify(customConfig));
  window.FIREBASE_CONFIG = customConfig;
};
