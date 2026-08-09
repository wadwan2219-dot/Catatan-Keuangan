/**
 * SaldoKu - Firebase Configuration & Initializer
 * Project ID: saldoku-app
 * Connects Firebase Auth & Firestore for multi-device real-time sync.
 */

// Default Firebase Configuration for Project: saldoku-app
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyB1jNlZUJlvxbE_cvkPSkmVwUx7gITS3HI",
  authDomain: "saldoku-app.firebaseapp.com",
  projectId: "saldoku-app",
  storageBucket: "saldoku-app.appspot.com",
  messagingSenderId: "915322861447",
  appId: "1:915322861447:web:fcb09e9138d20e99770522"
};

// Retrieve custom Firebase config from localStorage if saved by user
function getFirebaseConfig() {
  const saved = localStorage.getItem('saldoku_firebase_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved Firebase config.', e);
    }
  }
  return DEFAULT_FIREBASE_CONFIG;
}

window.FIREBASE_CONFIG = getFirebaseConfig();

// Initialize Firebase SDK Compat instance if window.firebase exists
let firebaseAuth = null;
let firebaseDb = null;

if (typeof window.firebase !== 'undefined') {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    firebaseAuth = firebase.auth();
    firebaseDb = firebase.firestore();
    console.log('✅ Firebase initialized successfully for project:', window.FIREBASE_CONFIG.projectId);
  } catch (err) {
    console.warn('⚠️ Firebase init fallback mode active:', err.message);
  }
}

window.firebaseAuth = firebaseAuth;
window.firebaseDb = firebaseDb;

// Check if production Firebase key is configured
window.isFirebaseConnected = function () {
  return window.FIREBASE_CONFIG &&
    window.FIREBASE_CONFIG.apiKey &&
    !window.FIREBASE_CONFIG.apiKey.includes('DEMO_KEY');
};

// Function to save custom API Key from setting modal
window.saveFirebaseCredentials = function (configObj) {
  localStorage.setItem('saldoku_firebase_config', JSON.stringify(configObj));
  window.FIREBASE_CONFIG = configObj;
  window.location.reload();
};
