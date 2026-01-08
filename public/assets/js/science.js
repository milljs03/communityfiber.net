document.addEventListener('DOMContentLoaded', () => {
    
    // --- PAYLOAD DEFINITIONS (Shared) ---
    const PAYLOADS = {
        ping: { name: "Standard Ping", sizeMB: 0, desc: "Latency Check" },
        apollo: { name: "Apollo 11 Code", sizeMB: 2, desc: "Complete source code for the Lunar Module." },
        music: { name: "High-Res Album", sizeMB: 1024, desc: "Uncompressed Studio Quality Audio." },
        shrek: { name: "4K Movie", sizeMB: 50000, desc: "Approximately 50GB of high-definition video." },
        game: { name: "Video Game", sizeMB: 150000, desc: "A massive modern open-world game install." },
        backup: { name: "Cloud Backup", sizeMB: 1000000, desc: "Full system backup for a workstation." },
        library: { name: "Library of Congress", sizeMB: 20000000, desc: "The entire print collection digitized (approx 20TB)." }
    };

    // --- LANDMARKS ---
    const LANDMARKS = [
        { name: "Eiffel Tower", lat: 48.8584, lng: 2.2945, icon: "fa-monument" },
        { name: "Great Wall of China", lat: 40.4319, lng: 116.5704, icon: "fa-dungeon" },
        { name: "Jesus' Birthplace (Bethlehem)", lat: 31.7054, lng: 35.2024, icon: "fa-star" },
        { name: "Pyramids of Giza", lat: 29.9792, lng: 31.1342, icon: "fa-caret-up" },
        { name: "Statue of Liberty", lat: 40.6892, lng: -74.0445, icon: "fa-fire" },
        { name: "Taj Mahal", lat: 27.1751, lng: 78.0421, icon: "fa-place-of-worship" },
        { name: "Sydney Opera House", lat: -33.8568, lng: 151.2153, icon: "fa-music" },
        { name: "Machu Picchu", lat: -13.1631, lng: -72.5450, icon: "fa-mountain" },
        { name: "Colosseum", lat: 41.8902, lng: 12.4922, icon: "fa-landmark" }
    ];

    // --- TAB NAVIGATION ---
    const tabs = document.querySelectorAll('.museum-tab');
    const sections = document.querySelectorAll('.exhibit-section');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            if(targetId === 'exhibit-speed') {
                setTimeout(() => { initMap(); }, 100);
            }
            if(targetId === 'exhibit-reflection') {
                initTIRCanvas();
            }
        });
    });


    // ============================================
    // EXHIBIT A: GLOBAL PING MAP
    // ============================================
    let map = null;
    let selectedDest = null;
    let mapInitialized = false;

    function initMap() {
        if(mapInitialized) {
             if(map) map.invalidateSize();
             return;
        }
        if(typeof L === 'undefined') return;

        const originLat = 41.5014;
        const originLng = -85.8306;
        
        map = L.map('fiber-map', {
            center: [20, 0], // Center map globally
            zoom: 2,
            minZoom: 2,
            maxZoom: 10,
            zoomControl: true,
            attributionControl: false
        });
        mapInitialized = true;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            className: 'mixed-mode-tiles'
        }).addTo(map);

        const hqIcon = L.divIcon({ className: 'hq-marker', html: '<i class="fa-solid fa-server" style="color:#22d3ee; font-size:24px; text-shadow:0 0 10px #22d3ee;"></i>', iconSize: [24, 24], iconAnchor: [12, 12] });
        const destIcon = L.divIcon({ className: 'dest-marker', html: '<i class="fa-solid fa-location-dot" style="color:#ef4444; font-size:24px; text-shadow:0 0 10px #ef4444;"></i>', iconSize: [24, 24], iconAnchor: [12, 24] });

        L.marker([originLat, originLng], {icon: hqIcon}).addTo(map)
            .bindPopup("<b>Community Fiber HQ</b><br>New Paris, IN").openPopup();

        LANDMARKS.forEach(lm => {
            const icon = L.divIcon({
                className: 'landmark-marker',
                html: `<i class="fa-solid ${lm.icon}" style="color:#f59e0b; font-size:20px; text-shadow:0 0 5px #000;"></i>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            const marker = L.marker([lm.lat, lm.lng], {icon: icon}).addTo(map);
            marker.bindTooltip(lm.name, { direction: 'top', offset: [0, -10], className: 'landmark-tooltip' });
            marker.on('click', () => { selectLocation(lm.lat, lm.lng, lm.name); });
        });

        let connectionLine = null;
        let destMarker = null;
        let pulseMarker = null;
        let animationFrameId = null;

        map.on('click', (e) => { selectLocation(e.latlng.lat, e.latlng.lng, "Selected Coordinates"); });

        function selectLocation(lat, lng, name) {
            if(animationFrameId) cancelAnimationFrame(animationFrameId);
            if(pulseMarker) map.removeLayer(pulseMarker);
            pulseMarker = null;
            
            selectedDest = { lat: lat, lng: lng };
            document.getElementById('target-coords').innerHTML = name === "Selected Coordinates" ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : `<strong>${name}</strong>`;

            if(connectionLine) map.removeLayer(connectionLine);
            if(destMarker) map.removeLayer(destMarker);
            destMarker = L.marker([lat, lng], {icon: destIcon}).addTo(map);
            
            const fireBtn = document.getElementById('fire-signal-btn');
            fireBtn.disabled = false;
            fireBtn.innerHTML = "FIRE SIGNAL";
            fireBtn.style.cursor = "pointer";
            document.getElementById('sim-status').textContent = "Target locked. Select payload and fire.";
            document.getElementById('inline-results').classList.add('hidden');
        }

        const fireBtn = document.getElementById('fire-signal-btn');
        if(fireBtn) {
            fireBtn.addEventListener('click', () => {
                if(!selectedDest) return;
                const R = 6371; 
                const dLat = (selectedDest.lat - originLat) * Math.PI / 180;
                const dLng = (selectedDest.lng - originLng) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(originLat * Math.PI / 180) * Math.cos(selectedDest.lat * Math.PI / 180) * Math.sin(dLng/2) * Math.sin(dLng/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const distanceKm = R * c;
                const speedOfLightFiber = 200000; 
                const timeSeconds = distanceKm / speedOfLightFiber;
                const timeMs = timeSeconds * 1000;

                if(connectionLine) map.removeLayer(connectionLine);
                connectionLine = L.polyline([[originLat, originLng], [selectedDest.lat, selectedDest.lng]], {
                    color: '#38bdf8', weight: 3, opacity: 0.6, dashArray: '5, 10'
                }).addTo(map);

                if(pulseMarker) map.removeLayer(pulseMarker);
                pulseMarker = L.circleMarker([originLat, originLng], { radius: 8, color: '#fff', fillColor: '#38bdf8', fillOpacity: 1 }).addTo(map);

                const duration = Math.max(timeMs, 100); 
                function loopAnimation() {
                    let start = performance.now();
                    function animate(time) {
                        let timeFraction = (time - start) / duration;
                        if (timeFraction > 1) { timeFraction = 0; start = performance.now(); }
                        const curLat = originLat + (selectedDest.lat - originLat) * timeFraction;
                        const curLng = originLng + (selectedDest.lng - originLng) * timeFraction;
                        pulseMarker.setLatLng([curLat, curLng]);
                        animationFrameId = requestAnimationFrame(animate);
                    }
                    animationFrameId = requestAnimationFrame(animate);
                }
                loopAnimation();
                finishSimulation(distanceKm, timeMs);
            });
        }

        function finishSimulation(dist, ms) {
            const payloadKey = document.getElementById('payload-select').value;
            const payload = PAYLOADS[payloadKey];
            showSidebarResults(dist, ms, payload);
            const fireBtn = document.getElementById('fire-signal-btn');
            fireBtn.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> TRANSMITTING...';
            fireBtn.disabled = true;
            document.getElementById('sim-status').textContent = "Link established. Data streaming active.";
        }
    }

    function showSidebarResults(dist, ms, payload) {
        const resBox = document.getElementById('inline-results');
        resBox.classList.remove('hidden');
        document.getElementById('map-time').textContent = ms.toFixed(3) + " ms";
        const title = document.getElementById('payload-title');
        const analysis = document.getElementById('map-analysis');

        let transferTimeSec = 0;
        if(payload.sizeMB > 0) {
            const megabits = payload.sizeMB * 8;
            transferTimeSec = megabits / 1000; 
        }

        if (payload.sizeMB === 0) {
            title.innerHTML = `<i class="fa-solid fa-wifi"></i> Ping Analysis`;
            analysis.innerHTML = `Signal distance: <strong>${Math.round(dist).toLocaleString()} km</strong>.<br>Latency is effectively instantaneous.`;
        } else {
            let timeStr = formatDuration(transferTimeSec);
            title.innerHTML = `<i class="fa-solid fa-box-open"></i> ${payload.name} Analysis`;
            analysis.innerHTML = `
                Distance: <strong>${Math.round(dist).toLocaleString()} km</strong><br>
                Transfer Time (1 Gbps): <strong style="color:#38bdf8">${timeStr}</strong><br>
                <span style="font-size:0.8em; color:#94a3b8">(Vs Copper: ${formatDuration(transferTimeSec * 20)})</span>
            `;
        }
    }


    // ============================================
    // EXHIBIT B: TOTAL INTERNAL REFLECTION
    // ============================================
    const canvas = document.getElementById('tir-canvas');
    const angleSlider = document.getElementById('angle-slider');
    let ctx = canvas ? canvas.getContext('2d') : null;

    function initTIRCanvas() {
        if(!canvas) return;
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        drawTIR();
    }

    if(angleSlider && canvas) {
        angleSlider.addEventListener('input', () => {
            document.getElementById('angle-val').textContent = angleSlider.value;
            drawTIR();
        });
        window.addEventListener('resize', initTIRCanvas);
    }

    function drawTIR() {
        if(!ctx) return;
        const w = canvas.width; const h = canvas.height;
        const angleDeg = parseInt(angleSlider.value);
        const criticalAngle = 20; const escapes = angleDeg > 42;

        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h);
        const coreH = 100; const coreY = (h - coreH) / 2;
        
        ctx.fillStyle = 'rgba(30, 41, 59, 0.5)'; ctx.fillRect(0, 0, w, coreY); ctx.fillRect(0, coreY + coreH, w, coreY);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)'; ctx.fillRect(0, coreY, w, coreH);
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1; 
        ctx.beginPath(); ctx.moveTo(0, coreY); ctx.lineTo(w, coreY); ctx.moveTo(0, coreY + coreH); ctx.lineTo(w, coreY + coreH); ctx.stroke();

        ctx.strokeStyle = escapes ? '#ef4444' : '#22c55e'; ctx.lineWidth = 3; ctx.shadowBlur = 10; ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath();
        let startX = 0; let startY = h / 2; ctx.moveTo(startX, startY);

        const rad = angleDeg * (Math.PI / 180);
        let dx = Math.cos(rad) * 10; let dy = Math.sin(rad) * 10;
        let cx = startX; let cy = startY; let bounces = 0;

        for(let i=0; i<200; i++) {
            cx += dx; cy -= dy;
            if (cy <= coreY) {
                if(escapes && bounces === 0) { cx += dx * 5; cy -= dy * 5; ctx.lineTo(cx, cy); break; } 
                else { cy = coreY; dy = -dy; bounces++; }
            }
            if (cy >= coreY + coreH) {
                if(escapes && bounces === 0) { cx += dx * 5; cy -= dy * 5; ctx.lineTo(cx, cy); break; }
                else { cy = coreY + coreH; dy = -dy; bounces++; }
            }
            ctx.lineTo(cx, cy);
            if(cx > w) break;
        }
        ctx.stroke(); ctx.shadowBlur = 0;
        const sl = document.getElementById('reflection-status');
        if (escapes) { sl.textContent = "SIGNAL LOSS (Refraction)"; sl.style.color = "#ef4444"; }
        else { sl.textContent = "SIGNAL TRAPPED (Reflection)"; sl.style.color = "#22c55e"; }
    }


    // ============================================
    // EXHIBIT C: CAPACITY
    // ============================================
    const capSelect = document.getElementById('capacity-payload-select');
    const capBtn = document.getElementById('start-capacity-btn');
    const capSizeDisplay = document.getElementById('cap-file-size');
    const capTimeFiber = document.getElementById('cap-est-time');
    const capTimeCopper = document.getElementById('cap-est-copper');

    function updateCapacityReadout() {
        if(!capSelect) return;
        const key = capSelect.value;
        const payload = PAYLOADS[key];
        
        let sizeStr = payload.sizeMB + " MB";
        if(payload.sizeMB >= 1000) sizeStr = (payload.sizeMB/1000).toFixed(1) + " GB";
        if(payload.sizeMB >= 1000000) sizeStr = (payload.sizeMB/1000000).toFixed(1) + " TB";
        capSizeDisplay.textContent = sizeStr;

        const mb = payload.sizeMB * 8; 
        const secFiber = mb / 1000;
        const secCopper = mb / 50;
        capTimeFiber.textContent = formatDuration(secFiber);
        capTimeCopper.textContent = formatDuration(secCopper);
    }
    if(capSelect) { capSelect.addEventListener('change', updateCapacityReadout); updateCapacityReadout(); }

    if(capBtn) {
        capBtn.addEventListener('click', () => {
            if(capBtn.disabled) return;
            capBtn.disabled = true;

            const copperBar = document.getElementById('copper-progress');
            const fiberBar = document.getElementById('fiber-progress');
            const copperText = document.getElementById('copper-text');
            const fiberText = document.getElementById('fiber-text');
            const copperPart = document.getElementById('copper-particles');
            const fiberPart = document.getElementById('fiber-particles');

            copperBar.style.width = '0%'; fiberBar.style.width = '0%';
            copperText.textContent = '0%'; fiberText.textContent = '0%';
            copperPart.classList.add('animating-copper');
            fiberPart.classList.add('animating-fiber');
            
            const key = capSelect.value;
            const payload = PAYLOADS[key];
            const sizeMB = payload.sizeMB;
            
            let fiberStep = 0; let copperStep = 0;
            if (sizeMB < 100) { fiberStep = 100; copperStep = 20; } 
            else if (sizeMB < 50000) { fiberStep = 4; copperStep = 0.2; } 
            else { fiberStep = 1; copperStep = 0.05; }

            let fiberProg = 0; let copperProg = 0;
            const interval = setInterval(() => {
                if(fiberProg < 100) { fiberProg += fiberStep; if(fiberProg > 100) fiberProg = 100; fiberBar.style.width = fiberProg + '%'; fiberText.textContent = Math.floor(fiberProg) + '%'; }
                if(copperProg < 100) { copperProg += copperStep; if(copperProg > 100) copperProg = 100; copperBar.style.width = copperProg + '%'; copperText.textContent = copperProg.toFixed(1) + '%'; }
                if(fiberProg >= 100 && fiberPart.classList.contains('animating-fiber')) {
                    fiberPart.classList.remove('animating-fiber');
                    fiberText.textContent = "DONE"; fiberText.style.color = "#38bdf8"; fiberText.style.fontWeight = "bold";
                }
            }, 30);

            setTimeout(() => {
                capBtn.disabled = false; capBtn.innerHTML = "Restart Transfer";
                clearInterval(interval);
                copperPart.classList.remove('animating-copper');
                if(copperProg < 100) copperText.textContent = "Still downloading...";
            }, 8000);
        });
    }

    // ============================================
    // EXHIBIT D: RAINBOW HIGHWAY (WDM)
    // ============================================
    const wdmState = { red: true, green: false, blue: false };
    const btnRed = document.getElementById('btn-ch-red');
    const btnGreen = document.getElementById('btn-ch-green');
    const btnBlue = document.getElementById('btn-ch-blue');
    
    function updateWDM() {
        const activeCount = (wdmState.red?1:0) + (wdmState.green?1:0) + (wdmState.blue?1:0);
        document.getElementById('wdm-active-count').textContent = activeCount;
        document.getElementById('wdm-total-speed').textContent = (activeCount * 10) + " Gbps";
        
        // Update Lasers
        document.getElementById('laser-red').classList.toggle('active', wdmState.red);
        document.getElementById('laser-green').classList.toggle('active', wdmState.green);
        document.getElementById('laser-blue').classList.toggle('active', wdmState.blue);
        
        // Update Sensors
        document.getElementById('sensor-red').classList.toggle('active', wdmState.red);
        document.getElementById('sensor-green').classList.toggle('active', wdmState.green);
        document.getElementById('sensor-blue').classList.toggle('active', wdmState.blue);

        // Update Buttons
        if(btnRed) btnRed.classList.toggle('active', wdmState.red);
        if(btnGreen) btnGreen.classList.toggle('active', wdmState.green);
        if(btnBlue) btnBlue.classList.toggle('active', wdmState.blue);

        // Update Main Beam
        const beam = document.getElementById('main-beam');
        if(beam) {
            let colors = [];
            if(wdmState.red) colors.push('#ef4444');
            if(wdmState.green) colors.push('#22c55e');
            if(wdmState.blue) colors.push('#3b82f6');
            
            if(colors.length === 0) {
                beam.style.background = 'transparent';
                beam.style.boxShadow = 'none';
            } else if (colors.length === 3) {
                beam.style.background = 'white'; // Mixed
                beam.style.boxShadow = '0 0 20px white';
            } else {
                beam.style.background = `linear-gradient(to bottom, ${colors.join(', ')})`;
                beam.style.boxShadow = `0 0 15px ${colors[0]}`;
            }
        }
    }

    if(btnRed) btnRed.addEventListener('click', () => { wdmState.red = !wdmState.red; updateWDM(); });
    if(btnGreen) btnGreen.addEventListener('click', () => { wdmState.green = !wdmState.green; updateWDM(); });
    if(btnBlue) btnBlue.addEventListener('click', () => { wdmState.blue = !wdmState.blue; updateWDM(); });
    
    // Initial WDM update
    if(document.getElementById('wdm-container')) updateWDM();


    // ============================================
    // EXHIBIT E: SATELLITE VS FIBER
    // ============================================
    const btnSat = document.getElementById('start-sat-race');
    
    if(btnSat) {
        btnSat.addEventListener('click', () => {
            btnSat.disabled = true;
            btnSat.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pinging...';
            
            const dotFiber = document.getElementById('dot-fiber');
            const dotSat = document.getElementById('dot-sat');
            const trajectory = document.getElementById('sat-trajectory');
            const satResults = document.getElementById('sat-results');

            satResults.classList.add('hidden');

            // Fiber Animation (Linear along bottom)
            dotFiber.style.transition = 'none';
            dotFiber.style.left = '15%';
            setTimeout(() => {
                dotFiber.style.transition = 'left 1s linear';
                dotFiber.style.left = '85%';
            }, 50);

            // Satellite Animation (Along SVG path)
            // Simulating slower travel
            let start = null; // Initialize start as null
            let duration = 3000; // 3 seconds (3x slower than fiber visually)
            
            // Show dot
            dotSat.style.opacity = '1';

            function animateSat(time) {
                if (!start) start = time; // Set start time on first frame
                let p = (time - start) / duration;
                if(p > 1) p = 1;
                
                // Get point on curve
                const length = trajectory.getTotalLength();
                const point = trajectory.getPointAtLength(p * length);
                
                dotSat.setAttribute('cx', point.x);
                dotSat.setAttribute('cy', point.y);

                if(p < 1) {
                    requestAnimationFrame(animateSat);
                } else {
                    finishSatRace();
                }
            }
            requestAnimationFrame(animateSat);

            function finishSatRace() {
                satResults.classList.remove('hidden');
                document.getElementById('sat-fiber-time').textContent = '28 ms';
                document.getElementById('sat-space-time').textContent = '240 ms';
                btnSat.disabled = false;
                btnSat.textContent = 'Ping Again';
                dotSat.style.opacity = '0';
            }
        });
    }

    // Helper
    function formatDuration(sec) {
        if(sec < 0.1) return "Instant";
        if(sec < 1) return (sec*1000).toFixed(0) + " ms";
        if(sec < 60) return sec.toFixed(1) + " s";
        if(sec < 3600) return (sec/60).toFixed(1) + " min";
        if(sec < 86400) return (sec/3600).toFixed(1) + " hrs";
        return (sec/86400).toFixed(1) + " days";
    }

    // Auto-init active tab
    if(document.querySelector('.museum-tab.active')?.getAttribute('data-target') === 'exhibit-speed') {
        initMap();
    }
});