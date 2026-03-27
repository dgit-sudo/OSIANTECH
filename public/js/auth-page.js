import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth, googleProvider } from './firebase-client.js';

const root = document.querySelector('[data-auth-page]');
if (!root) {
  // No auth page loaded.
} else {
  const modeButtons = Array.from(document.querySelectorAll('[data-auth-mode-btn]'));
  const switchButtons = Array.from(document.querySelectorAll('[data-auth-switch]'));
  const titleEl = document.getElementById('auth-title');
  const subtitleEl = document.getElementById('auth-subtitle');
  const googleLabel = document.getElementById('google-auth-label');
  const submitBtn = document.getElementById('auth-submit-btn');
  const switchCopy = document.getElementById('auth-switch-copy');
  const nameGroup = document.getElementById('name-group');
  const nameInput = document.getElementById('auth-name');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const form = document.getElementById('auth-form');
  const googleBtn = document.getElementById('google-auth-btn');
  const feedbackEl = document.getElementById('auth-feedback');

  let mode = root.getAttribute('data-default-mode') === 'signin' ? 'signin' : 'signup';

  const normalizeError = (error) => {
    const map = {
      'auth/email-already-in-use': 'An account with this email already exists. Please sign in.',
      'auth/user-not-found': 'No account found for this email. Please sign up first.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
      'auth/popup-blocked': 'Popup was blocked. Please allow popups and try again.',
      'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method (e.g. Password). Please use that method.',
    };
    return map[error?.code] || 'Authentication failed. Please try again.';
  };

  const setFeedback = (message = '', type = 'info') => {
    if (!feedbackEl) return;
    if (!message) {
      feedbackEl.className = 'auth-feedback';
      feedbackEl.textContent = '';
      return;
    }
    feedbackEl.className = `auth-feedback auth-feedback-${type}`;
    feedbackEl.textContent = message;
  };

  const setMode = (nextMode) => {
    mode = nextMode === 'signin' ? 'signin' : 'signup';

    modeButtons.forEach((btn) => {
      const selected = btn.getAttribute('data-auth-mode-btn') === mode;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    });

    const isSignup = mode === 'signup';
    titleEl.textContent = isSignup ? 'Create Account' : 'Sign In';
    subtitleEl.textContent = isSignup
      ? 'Start learning with your Osian account.'
      : 'Use your credentials to open your dashboard.';
    googleLabel.textContent = isSignup ? 'Sign up with Google' : 'Sign in with Google';
    submitBtn.textContent = isSignup ? 'Create Account' : 'Sign In';
    switchCopy.innerHTML = isSignup
      ? 'Already have an account? <button type="button" class="auth-switch-link" data-auth-switch="signin">Sign In</button>'
      : 'New to Osian Academy? <button type="button" class="auth-switch-link" data-auth-switch="signup">Create Account</button>';

    if (nameGroup) nameGroup.hidden = !isSignup;
    if (nameInput) {
      nameInput.required = isSignup;
      if (!isSignup) nameInput.value = '';
    }

    switchButtons.length = 0;
    document.querySelectorAll('[data-auth-switch]').forEach((btn) => {
      switchButtons.push(btn);
      btn.addEventListener('click', () => setMode(btn.getAttribute('data-auth-switch')));
    });

    setFeedback('');
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    window.history.replaceState({}, '', url);
  };

  const detectProvider = (user) => {
    const providerId = user?.providerData?.[0]?.providerId || '';
    if (providerId === 'google.com') return 'google';
    if (providerId === 'password') return 'password';
    return providerId || 'password';
  };

  const syncUserToSupabase = async (user) => {
    if (!user?.uid || !user?.email) return;

    await fetch('/api/profile/sync-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        provider: detectProvider(user),
      }),
    });
  };

  const redirectToDashboard = () => {
    window.location.href = '/dashboard';
  };

  const handleExistingSession = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await user.getIdToken();
      redirectToDashboard();
    } catch {
      // Do not force logout on transient token refresh issues.
      setFeedback('Session check failed. Please continue signing in.', 'info');
    }
  };

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      await user.getIdToken();
      redirectToDashboard();
    } catch {
      setFeedback('Could not validate session. Please try signing in again.', 'error');
    }
  });

  googleBtn.addEventListener('click', async () => {
    setFeedback(mode === 'signup' ? 'Signing up with Google...' : 'Signing in with Google...', 'info');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const additionalInfo = getAdditionalUserInfo(cred);
      if (additionalInfo?.isNewUser && mode === 'signin') {
        await cred.user.delete();
        setFeedback('No account found with this Google account. Please sign up first.', 'error');
        return;
      }
      await syncUserToSupabase(cred.user);
      setFeedback('Success! Redirecting to dashboard...', 'success');
      redirectToDashboard();
    } catch (error) {
      setFeedback(normalizeError(error), 'error');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setFeedback('Email and password are required.', 'error');
      return;
    }

    setFeedback('Checking account...', 'info');

    try {
      if (mode === 'signup') {
        setFeedback('Creating account...', 'info');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const name = (nameInput?.value || '').trim();
        if (name) {
          await updateProfile(cred.user, { displayName: name });
          cred.user.displayName = name;
        }
        await syncUserToSupabase(cred.user);
        setFeedback('Account created successfully. Redirecting...', 'success');
        redirectToDashboard();
      } else {
        setFeedback('Signing in...', 'info');
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await syncUserToSupabase(cred.user);
        setFeedback('Welcome back! Redirecting...', 'success');
        redirectToDashboard();
      }
    } catch (error) {
      setFeedback(normalizeError(error), 'error');
    }
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.getAttribute('data-auth-mode-btn')));
  });

  switchButtons.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.getAttribute('data-auth-switch')));
  });

  setMode(mode);
  handleExistingSession();
}
