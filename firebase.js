import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, doc, setDoc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD41yO7rDf-O6evKClMP6lMVNcZAuIDvxo",
  authDomain: "macgamesid.firebaseapp.com",
  projectId: "macgamesid",
  storageBucket: "macgamesid.firebasestorage.app",
  messagingSenderId: "1006615964312",
  appId: "1:1006615964312:web:cf646f3f15f85ea0b27eed"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged,
         collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp,
         doc, setDoc, getDoc, ref, uploadBytes, getDownloadURL };
