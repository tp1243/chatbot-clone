// firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD-URtIHoLXPjht38NoFIuDdRgTRkISarA",
  authDomain: "chatgpt-21b6b.firebaseapp.com",
  databaseURL: "https://chatgpt-21b6b-default-rtdb.firebaseio.com",
  projectId: "chatgpt-21b6b",
  storageBucket: "chatgpt-21b6b.firebasestorage.app",
  messagingSenderId: "895065749709",
  appId: "1:895065749709:web:e262f3f53df557522ad184"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
