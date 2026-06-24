import {
    subscribeToOutageFeed,
    getOutageFeedSnapshot,
    refreshOutageFeed
} from './services/outage-feed.js';

const MAPS_API_META_NAME = 'google-maps-api-key';

const COLOR_HEALTHY = '#15803d';
const COLOR_HEALTHY_FILL = '#22c55e';
const COLOR_OUTAGE = '#b91c1c';
const COLOR_OUTAGE_FILL = '#ef4444';

let elements = {};
let map = null;
let geocoder = null;
let lookupMarker = null;
let renderedPolygons = [];
let outagePolygons = [];
let servicePolygons = [];
let mapsReady = false;
let mapsLoadFailed = false;
let hasFitBounds = false;
let lastLookup = null;
let currentSnapshot = getOutageFeedSnapshot();
let mapsLoadPromise = null;
const MAPS_LOAD_TIMEOUT_MS = 15000;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatGeneratedTime(value) {
    if (!value) {
        return '';
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString();
}

function getMapsApiKey() {
    return document.querySelector(`meta[name="${MAPS_API_META_NAME}"]`)?.content?.trim() || '';
}

function loadGoogleMaps() {
    if (window.google?.maps?.Map) {
        return Promise.resolve(window.google.maps);
    }

    if (mapsLoadPromise) {
        return mapsLoadPromise;
    }

    const apiKey = getMapsApiKey();
    if (!apiKey) {
        return Promise.reject(new Error('Missing Google Maps API key.'));
    }

    mapsLoadPromise = new Promise((resolve, reject) => {
        const callbackName = '__cfnOutageMapsReady';
        let settled = false;

        const finalize = (handler, value) => {
            if (settled) {
                return;
            }

            settled = true;
            window.clearTimeout(timeoutId);
            try {
                delete window[callbackName];
            } catch (error) {
                window[callbackName] = undefined;
            }
            handler(value);
        };

        const timeoutId = window.setTimeout(() => {
            if (window.google?.maps?.Map) {
                finalize(resolve, window.google.maps);
                return;
            }

            finalize(reject, new Error('Google Maps took too long to load.'));
        }, MAPS_LOAD_TIMEOUT_MS);

        window[callbackName] = () => {
            if (window.google?.maps?.Map) {
                finalize(resolve, window.google.maps);
                return;
            }

            finalize(reject, new Error('Google Maps loaded without the Map library.'));
        };

        const existingScript = document.getElementById('cfn-google-maps');
        if (existingScript) {
            existingScript.addEventListener('load', () => {
                if (window.google?.maps?.Map) {
                    finalize(resolve, window.google.maps);
                }
            }, { once: true });
            existingScript.addEventListener('error', () => finalize(reject, new Error('Google Maps failed to load.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = 'cfn-google-maps';
        script.async = true;
        script.defer = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry&callback=${callbackName}&loading=async`;
        script.onerror = () => finalize(reject, new Error('Google Maps failed to load.'));
        document.head.appendChild(script);
    });

    return mapsLoadPromise;
}

function cacheElements() {
    elements = {
        badge: document.getElementById('outage-badge'),
        title: document.getElementById('outage-title'),
        message: document.getElementById('outage-message'),
        meta: document.getElementById('outage-meta'),
        detail: document.getElementById('outage-detail'),
        refreshNote: document.getElementById('refresh-note'),
        mapRoot: document.getElementById('outage-map'),
        mapOverlay: document.getElementById('outage-map-overlay'),
        lookupForm: document.getElementById('outage-lookup-form'),
        lookupInput: document.getElementById('outage-address'),
        lookupSubmit: document.getElementById('outage-lookup-submit'),
        lookupResult: document.getElementById('lookup-result'),
        mapReset: document.getElementById('map-reset'),
        summary: document.getElementById('outage-summary')
    };
}

function setMapOverlay(message, tone = 'info') {
    if (!elements.mapOverlay) {
        return;
    }

    elements.mapOverlay.textContent = message;
    elements.mapOverlay.dataset.tone = tone;
    elements.mapOverlay.hidden = false;
}

function hideMapOverlay() {
    if (!elements.mapOverlay) {
        return;
    }

    elements.mapOverlay.hidden = true;
}

function setLookupBusy(isBusy) {
    if (!elements.lookupSubmit) {
        return;
    }

    elements.lookupSubmit.disabled = isBusy;
    elements.lookupSubmit.textContent = isBusy ? 'Checking address...' : 'Check address';
}

function renderLookupResult(tone, title, lines = []) {
    if (!elements.lookupResult) {
        return;
    }

    const body = lines
        .filter(Boolean)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('');

    elements.lookupResult.className = `lookup-result lookup-result--${tone}`;
    elements.lookupResult.innerHTML = `
        <h3>${escapeHtml(title)}</h3>
        ${body}
    `;
}

function clearPolygons() {
    renderedPolygons.forEach((entry) => {
        entry.polygon.setMap(null);
    });

    renderedPolygons = [];
    outagePolygons = [];
    servicePolygons = [];
}

function initMap() {
    if (!elements.mapRoot || map) {
        return;
    }

    map = new google.maps.Map(elements.mapRoot, {
        center: { lat: 41.55, lng: -85.89 },
        zoom: 10,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        clickableIcons: false
    });

    geocoder = new google.maps.Geocoder();
}

function renderPolygons(data) {
    if (!map || !data) {
        return;
    }

    clearPolygons();

    const bounds = new google.maps.LatLngBounds();
    let validPolygonCount = 0;

    data.areas.forEach((area) => {
        if (!Array.isArray(area.polygonPath) || area.polygonPath.length < 3) {
            return;
        }

        const polygon = new google.maps.Polygon({
            paths: area.polygonPath,
            strokeColor: area.outage ? COLOR_OUTAGE : COLOR_HEALTHY,
            strokeOpacity: 0.95,
            strokeWeight: area.outage ? 2.25 : 1.5,
            fillColor: area.outage ? COLOR_OUTAGE_FILL : COLOR_HEALTHY_FILL,
            fillOpacity: area.outage ? 0.26 : 0.16,
            map,
            clickable: false,
            zIndex: area.outage ? 3 : 1
        });

        renderedPolygons.push({ area, polygon });
        servicePolygons.push({ area, polygon });

        if (area.outage) {
            outagePolygons.push({ area, polygon });
        }

        area.polygonPath.forEach((point) => bounds.extend(point));
        validPolygonCount += 1;
    });

    if (validPolygonCount === 0) {
        setMapOverlay('No map geometry is available from the public outage feed.', 'muted');
        return;
    }

    hideMapOverlay();

    if (!hasFitBounds) {
        map.fitBounds(bounds, 56);
        hasFitBounds = true;
    }
}

function placeLookupMarker(latLng, label) {
    if (!lookupMarker) {
        lookupMarker = new google.maps.Marker({
            map,
            position: latLng,
            title: label
        });
        return;
    }

    lookupMarker.setPosition(latLng);
    lookupMarker.setTitle(label);
}

function evaluateLookup(latLng, formattedAddress, { panToMarker = false } = {}) {
    if (!mapsReady || !currentSnapshot?.data) {
        return;
    }

    const matchingOutages = outagePolygons
        .filter(({ polygon }) => google.maps.geometry.poly.containsLocation(latLng, polygon))
        .map(({ area }) => area);

    const matchingAreas = servicePolygons
        .filter(({ polygon }) => google.maps.geometry.poly.containsLocation(latLng, polygon))
        .map(({ area }) => area);

    if (panToMarker && map) {
        map.panTo(latLng);
        if ((map.getZoom() || 0) < 13) {
            map.setZoom(13);
        }
    }

    if (matchingOutages.length > 0) {
        renderLookupResult(
            'alert',
            'Your address appears to be inside the current outage area.',
            [
                formattedAddress,
                'This result is based on the current public outage polygons and Google geocoding.'
            ]
        );
        return;
    }

    const detailLine = matchingAreas.length > 0
        ? 'This address appears outside the current outage area.'
        : 'This address appears outside the current outage polygons based on the published map.';

    renderLookupResult(
        'success',
        'Your address appears to be outside the current outage area.',
        [
            formattedAddress,
            detailLine
        ]
    );
}

function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
        geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && Array.isArray(results) && results.length > 0) {
                resolve(results[0]);
                return;
            }

            if (status === 'ZERO_RESULTS') {
                reject(new Error('We could not find that address. Try adding the city or ZIP code.'));
                return;
            }

            reject(new Error('We could not look up that address right now.'));
        });
    });
}

function renderSummary(snapshot) {
    currentSnapshot = snapshot;

    if (!elements.summary) {
        return;
    }

    if (!snapshot.data) {
        const isError = snapshot.status === 'error';
        elements.summary.dataset.state = isError ? 'error' : 'loading';
        elements.badge.textContent = isError ? 'Status unavailable' : 'Loading live feed';
        elements.title.textContent = isError ? 'We could not load the public outage feed.' : 'Checking network status...';
        elements.message.textContent = isError
            ? 'Please try again shortly. The outage page will keep retrying every 30 seconds.'
            : 'Fetching the latest public outage map.';
        elements.meta.textContent = 'Updates every 30 seconds.';
        elements.detail.textContent = snapshot.error || '';
        elements.refreshNote.textContent = 'Refreshing every 30 seconds.';
        renderLookupResult(
            isError ? 'warning' : 'pending',
            isError ? 'Network status unavailable' : 'Address check',
            [
                isError
                    ? 'The outage polygons are unavailable right now. Try again in a moment.'
                    : 'Enter an address to compare it against the current outage polygons.'
            ]
        );
        return;
    }

    const { summary, generatedAt } = snapshot.data;
    const activeState = summary.active ? 'active' : 'clear';
    const generatedAtLabel = summary.importedAtLabel || formatGeneratedTime(generatedAt);

    elements.summary.dataset.state = activeState;
    elements.badge.textContent = summary.active ? 'Active outage' : 'No active outages';
    elements.title.textContent = summary.active
        ? summary.title
        : 'No active outages are currently reported.';
    elements.message.textContent = summary.active
        ? summary.message
        : 'The map currently shows no active outage areas.';
    elements.meta.textContent = generatedAtLabel
        ? `Last import: ${generatedAtLabel}`
        : 'Updates every 30 seconds.';

    if (snapshot.stale && snapshot.error) {
        elements.detail.textContent = `Showing the last successful update. ${snapshot.error}`;
        elements.refreshNote.textContent = 'Refresh is still running every 30 seconds.';
    } else {
        elements.detail.textContent = 'The outage banner, map, and address check refresh automatically every 30 seconds.';
        elements.refreshNote.textContent = 'Live feed refreshes every 30 seconds.';
    }

}

function renderMap(snapshot) {
    if (mapsLoadFailed) {
        setMapOverlay('Google Maps is unavailable. Add a valid browser API key to load the outage map.', 'error');
        return;
    }

    if (!mapsReady) {
        setMapOverlay('Loading Google Maps and outage geometry...', 'info');
        return;
    }

    if (!snapshot.data) {
        setMapOverlay(
            snapshot.status === 'error'
                ? 'The public outage feed is temporarily unavailable.'
                : 'Loading outage geometry...',
            snapshot.status === 'error' ? 'error' : 'info'
        );
        clearPolygons();
        return;
    }

    renderPolygons(snapshot.data);

    if (lastLookup?.latLng) {
        evaluateLookup(lastLookup.latLng, lastLookup.formattedAddress);
    }
}

function handleLookupSubmit(event) {
    event.preventDefault();

    const address = elements.lookupInput?.value.trim();
    if (!address) {
        renderLookupResult('warning', 'Enter an address', ['Add a street address to check it against the current outage polygons.']);
        return;
    }

    if (!mapsReady || !geocoder) {
        renderLookupResult('warning', 'Map still loading', ['Please wait for Google Maps to finish loading and try again.']);
        return;
    }

    if (!currentSnapshot?.data) {
        renderLookupResult('warning', 'Outage polygons unavailable', ['The outage feed has not loaded yet. Try your lookup again in a moment.']);
        return;
    }

    setLookupBusy(true);

    geocodeAddress(address)
        .then((result) => {
            const location = result.geometry.location;
            const latLng = location instanceof google.maps.LatLng
                ? location
                : new google.maps.LatLng(location.lat, location.lng);

            lastLookup = {
                formattedAddress: result.formatted_address,
                latLng
            };

            placeLookupMarker(latLng, result.formatted_address);
            evaluateLookup(latLng, result.formatted_address, { panToMarker: true });
        })
        .catch((error) => {
            renderLookupResult('warning', 'Address lookup failed', [error.message || 'We could not check that address right now.']);
        })
        .finally(() => {
            setLookupBusy(false);
        });
}

function handleResetMap() {
    hasFitBounds = false;
    renderMap(currentSnapshot);
}

function initializePage() {
    cacheElements();

    elements.lookupForm?.addEventListener('submit', handleLookupSubmit);
    elements.mapReset?.addEventListener('click', handleResetMap);

    subscribeToOutageFeed((snapshot) => {
        renderSummary(snapshot);
        renderMap(snapshot);
    });

    loadGoogleMaps()
        .then(() => {
            mapsReady = true;
            initMap();
            renderMap(currentSnapshot);
        })
        .catch((error) => {
            console.error(error);
            mapsLoadFailed = true;
            renderMap(currentSnapshot);
        });

    refreshOutageFeed({ background: true }).catch(() => {});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage, { once: true });
} else {
    initializePage();
}
