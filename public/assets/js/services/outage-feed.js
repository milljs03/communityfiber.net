const OUTAGE_FEED_URL = 'https://residential-fiber.web.app/api/public-outage-feed';
const REFRESH_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 12000;

export const OUTAGE_PAGE_PATH = '/outage.html';

let snapshot = {
    status: 'idle',
    data: null,
    error: null,
    fetchedAt: '',
    stale: false
};

let refreshTimer = null;
let pendingRequest = null;
let listeners = new Set();
let visibilityHandlerBound = false;

function emitSnapshot() {
    listeners.forEach((listener) => {
        try {
            listener(snapshot);
        } catch (error) {
            console.error('Outage feed subscriber failed.', error);
        }
    });
}

function updateSnapshot(patch) {
    snapshot = {
        ...snapshot,
        ...patch
    };

    emitSnapshot();
}

function toFiniteNumber(value) {
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
}

function normalizePoint(point) {
    if (!point || typeof point !== 'object') {
        return null;
    }

    const lat = toFiniteNumber(point.lat);
    const lng = toFiniteNumber(point.lng);

    if (lat === null || lng === null) {
        return null;
    }

    return { lat, lng };
}

function normalizeArea(area) {
    const polygonPath = Array.isArray(area?.polygonPath)
        ? area.polygonPath.map(normalizePoint).filter(Boolean)
        : [];

    return {
        id: typeof area?.id === 'string' ? area.id : '',
        name: typeof area?.name === 'string' && area.name.trim() ? area.name.trim() : 'Unnamed service area',
        outage: Boolean(area?.outage),
        polygonPath,
        center: normalizePoint(area?.center),
        nodeCoordinates: normalizePoint(area?.nodeCoordinates),
        cityHint: typeof area?.cityHint === 'string' ? area.cityHint.trim() : '',
        updatedAtLabel: typeof area?.updatedAtLabel === 'string' ? area.updatedAtLabel.trim() : '',
        importedAtLabel: typeof area?.importedAtLabel === 'string' ? area.importedAtLabel.trim() : '',
        manualPolygon: Boolean(area?.manualPolygon)
    };
}

function normalizeFeed(payload) {
    const rawSummary = payload?.summary && typeof payload.summary === 'object'
        ? payload.summary
        : {};

    const areas = Array.isArray(payload?.areas)
        ? payload.areas.map(normalizeArea)
        : [];

    const outageAreas = areas.filter((area) => area.outage);
    const active = Boolean(rawSummary.active) || outageAreas.length > 0;
    const fallbackMessage = active
        ? `${outageAreas.length} service area${outageAreas.length === 1 ? ' is' : 's are'} currently affected.`
        : 'All published service areas are currently reporting healthy status.';

    return {
        ok: Boolean(payload?.ok),
        version: Number.isFinite(Number(payload?.version)) ? Number(payload.version) : 1,
        generatedAt: typeof payload?.generatedAt === 'string' ? payload.generatedAt : '',
        summary: {
            active,
            title: typeof rawSummary.title === 'string' && rawSummary.title.trim()
                ? rawSummary.title.trim()
                : (active ? 'We are currently experiencing an outage' : 'No active outages are currently reported'),
            message: typeof rawSummary.message === 'string' && rawSummary.message.trim()
                ? rawSummary.message.trim()
                : fallbackMessage,
            outageCount: Number.isFinite(Number(rawSummary.outageCount))
                ? Number(rawSummary.outageCount)
                : outageAreas.length,
            totalAreaCount: Number.isFinite(Number(rawSummary.totalAreaCount))
                ? Number(rawSummary.totalAreaCount)
                : areas.length,
            affectedCabinetIds: Array.isArray(rawSummary.affectedCabinetIds)
                ? rawSummary.affectedCabinetIds.filter((value) => typeof value === 'string')
                : outageAreas.map((area) => area.id),
            affectedCabinetNames: Array.isArray(rawSummary.affectedCabinetNames)
                ? rawSummary.affectedCabinetNames.filter((value) => typeof value === 'string')
                : outageAreas.map((area) => area.name),
            importedAtLabel: typeof rawSummary.importedAtLabel === 'string'
                ? rawSummary.importedAtLabel.trim()
                : '',
            importSummary: typeof rawSummary.importSummary === 'string'
                ? rawSummary.importSummary.trim()
                : ''
        },
        areas
    };
}

function describeFetchError(error) {
    if (error?.name === 'AbortError') {
        return 'The outage feed took too long to respond.';
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return 'The outage feed is temporarily unavailable.';
}

function bindVisibilityRefresh() {
    if (visibilityHandlerBound) {
        return;
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            refreshOutageFeed({ background: true }).catch(() => {});
        }
    });

    visibilityHandlerBound = true;
}

export function getOutageFeedSnapshot() {
    return snapshot;
}

export function startOutageFeedPolling() {
    if (refreshTimer) {
        return;
    }

    bindVisibilityRefresh();

    refreshOutageFeed().catch(() => {});
    refreshTimer = window.setInterval(() => {
        refreshOutageFeed({ background: true }).catch(() => {});
    }, REFRESH_INTERVAL_MS);
}

export function subscribeToOutageFeed(listener) {
    if (typeof listener !== 'function') {
        throw new TypeError('Outage feed subscriber must be a function.');
    }

    listeners.add(listener);
    listener(snapshot);
    startOutageFeedPolling();

    return () => {
        listeners.delete(listener);
    };
}

export async function refreshOutageFeed({ background = false } = {}) {
    if (pendingRequest) {
        return pendingRequest;
    }

    if (!background && !snapshot.data) {
        updateSnapshot({
            status: 'loading',
            error: null
        });
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    pendingRequest = fetch(OUTAGE_FEED_URL, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            Accept: 'application/json'
        },
        signal: controller.signal
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`The outage feed returned ${response.status}.`);
            }

            const payload = await response.json();
            const data = normalizeFeed(payload);

            updateSnapshot({
                status: 'ready',
                data,
                error: null,
                fetchedAt: new Date().toISOString(),
                stale: false
            });

            return data;
        })
        .catch((error) => {
            updateSnapshot({
                status: snapshot.data ? 'ready' : 'error',
                error: describeFetchError(error),
                stale: Boolean(snapshot.data)
            });

            throw error;
        })
        .finally(() => {
            window.clearTimeout(timeoutId);
            pendingRequest = null;
        });

    return pendingRequest;
}
