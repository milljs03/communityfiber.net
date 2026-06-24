/**
 * FiberCanvas — Animated fiber optic strands with traveling photons
 * Creates a premium hero background with glowing light particles flowing through fiber lines
 */

export default class FiberCanvas {
    constructor(canvasEl) {
        this.canvas = canvasEl;
        this.ctx = this.canvas.getContext('2d');
        this.strands = [];
        this.frameCount = 0;
        this.animationId = null;
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    init() {
        // Skip animation if user prefers reduced motion
        if (this.prefersReducedMotion) return;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.createStrands(12);
        this.animate();
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        // Redistribute strands when canvas resizes
        if (this.strands.length > 0) {
            this.strands = [];
            this.createStrands(12);
        }
    }

    createStrands(count) {
        for (let i = 0; i < count; i++) {
            this.strands.push(this.createStrand(i, count));
        }
    }

    createStrand(index, count) {
        const maxTrailLength = 280;
        const initialX = (index / count) * (this.canvas.width + maxTrailLength) - maxTrailLength;

        return {
            x: initialX,
            yBase: (Math.random() * 0.85 + 0.05) * this.canvas.height,
            y: 0,
            speed: 1.5 + Math.random() * 2.5,
            trailLength: 120 + Math.random() * 160,
            opacity: 0.3 + Math.random() * 0.6,
            sineOffset: Math.random() * Math.PI * 2,
            sineAmplitude: 2 + Math.random() * 4,
            sineFreq: 0.003 + Math.random() * 0.005,
        };
    }

    resetStrand(strand) {
        strand.x = -strand.trailLength;
        strand.yBase = (Math.random() * 0.85 + 0.05) * this.canvas.height;
        strand.speed = 1.5 + Math.random() * 2.5;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.strands.forEach(strand => {
            // Calculate undulating y position
            const yNow = strand.yBase + Math.sin(this.frameCount * strand.sineFreq + strand.sineOffset) * strand.sineAmplitude;
            strand.y = yNow;

            // Draw trail and photon
            this.drawTrail(strand);
            this.drawPhoton(strand);

            // Advance x position
            strand.x += strand.speed;

            // Reset when strand exits canvas
            if (strand.x > this.canvas.width + strand.trailLength) {
                this.resetStrand(strand);
            }
        });

        this.frameCount++;
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    drawTrail(strand) {
        const startX = Math.max(0, strand.x - strand.trailLength);
        const endX = strand.x;

        const gradient = this.ctx.createLinearGradient(startX, strand.y, endX, strand.y);
        gradient.addColorStop(0, `rgba(3, 166, 60, 0)`);
        gradient.addColorStop(0.5, `rgba(3, 166, 60, ${strand.opacity * 0.5})`);
        gradient.addColorStop(1, `rgba(3, 166, 60, ${strand.opacity})`);

        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(startX, strand.y);
        this.ctx.lineTo(endX, strand.y);
        this.ctx.stroke();
    }

    drawPhoton(strand) {
        const photonX = strand.x;
        const photonY = strand.y;
        const photonRadius = 8;

        // White core
        const coreGradient = this.ctx.createRadialGradient(photonX, photonY, 0, photonX, photonY, photonRadius);
        coreGradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        coreGradient.addColorStop(0.4, 'rgba(3, 166, 60, 0.8)');
        coreGradient.addColorStop(1, 'rgba(3, 166, 60, 0)');

        this.ctx.fillStyle = coreGradient;
        this.ctx.beginPath();
        this.ctx.arc(photonX, photonY, photonRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Outer glow halo
        const haloGradient = this.ctx.createRadialGradient(photonX, photonY, photonRadius, photonX, photonY, photonRadius * 2.5);
        haloGradient.addColorStop(0, `rgba(3, 166, 60, ${strand.opacity * 0.4})`);
        haloGradient.addColorStop(1, 'rgba(3, 166, 60, 0)');

        this.ctx.fillStyle = haloGradient;
        this.ctx.beginPath();
        this.ctx.arc(photonX, photonY, photonRadius * 2.5, 0, Math.PI * 2);
        this.ctx.fill();
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        window.removeEventListener('resize', () => this.resize());
    }
}
