import { useEffect, useState } from "react";
import { fetchCatalog, type PlatformCatalog } from "@/utils/api";
import { STATIC_FALLBACK_CATALOG } from "@/config/dashboard-tools";

// Module-level cache so the catalog is fetched once per session and shared
// across every component that needs it.
let cachedCatalog: PlatformCatalog | null = null;
let inFlight: Promise<PlatformCatalog> | null = null;

async function loadCatalog(): Promise<PlatformCatalog> {
	if (cachedCatalog) return cachedCatalog;
	if (!inFlight) {
		inFlight = fetchCatalog()
			.then((c) => {
				cachedCatalog = c;
				return c;
			})
			.catch(() => {
				// Resilient by design: if /catalog is unavailable (e.g. an older
				// backend), fall back to the statically-mirrored catalog so the UI
				// keeps working with today's behavior. Don't cache the fallback so a
				// later successful fetch can replace it.
				inFlight = null;
				return STATIC_FALLBACK_CATALOG;
			});
	}
	return inFlight;
}

export type UseCatalogResult = {
	catalog: PlatformCatalog;
	isLoading: boolean;
	/** true while the static fallback is in use (real fetch not yet resolved). */
	isFallback: boolean;
};

export function useCatalog(): UseCatalogResult {
	const [catalog, setCatalog] = useState<PlatformCatalog>(
		cachedCatalog ?? STATIC_FALLBACK_CATALOG,
	);
	const [isLoading, setIsLoading] = useState(!cachedCatalog);

	useEffect(() => {
		let active = true;
		if (cachedCatalog) {
			setCatalog(cachedCatalog);
			setIsLoading(false);
			return;
		}
		void loadCatalog().then((c) => {
			if (!active) return;
			setCatalog(c);
			setIsLoading(false);
		});
		return () => {
			active = false;
		};
	}, []);

	return {
		catalog,
		isLoading,
		isFallback: catalog === STATIC_FALLBACK_CATALOG,
	};
}
