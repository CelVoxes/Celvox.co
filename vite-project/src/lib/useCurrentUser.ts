import type { User as FirebaseUser } from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";

import { auth } from "@/firebase";
import { DEV_AUTH_ENABLED, DEV_USER } from "@/lib/devAuth";

/**
 * The signed-in user, honouring the development auth bypass.
 *
 * Use this instead of `useAuthState(auth)` anywhere the UI branches on whether
 * someone is logged in -- under `VITE_DEV_AUTH` there is no Firebase session to
 * observe, so `useAuthState` would report nobody and hide the whole app.
 */
export function useCurrentUser(): FirebaseUser | null {
	const [firebaseUser] = useAuthState(auth);
	return DEV_AUTH_ENABLED ? DEV_USER : firebaseUser ?? null;
}
