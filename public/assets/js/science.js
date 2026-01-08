document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const startBtn = document.getElementById('start-race-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultsOverlay = document.getElementById('results-overlay');
    
    // Selects
    const oppSelect = document.getElementById('opponent-select');
    const originSelect = document.getElementById('origin-select');
    const destSelect = document.getElementById('dest-select');
    
    // Labels & Visuals
    const originLabel = document.getElementById('origin-label');
    const destLabel = document.getElementById('dest-label');
    const distanceBadge = document.getElementById('distance-display');
    const opponentLabel = document.getElementById('opponent-label');
    const copperSpeedDisplay = document.getElementById('copper-speed-display');
    
    const originVisual = document.querySelector('#origin-visual .visual-circle');
    const destVisual = document.querySelector('#dest-visual .visual-circle');
    
    // Racers
    const copperPacket = document.getElementById('copper');
    const fiberPacket = document.getElementById('fiber');
    const copperStatus = document.getElementById('copper-status');
    const fiberStatus = document.getElementById('fiber-status');

    if (!startBtn) {
        console.error("Critical: Start button not found. DOM might not be ready.");
        return;
    }

    // --- Configuration Data ---
    
    const SPEED_FIBER = 200000; // km/s
    
    const SPEEDS = {
        dialup: { kmps: 10, label: "0.05 Mbps" },
        dsl: { kmps: 500, label: "25 Mbps" },
        cable: { kmps: 2000, label: "300 Mbps" },
        satellite: { kmps: 1000, label: "50 Mbps (High Latency)" }
    };

    // Distances in km
    const DISTANCES = {
        indiana: 10,
        la: 4000,
        tokyo: 10000,
        moon: 384400,
        mars: 225000000
    };

    // Metadata for visuals (Icons)
    const LOCATION_META = {
        home: { name: "Your Home", icon: "fa-house" },
        nyc: { name: "New York Data Center", icon: "fa-server" },
        london: { name: "London, UK", icon: "fa-building-columns" },
        indiana: { name: "Neighbor", icon: "fa-user-group" },
        la: { name: "Los Angeles", icon: "fa-film" },
        tokyo: { name: "Tokyo", icon: "fa-torii-gate" },
        moon: { name: "The Moon", icon: "fa-moon" },
        mars: { name: "Mars", icon: "fa-rocket" }
    };

    // --- State ---
    let isRunning = false;

    // --- Event Listeners ---
    
    function updateUI() {
        if (!oppSelect || !originSelect || !destSelect) return;

        const opp = SPEEDS[oppSelect.value];
        const dist = DISTANCES[destSelect.value];
        const originKey = originSelect.value;
        const destKey = destSelect.value;
        const originData = LOCATION_META[originKey];
        const destData = LOCATION_META[destKey];

        // Text Updates
        if (opponentLabel) opponentLabel.textContent = oppSelect.options[oppSelect.selectedIndex].text.split('(')[0];
        if (copperSpeedDisplay) copperSpeedDisplay.textContent = opp.label;
        if (originLabel) originLabel.textContent = originData.name;
        if (destLabel) destLabel.textContent = destData.name;
        if (distanceBadge) distanceBadge.textContent = dist.toLocaleString() + " km";

        // Visual Updates (Icons)
        if(originVisual) originVisual.innerHTML = `<i class="fa-solid ${originData.icon}"></i>`;
        if(destVisual) destVisual.innerHTML = `<i class="fa-solid ${destData.icon}"></i>`;
    }

    if(oppSelect && originSelect && destSelect) {
        [oppSelect, originSelect, destSelect].forEach(el => el.addEventListener('change', updateUI));
        updateUI(); // Init
    }

    startBtn.addEventListener('click', runSimulation);
    if(resetBtn) resetBtn.addEventListener('click', resetSimulation);

    function runSimulation() {
        console.log("Run Simulation Clicked");
        if (isRunning) return;
        isRunning = true;
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Transmitting...';
        
        // Highlight active visuals
        if(originVisual) originVisual.classList.add('active');
        if(destVisual) destVisual.classList.add('active');

        const distance = DISTANCES[destSelect.value];
        const oppSpeed = SPEEDS[oppSelect.value].kmps;
        const oppName = oppSelect.options[oppSelect.selectedIndex].text.split('(')[0];
        
        // Physics Calc
        const fiberRealTime = distance / SPEED_FIBER;
        const copperRealTime = distance / oppSpeed;
        
        // Animation Duration
        const baseDuration = 1500; // ms
        const ratio = SPEED_FIBER / oppSpeed;
        let fiberAnimDuration = baseDuration;
        let copperAnimDuration = baseDuration * ratio;
        
        if (distance > 100000) fiberAnimDuration = 3000; // Space takes longer
        const maxVisualTime = 8000;
        if (copperAnimDuration > maxVisualTime) copperAnimDuration = maxVisualTime;

        // Reset
        copperPacket.style.transition = 'none';
        fiberPacket.style.transition = 'none';
        copperPacket.style.left = '0%';
        fiberPacket.style.left = '0%';
        
        // Force Reflow
        void copperPacket.offsetWidth;

        // Start
        fiberPacket.style.transition = `left ${fiberAnimDuration}ms linear`;
        fiberPacket.style.left = '100%';
        fiberStatus.textContent = "Transmitting...";
        
        copperPacket.style.transition = `left ${copperAnimDuration}ms linear`;
        copperPacket.style.left = '100%';
        copperStatus.textContent = "Buffering...";

        // Logic for Ping Pong vs One Way
        // Fiber will complete, Copper will attempt
        if (distance < 50000) {
            // For short distances, visual ping pong to emphasize speed
            fiberPacket.style.transition = `left 200ms linear`;
            const pingPong = setInterval(() => {
                if (!isRunning) { clearInterval(pingPong); return; }
                const currentLeft = fiberPacket.style.left === '100%' ? '0%' : '100%';
                fiberPacket.style.left = currentLeft;
            }, 200);
            
            setTimeout(() => {
                clearInterval(pingPong);
                finishSimulation(fiberRealTime, copperRealTime, oppName);
            }, copperAnimDuration);
        } else {
            setTimeout(() => {
                finishSimulation(fiberRealTime, copperRealTime, oppName);
            }, copperAnimDuration);
        }
    }

    function finishSimulation(fTime, cTime, oppName) {
        isRunning = false;
        
        document.getElementById('fiber-result-time').textContent = formatTime(fTime);
        document.getElementById('opp-result-name').textContent = oppName;
        document.getElementById('opp-result-time').textContent = formatTime(cTime);
        
        // Calculate Efficiency %
        // If Fiber takes 1s and Copper takes 10s, Fiber is 1000% faster (10x) or 900% more efficient
        // (cTime / fTime) * 100 = Percentage of speed
        const efficiency = Math.round((cTime / fTime) * 100);
        
        const msg = `Traditional ${oppName} would have taken <strong>${formatTime(cTime)}</strong> of time, fiber is <strong>${efficiency.toLocaleString()}%</strong> more efficient and quicker.`;
        
        document.getElementById('analysis-text').innerHTML = msg;

        if (resultsOverlay) {
            resultsOverlay.classList.remove('hidden');
            resultsOverlay.classList.add('active');
        }
        
        startBtn.innerHTML = 'INITIATE TRANSMISSION';
        startBtn.disabled = false;
        copperStatus.textContent = "Complete";
        fiberStatus.textContent = "Complete";
        
        if(originVisual) originVisual.classList.remove('active');
        if(destVisual) destVisual.classList.remove('active');
    }

    function resetSimulation() {
        if (resultsOverlay) resultsOverlay.classList.remove('active');
        setTimeout(() => {
            if (resultsOverlay) resultsOverlay.classList.add('hidden');
            copperPacket.style.transition = 'none';
            fiberPacket.style.transition = 'none';
            copperPacket.style.left = '0%';
            fiberPacket.style.left = '0%';
            copperStatus.textContent = "Ready";
            fiberStatus.textContent = "Ready";
        }, 300);
    }

    function formatTime(sec) {
        if (sec < 0.001) return (sec * 1000000).toFixed(0) + " μs";
        if (sec < 1) return (sec * 1000).toFixed(0) + " ms";
        if (sec > 60) return (sec / 60).toFixed(1) + " min";
        return sec.toFixed(3) + " s";
    }
});