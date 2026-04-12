import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB7OlFNaEOFhc87_R8vHW02NeXkAJdx0BE",
  authDomain: "tenant-app-2098b.firebaseapp.com",
  projectId: "tenant-app-2098b",
  storageBucket: "tenant-app-2098b.firebasestorage.app",
  messagingSenderId: "28371141479",
  appId: "1:28371141479:web:dad1982d2165902705a5c2",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);