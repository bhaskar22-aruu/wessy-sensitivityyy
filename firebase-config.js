// Wessy Sensitivity Firebase configuration
// Firebase web API keys are public project identifiers, not admin passwords.
// Real admin protection is enforced by Firebase Authentication + Firestore Rules.

export const firebaseConfig = {
  apiKey: "AIzaSyDxaC5hESZV_R2YcYKN1GEMx3ju70Pv838",
  authDomain: "wessy-sensitivity.firebaseapp.com",
  projectId: "wessy-sensitivity",
  storageBucket: "wessy-sensitivity.firebasestorage.app",
  messagingSenderId: "97999057231",
  appId: "1:97999057231:web:65f128e6f32de8bcd1553a",
  measurementId: "G-HELBLQSK92"
};

// Only these accounts may use the owner panel.
// Firestore rules below are the actual security boundary.
export const OWNER_EMAILS = [
  "bhaskar843120@gmail.com",
  "bhaskarthakur480@gmail.com"
];
