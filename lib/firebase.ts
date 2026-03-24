import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBVxfvT0CIFmKqstoLbHIHXwrT93cZKmpg',
  authDomain: 'osiantech-7f0d7.firebaseapp.com',
  projectId: 'osiantech-7f0d7',
  storageBucket: 'osiantech-7f0d7.firebasestorage.app',
  messagingSenderId: '627373204726',
  appId: '1:627373204726:web:e2b54b18c4d5a1b8f0c3d4',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export default app;
