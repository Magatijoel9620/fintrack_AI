// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "TODO: Add your api key",
  authDomain: "TODO: Add your auth domain",
  projectId: "TODO: Add your project id",
  storageBucket: "TODO: Add your storage bucket",
  messagingSenderId: "TODO: Add your messaging sender id",
  appId: "TODO: Add your app id",
  measurementId: "TODO: Add your measurement id"
};

// Initialize Firebase
let app;
// if (!getApps().length) {
//     app = initializeApp(firebaseConfig);
// } else {
//     app = getApps()[0];
// }

// export const auth = getAuth(app);
// export const db = getFirestore(app);
export const auth = {} as any;
export const db = {} as any;
