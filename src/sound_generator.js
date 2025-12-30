import * as THREE from '../three.min.js';

export class SoundGenerator {
    constructor(listener) {
        this.listener = listener;
        this.context = listener.context;
    }

    createBuffer(duration, callback) {
        const sampleRate = this.context.sampleRate;
        const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        callback(data, sampleRate);
        return buffer;
    }

    getRainBuffer() {
        // Pink Noise (1/f) is much better for rain than White Noise
        return this.createBuffer(10.0, (data, sr) => {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            
            for (let i = 0; i < data.length; i++) {
                const white = Math.random() * 2 - 1;
                
                // Paul Kellett's refined method for Pink Noise generation
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                b6 = white * 0.115926;
                
                // Base rain sound (lower volume)
                data[i] = pink * 0.05; 

                // Distant Thunder (at ~4 seconds)
                if (i > 4 * sr && i < 8 * sr) {
                    const t = (i - 4 * sr) / sr;
                    // Slower envelope for distant thunder
                    const env = Math.max(0, Math.sin(t * 0.8) * Math.exp(-t * 0.5)); 
                    
                    // Low frequency rumble (filtered white noise)
                    const rumble = (Math.random() * 2 - 1) * env * 0.4;
                    data[i] += rumble; 
                }
            }
        });
    }

    getHeartbeatBuffer() {
        // Low thud
        return this.createBuffer(0.2, (data, sr) => {
            for (let i = 0; i < data.length; i++) {
                const t = i / sr;
                const freq = 60 * Math.exp(-15 * t); // Pitch drop
                data[i] = Math.sin(2 * Math.PI * freq * t);
                data[i] *= Math.exp(-10 * t); // Decay
            }
        });
    }

    getSwitchBuffer() {
        // Click/Snap
        return this.createBuffer(0.1, (data, sr) => {
            for (let i = 0; i < data.length; i++) {
                const t = i / sr;
                // Square wave burst
                data[i] = (Math.sin(2 * Math.PI * 400 * t) > 0 ? 0.5 : -0.5) * Math.exp(-50 * t);
            }
        });
    }

    getPickupBuffer() {
        // Coin sound (two tones)
        return this.createBuffer(0.4, (data, sr) => {
            for (let i = 0; i < data.length; i++) {
                const t = i / sr;
                let freq = t < 0.1 ? 900 : 1400; // B5 -> F#6 approx
                if (t > 0.1 && t < 0.12) freq = 0; // Gap
                
                // Square-ish wave
                const val = Math.sin(2 * Math.PI * freq * t);
                data[i] = (val > 0 ? 0.3 : -0.3) * (1 - t/0.4);
            }
        });
    }

    getGhostBuffer() {
        // Eerie drone (FM Synthesis)
        return this.createBuffer(2.0, (data, sr) => {
            for (let i = 0; i < data.length; i++) {
                const t = i / sr;
                const mod = Math.sin(2 * Math.PI * 5 * t) * 20; // 5Hz vibrato
                const carrier = Math.sin(2 * Math.PI * (150 + mod) * t);
                // Add some high frequency dissonance
                const diss = Math.sin(2 * Math.PI * (157 + mod) * t) * 0.5;
                data[i] = (carrier + diss) * 0.3;
            }
        });
    }
}
