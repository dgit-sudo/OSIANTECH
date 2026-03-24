import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAnalytics, isSupported as analyticsSupported } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBVxfvT0CIFmKqstoLbHIHXwrT93cZKmpg',
  authDomain: 'osiantech-7f0d7.firebaseapp.com',
  projectId: 'osiantech-7f0d7',
  storageBucket: 'osiantech-7f0d7.firebasestorage.app',
  messagingSenderId: '27492248130',
  appId: '1:27492248130:web:27b01f9d9b1eede0259bdb',
  measurementId: 'G-0JH3KP43W1',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

analyticsSupported().then((supported) => {
  if (supported) getAnalytics(app);
}).catch(() => {
  // Analytics is optional for authentication flow.
});

const feedbackEl = document.getElementById('auth-feedback');
const signupForm = document.getElementById('signup-form');
const signinForm = document.getElementById('signin-form');
const googleSignupBtn = document.getElementById('google-signup-btn');
const googleSigninBtn = document.getElementById('google-signin-btn');

function messageFromError(error) {
  const code = error?.code || '';
  const map = {
    'auth/email-already-in-use': 'This email is already in use. Please sign in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
    'auth/popup-blocked': 'Popup was blocked by the browser. Please allow popups and try again.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled. Please try again.',
  };
  return map[code] || 'Authentication failed. Please try again.';
}

function setFeedback(message, type = 'info') {
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  feedbackEl.className = `auth-feedback auth-feedback-${type}`;
}

function redirectAfterAuth() {
  window.location.href = '/courses';
}

async function signInWithGoogle() {
  setFeedback('Signing in with Google...', 'info');
  try {
    await signInWithPopup(auth, googleProvider);
    setFeedback('Success! Redirecting...', 'success');
    redirectAfterAuth();
  } catch (error) {
    setFeedback(messageFromError(error), 'error');
  }
}

if (googleSignupBtn) {
  googleSignupBtn.addEventListener('click', signInWithGoogle);
}

if (googleSigninBtn) {
  googleSigninBtn.addEventListener('click', signInWithGoogle);
}

if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('signup-name')?.value?.trim() || '';
    const email = document.getElementById('signup-email')?.value?.trim() || '';
    const password = document.getElementById('signup-password')?.value || '';

    setFeedback('Creating your account...', 'info');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (name) {
        await updateProfile(userCredential.user, { displayName: name });
      }
      setFeedback('Account created successfully. Redirecting...', 'success');
      redirectAfterAuth();
    } catch (error) {
      setFeedback(messageFromError(error), 'error');
    }
  });
}

if (signinForm) {
  signinForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('signin-email')?.value?.trim() || '';
    const password = document.getElementById('signin-password')?.value || '';

    setFeedback('Signing you in...', 'info');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setFeedback('Welcome back. Redirecting...', 'success');
      redirectAfterAuth();
    } catch (error) {
      setFeedback(messageFromError(error), 'error');
    }
  });
}
