import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-client.js';

const guestEls = Array.from(document.querySelectorAll('[data-auth-guest]'));
const userEls = Array.from(document.querySelectorAll('[data-auth-user]'));
const signoutButtons = Array.from(document.querySelectorAll('[data-auth-signout]'));
const dashboardNavItems = Array.from(document.querySelectorAll('[data-nav-dashboard]'));

function setVisibility(isAuthenticated) {
  guestEls.forEach((el) => {
    el.hidden = isAuthenticated;
  });

  userEls.forEach((el) => {
    el.hidden = !isAuthenticated;
  });

  signoutButtons.forEach((el) => {
    el.hidden = !isAuthenticated;
  });

  dashboardNavItems.forEach((el) => {
    el.hidden = !isAuthenticated;
  });
}

onAuthStateChanged(auth, (user) => {
  setVisibility(Boolean(user));
});

signoutButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } finally {
      window.location.href = '/auth?mode=signin';
    }
  });
});
