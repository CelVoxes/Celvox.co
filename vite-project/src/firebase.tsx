import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

import { DEV_AUTH_ENABLED } from "@/lib/devAuth";

// Under VITE_DEV_AUTH the app never talks to Firebase, but initializeApp still
// runs (Navbar/Login import `auth`), so feed it placeholders rather than
// undefined values.
const firebaseConfig = DEV_AUTH_ENABLED
	? {
			apiKey: "dev-auth-bypass",
			authDomain: "localhost",
			projectId: "seamless-dev",
			appId: "1:0:web:0",
	  }
	: {
			apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
			authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
			projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
			storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
			messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
			appId: import.meta.env.VITE_FIREBASE_APP_ID,
			measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
	  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
