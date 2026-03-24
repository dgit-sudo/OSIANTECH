import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAnalytics, isSupported as analyticsSupported } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

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

googleProvider.setCustomParameters({ prompt: 'select_account' });

analyticsSupported().then((supported) => {
  if (supported) getAnalytics(app);
}).catch(() => {
  // Analytics is optional.
});

export { app, auth, googleProvider };
