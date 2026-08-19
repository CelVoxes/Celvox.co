import type { User as FirebaseUser } from "firebase/auth";

/**
 * Local development bypass for Firebase Auth.
 *
 * When `VITE_DEV_AUTH=1` the app skips Firebase sign-in entirely and behaves as
 * if a fixed user were logged in, sending a static bearer token that the API
 * service accepts while its own `SEAMLESS_DEV_AUTH` flag is set. This is what
 * lets the Docker stack run without a Firebase project.
 *
 * Both flags must be set for requests to succeed -- neither side trusts the
 * other's configuration.
 */
export const DEV_AUTH_ENABLED = import.meta.env.VITE_DEV_AUTH === "1";

export const DEV_USER_EMAIL =
	import.meta.env.VITE_DEV_USER_EMAIL || "dev@localhost";

/** Placeholder token; the service ignores its contents under SEAMLESS_DEV_AUTH. */
export const DEV_ID_TOKEN = "dev-auth-bypass";

/**
 * Minimal stand-in for a signed-in Firebase user. Only the fields the app
 * actually reads are populated; the cast keeps the shim out of the app's types.
 *
 * A single frozen instance rather than a factory, so it stays referentially
 * stable across renders and is safe in hook dependency arrays.
 */
export const DEV_USER: FirebaseUser = Object.freeze({
	uid: `dev:${DEV_USER_EMAIL}`,
	email: DEV_USER_EMAIL,
	displayName: "Local Dev",
	emailVerified: true,
	isAnonymous: false,
	photoURL: null,
	phoneNumber: null,
	providerId: "dev",
	metadata: {},
	providerData: [],
	refreshToken: DEV_ID_TOKEN,
	tenantId: null,
	delete: async () => {},
	getIdToken: async () => DEV_ID_TOKEN,
	getIdTokenResult: async () => ({ token: DEV_ID_TOKEN }),
	reload: async () => {},
	toJSON: () => ({ uid: `dev:${DEV_USER_EMAIL}`, email: DEV_USER_EMAIL }),
}) as unknown as FirebaseUser;
