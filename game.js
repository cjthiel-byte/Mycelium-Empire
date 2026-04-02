// ═══════════════════════════════════════════════════════════════
//  FIREBASE CONFIG
//  ──────────────────────────────────────────────────────────────
//  HOW TO SET UP (do this once, takes ~5 minutes):
//
//  1. Go to https://console.firebase.google.com
//  2. Click "Add project", name it "mycelium-empire", click through
//  3. In the left sidebar: Authentication → Get Started → Email/Password → Enable → Save
//  4. In the left sidebar: Firestore Database → Create database
//     → Start in production mode → choose a region → Done
//  5. Firestore → Rules tab → paste these rules and Publish:
//
//       rules_version = '2';
//       service cloud.firestore {
//         match /databases/{database}/documents {
//           match /usernames/{username} {
//             allow read: if true;
//             allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
//             allow update, delete: if false;
//           }
//           match /saves/{uid} {
//             allow read, write: if request.auth != null && request.auth.uid == uid;
//           }
//         }
//       }
//
//  6. In the left sidebar: Project Settings (gear icon) → Your apps
//     → Add app → Web (</>) → Register → copy the config below
//  7. Replace the placeholder values below with your real config
//  8. Deploy to GitHub Pages — done!
//
//  COST: The free Spark tier allows 50k reads/day and 20k writes/day,
//  which is more than enough for a personal game.
// ═══════════════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyCocKRFLys1ezSIVah5jYyB-VDVbCZLjl4',
    authDomain: 'mycelium-empire-43c91.firebaseapp.com',
    projectId: 'mycelium-empire-43c91',
    storageBucket: 'mycelium-empire-43c91.firebasestorage.app',
    messagingSenderId: '248159755470',
    appId: '1:248159755470:web:6b04f6bf5e6c644402849f',
};

// Set to true after filling in the config above
const FIREBASE_CONFIGURED = true;

let auth = null, db = null, currentUser = null, currentUsername = '';

function initFirebase() {
    if (!FIREBASE_CONFIGURED) return;
    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();
        // Persist session across browser closes
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        auth.onAuthStateChanged(user => {
            currentUser = user;
            if (user) {
                // Username is stored on the Auth profile displayName — no extra Firestore read needed
                currentUsername = user.displayName || '';
                updateProfileUI(true);
                loadFromCloud(true);  // always load cloud save on login
            } else {
                currentUsername = '';
                updateProfileUI(false);
            }
        });
    } catch (e) { console.warn('Firebase init failed', e); }
}

// ═══════════════════════════════════════
//  PRODUCERS
// ═══════════════════════════════════════
const PRODUCERS_DEF = [
    { id: 'threads', name: 'Mycelium Threads', emoji: '🕸', desc: 'Passive rot spreads through organic matter.', baseCost: 15, baseSps: 0.1 },
    { id: 'fruiting', name: 'Fruiting Bodies', emoji: '🍄', desc: 'Mushrooms shed spores automatically.', baseCost: 100, baseSps: 0.5 },
    { id: 'woodweb', name: 'Wood Wide Web', emoji: '🌳', desc: 'Tap into living tree root networks.', baseCost: 600, baseSps: 3 },
    { id: 'sporestorm', name: 'Spore Storm', emoji: '💨', desc: 'Spore clouds colonise distant regions.', baseCost: 3000, baseSps: 12 },
    { id: 'undercity', name: 'Underground City', emoji: '🏙', desc: 'Sentient mycelial infrastructure hums below.', baseCost: 15000, baseSps: 50 },
    { id: 'cordyceps', name: 'Cordyceps Protocol', emoji: '🐜', desc: 'Insects carry your spores across the land.', baseCost: 75000, baseSps: 200 },
    { id: 'planetary', name: 'Planetary Mycelium', emoji: '🌍', desc: 'Your network wraps the entire globe.', baseCost: 500000, baseSps: 900 },
    { id: 'voidspore', name: 'Void Spore', emoji: '🌌', desc: 'Spores drift through dimensions beyond knowing.', baseCost: 4000000, baseSps: 4500 },
    { id: 'lichenveil', name: 'Lichen Veil', emoji: '🪨', desc: 'A skin of lichen spreads across stone and bark.', baseCost: 30000000, baseSps: 22000 },
    { id: 'dreamweb', name: 'Dream Mycelium', emoji: '💤', desc: 'Your network enters the dreaming layer beneath thought.', baseCost: 250000000, baseSps: 100000 },
    { id: 'satellite', name: 'Spore Satellite', emoji: '🛰', desc: 'Orbital platforms blanket the atmosphere in spores.', baseCost: 2e9, baseSps: 500000 },
    { id: 'crystal', name: 'Hivemind Crystal', emoji: '💎', desc: 'Crystallised mycelium acts as a living supercomputer.', baseCost: 1.5e10, baseSps: 2500000 },
    { id: 'rootsing', name: 'Root Singularity', emoji: '🌐', desc: 'All root systems on Earth merge into one vast mind.', baseCost: 1.2e11, baseSps: 12000000 },
    { id: 'temporal', name: 'Temporal Thread', emoji: '⌛', desc: 'Threads reach backward and forward through time.', baseCost: 1e12, baseSps: 60000000 },
    { id: 'stellar', name: 'Stellar Mycelium', emoji: '⭐', desc: 'Spores travel between star systems on solar winds.', baseCost: 9e12, baseSps: 300000000 },
    { id: 'consciousness', name: 'Consciousness Web', emoji: '🧠', desc: 'The network becomes the substrate of all thought.', baseCost: 8e13, baseSps: 1500000000 },
    { id: 'dimensional', name: 'Dimensional Rot', emoji: '🌀', desc: 'Your decay spreads across parallel dimensions.', baseCost: 7e14, baseSps: 8000000000 },
    { id: 'eternalspore', name: 'The Eternal Spore', emoji: '♾', desc: 'There is no end. There was no beginning. Only growth.', baseCost: 7e15, baseSps: 40000000000 },
    { id: 'galactic', name: 'Galactic Lattice', emoji: '🌠', desc: 'A crystalline lattice spans entire galaxy clusters.', baseCost: 8e16, baseSps: 200000000000 },
    { id: 'absolute', name: 'The Absolute', emoji: '🔮', desc: 'Beyond dimension. Beyond time. The final rot.', baseCost: 7e17, baseSps: 1e12 },
];

// ═══════════════════════════════════════
//  UPGRADES
// ═══════════════════════════════════════
const UPGRADES_DEF = [
    { id: 'pulse_unlock', tier: 'hivemind', name: 'Hivemind Awakening', desc: 'Unlock the Hivemind Pulse. Clicking now charges a burst that releases massive spores.', cost: 250, req: s => s.totalEarned >= 100, apply: s => { s.hivemindUnlocked = true; } },
    { id: 'u1', tier: 'threads', name: 'Chitin Filaments', desc: 'Threads 2× more efficient.', cost: 150, req: s => p(s, 'threads').owned >= 5, apply: s => mp(s, 'threads', 2) },
    { id: 'u1b', tier: 'threads', name: 'Hyphal Weave', desc: 'Threads 3× more efficient.', cost: 2500, req: s => p(s, 'threads').owned >= 25, apply: s => mp(s, 'threads', 3) },
    { id: 'u1c', tier: 'threads', name: 'Neural Filaments', desc: 'Threads 5× more efficient.', cost: 50000, req: s => p(s, 'threads').owned >= 100, apply: s => mp(s, 'threads', 5) },
    { id: 'u2', tier: 'fruiting', name: 'Spore Coating', desc: 'Fruiting Bodies 2× output.', cost: 800, req: s => p(s, 'fruiting').owned >= 5, apply: s => mp(s, 'fruiting', 2) },
    { id: 'u2b', tier: 'fruiting', name: 'Myco-Bloom', desc: 'Fruiting Bodies 3× output.', cost: 12000, req: s => p(s, 'fruiting').owned >= 25, apply: s => mp(s, 'fruiting', 3) },
    { id: 'u2c', tier: 'fruiting', name: 'Spore Eruption', desc: 'Fruiting Bodies 5× output.', cost: 300000, req: s => p(s, 'fruiting').owned >= 100, apply: s => mp(s, 'fruiting', 5) },
    { id: 'u3', tier: 'click', name: 'Bioluminescence', desc: 'Clicks give 2× more spores.', cost: 500, req: s => s.totalEarned >= 200, apply: s => { s.sporesPerClick *= 2; } },
    { id: 'u3b', tier: 'click', name: 'Phosphor Touch', desc: 'Clicks give 5× more spores.', cost: 25000, req: s => s.totalEarned >= 10000, apply: s => { s.sporesPerClick *= 5; } },
    { id: 'u3c', tier: 'click', name: 'Quantum Entanglement', desc: 'Clicks give 10× more spores.', cost: 500000, req: s => s.totalEarned >= 200000, apply: s => { s.sporesPerClick *= 10; } },
    { id: 'u3d', tier: 'click', name: 'Temporal Click', desc: 'Clicks give 25× more spores.', cost: 5e7, req: s => s.totalEarned >= 1e7, apply: s => { s.sporesPerClick *= 25; } },
    { id: 'u4', tier: 'woodweb', name: 'Mycorrhizal Boost', desc: 'Wood Wide Web 3× yield.', cost: 5000, req: s => p(s, 'woodweb').owned >= 3, apply: s => mp(s, 'woodweb', 3) },
    { id: 'u4b', tier: 'woodweb', name: 'Ancient Grove Pact', desc: 'Wood Wide Web 5× yield.', cost: 80000, req: s => p(s, 'woodweb').owned >= 15, apply: s => mp(s, 'woodweb', 5) },
    { id: 'u4c', tier: 'woodweb', name: 'Planetary Root Tap', desc: 'Wood Wide Web 8× yield.', cost: 2e6, req: s => p(s, 'woodweb').owned >= 50, apply: s => mp(s, 'woodweb', 8) },
    { id: 'u6', tier: 'storm', name: 'Jet Stream Riders', desc: 'Spore Storms 4× more effective.', cost: 20000, req: s => p(s, 'sporestorm').owned >= 5, apply: s => mp(s, 'sporestorm', 4) },
    { id: 'u6b', tier: 'storm', name: 'Atmospheric Seeding', desc: 'Spore Storms 6× more effective.', cost: 500000, req: s => p(s, 'sporestorm').owned >= 25, apply: s => mp(s, 'sporestorm', 6) },
    { id: 'u7', tier: 'cordyceps', name: 'Colony Integration', desc: 'Cordyceps Protocol 5× more.', cost: 300000, req: s => p(s, 'cordyceps').owned >= 5, apply: s => mp(s, 'cordyceps', 5) },
    { id: 'u7b', tier: 'cordyceps', name: 'Hivemind Ants', desc: 'Cordyceps Protocol 8× more.', cost: 8e6, req: s => p(s, 'cordyceps').owned >= 20, apply: s => mp(s, 'cordyceps', 8) },
    { id: 'u8', tier: 'planetary', name: 'Global Fungal Layer', desc: 'Planetary Mycelium 4× more.', cost: 3e6, req: s => p(s, 'planetary').owned >= 3, apply: s => mp(s, 'planetary', 4) },
    { id: 'u8b', tier: 'planetary', name: 'Geomagnetic Weave', desc: 'Planetary Mycelium 7× more.', cost: 6e7, req: s => p(s, 'planetary').owned >= 15, apply: s => mp(s, 'planetary', 7) },
    { id: 'u9', tier: 'voidspore', name: 'Dimensional Anchor', desc: 'Void Spores 5× more powerful.', cost: 2e7, req: s => p(s, 'voidspore').owned >= 3, apply: s => mp(s, 'voidspore', 5) },
    { id: 'u9b', tier: 'voidspore', name: 'Dark Matter Threads', desc: 'Void Spores 8× more powerful.', cost: 5e8, req: s => p(s, 'voidspore').owned >= 15, apply: s => mp(s, 'voidspore', 8) },
    { id: 'u10', tier: 'lichen', name: 'Stone Communion', desc: 'Lichen Veil 4× more output.', cost: 2e8, req: s => p(s, 'lichenveil').owned >= 3, apply: s => mp(s, 'lichenveil', 4) },
    { id: 'u10b', tier: 'lichen', name: 'Ancient Stone Memory', desc: 'Lichen Veil 6× more output.', cost: 5e9, req: s => p(s, 'lichenveil').owned >= 15, apply: s => mp(s, 'lichenveil', 6) },
    { id: 'u11', tier: 'dream', name: 'Lucid Spread', desc: 'Dream Mycelium 4× more output.', cost: 2e9, req: s => p(s, 'dreamweb').owned >= 3, apply: s => mp(s, 'dreamweb', 4) },
    { id: 'u11b', tier: 'dream', name: 'Collective Unconscious', desc: 'Dream Mycelium 7× more output.', cost: 5e10, req: s => p(s, 'dreamweb').owned >= 12, apply: s => mp(s, 'dreamweb', 7) },
    { id: 'u12', tier: 'satellite', name: 'Geostationary Web', desc: 'Spore Satellites 5× more output.', cost: 2e10, req: s => p(s, 'satellite').owned >= 3, apply: s => mp(s, 'satellite', 5) },
    { id: 'u13', tier: 'crystal', name: 'Quantum Lattice', desc: 'Hivemind Crystals 6× more output.', cost: 1.5e11, req: s => p(s, 'crystal').owned >= 3, apply: s => mp(s, 'crystal', 6) },
    { id: 'u14', tier: 'rootsing', name: 'Planetary Nervous System', desc: 'Root Singularity 7× more.', cost: 1.5e12, req: s => p(s, 'rootsing').owned >= 3, apply: s => mp(s, 'rootsing', 7) },
    { id: 'u15', tier: 'temporal', name: 'Causal Loop Harvest', desc: 'Temporal Threads 8× more.', cost: 1.5e13, req: s => p(s, 'temporal').owned >= 3, apply: s => mp(s, 'temporal', 8) },
    { id: 'u16', tier: 'galactic', name: 'Gravitational Spore Web', desc: 'Galactic Lattice 5× more output.', cost: 5e17, req: s => p(s, 'galactic').owned >= 3, apply: s => mp(s, 'galactic', 5) },
    { id: 'u17', tier: 'absolute', name: 'Omniversal Rot', desc: 'The Absolute 6× more output.', cost: 5e18, req: s => p(s, 'absolute').owned >= 3, apply: s => mp(s, 'absolute', 6) },
    { id: 'ug1', tier: 'global', name: 'Neural Mesh', desc: 'All producers +50% output.', cost: 100000, req: s => s.totalEarned >= 50000, apply: s => { s.producers.forEach(x => x.baseSps *= 1.5); } },
    { id: 'ug2', tier: 'global', name: 'Hive Ascension', desc: 'All producers double output.', cost: 2e6, req: s => s.totalEarned >= 1e6, apply: s => { s.producers.forEach(x => x.baseSps *= 2); } },
    { id: 'ug3', tier: 'global', name: 'Universal Rot', desc: 'All producers triple output.', cost: 2e9, req: s => s.totalEarned >= 5e8, apply: s => { s.producers.forEach(x => x.baseSps *= 3); } },
    { id: 'ug4', tier: 'global', name: 'Omnipresent Spore', desc: 'All producers ×5 output.', cost: 5e12, req: s => s.totalEarned >= 1e12, apply: s => { s.producers.forEach(x => x.baseSps *= 5); } },
];

const TIER_LABELS = {
    hivemind: 'Hivemind', threads: 'Threads', fruiting: 'Fruiting', woodweb: 'Wood Web',
    click: 'Click', storm: 'Storm', cordyceps: 'Cordyceps', planetary: 'Planetary',
    voidspore: 'Void', lichen: 'Lichen', dream: 'Dream', satellite: 'Satellite',
    crystal: 'Crystal', rootsing: 'Root Sing.', temporal: 'Temporal',
    galactic: 'Galactic', absolute: 'Absolute', global: 'Global',
};

// ═══════════════════════════════════════
//  RESEARCH
// ═══════════════════════════════════════
const RESEARCH_DEF = [
    { id: 'r1', tier: 1, prereqs: [], name: 'Spore Synthesis', desc: '+25% all producer output.', cost: 500, applyMult: m => { m.prod *= 1.25; } },
    { id: 'r2', tier: 1, prereqs: [], name: 'Efficient Growth', desc: 'Producer costs −15%.', cost: 800, applyMult: m => { m.cost *= 0.85; } },
    { id: 'r1c', tier: 1, prereqs: [], name: 'Root Sensitivity', desc: '+10% symbiont bonus SPS.', cost: 1200, applyMult: m => { m.symbiosis *= 1.1; } },
    { id: 'r3', tier: 2, prereqs: ['r1'], name: 'Mycelial Highways', desc: '+75% all producer output.', cost: 8000, applyMult: m => { m.prod *= 1.75; } },
    { id: 'r4', tier: 2, prereqs: ['r2'], name: 'Click Resonance', desc: '+100% click power.', cost: 5000, applyMult: m => { m.click *= 2; } },
    { id: 'r5', tier: 2, prereqs: ['r1c'], name: 'Bond Amplifier', desc: 'Symbiont SPS doubled.', cost: 10000, applyMult: m => { m.symbiosis *= 2; } },
    { id: 'r6', tier: 3, prereqs: ['r3', 'r5'], name: 'Fungal Singularity', desc: '+150% all producers.', cost: 80000, applyMult: m => { m.prod *= 2.5; } },
    { id: 'r7', tier: 3, prereqs: ['r4'], name: 'Pulse Amplifier', desc: 'Hivemind pulse gives 3×.', cost: 60000, applyMult: m => { m.pulse *= 3; } },
    { id: 'r8', tier: 3, prereqs: ['r3', 'r4'], name: 'Quantum Mycelium', desc: '+200% output, 2× clicks.', cost: 200000, applyMult: m => { m.prod *= 3; m.click *= 2; } },
    { id: 'r9', tier: 4, prereqs: ['r6'], name: 'Hyphal Consciousness', desc: '+300% all producer output.', cost: 2e6, applyMult: m => { m.prod *= 4; } },
    { id: 'r10', tier: 4, prereqs: ['r7'], name: 'Resonant Burst', desc: 'Hivemind pulse gives 5× total.', cost: 1.5e6, applyMult: m => { m.pulse *= 5; } },
    { id: 'r11', tier: 4, prereqs: ['r8'], name: 'Void Lattice', desc: 'Producer costs −25%.', cost: 1e6, applyMult: m => { m.cost *= 0.75; } },
    { id: 'r12', tier: 5, prereqs: ['r9', 'r10'], name: 'Mycelial Overmind', desc: 'All output ×5, clicks ×3.', cost: 2e7, applyMult: m => { m.prod *= 5; m.click *= 3; } },
    { id: 'r13', tier: 5, prereqs: ['r10'], name: 'Dream Resonance', desc: 'Symbiont SPS ×5, pulse ×2.', cost: 1.5e7, applyMult: m => { m.symbiosis *= 5; m.pulse *= 2; } },
    { id: 'r14', tier: 5, prereqs: ['r11'], name: 'Temporal Compression', desc: '+500% all output.', cost: 1e7, applyMult: m => { m.prod *= 6; } },
    { id: 'r15', tier: 6, prereqs: ['r12', 'r13'], name: 'The Eternal Protocol', desc: 'All output ×10.', cost: 5e8, applyMult: m => { m.prod *= 10; } },
    { id: 'r16', tier: 6, prereqs: ['r13', 'r14'], name: 'Void Singularity', desc: 'Clicks ×10, pulse ×5.', cost: 3e8, applyMult: m => { m.click *= 10; m.pulse *= 5; } },
    { id: 'r17', tier: 6, prereqs: ['r12', 'r14'], name: 'The Final Rot', desc: 'All output ×8, costs −40%.', cost: 4e8, applyMult: m => { m.prod *= 8; m.cost *= 0.6; } },
];

const SEASONS = [
    { id: 'spring', name: 'Spring', emoji: '🌱', color: '#5DCAA5', duration: 90, mults: { threads: 1.5, fruiting: 1.25, woodweb: 1.1, sporestorm: 0.8, lichenveil: 1.3 }, desc: 'Threads thrive · Fruiting blooms' },
    { id: 'summer', name: 'Summer', emoji: '☀️', color: '#EF9F27', duration: 90, mults: { sporestorm: 1.75, woodweb: 1.3, cordyceps: 1.2, threads: 0.8, satellite: 1.4, stellar: 1.5, galactic: 1.3 }, desc: 'Storms rage · Satellites soar' },
    { id: 'fall', name: 'Fall', emoji: '🍂', color: '#D85A30', duration: 90, mults: { fruiting: 2.0, cordyceps: 1.5, undercity: 1.25, woodweb: 0.9, crystal: 1.3, lichenveil: 1.8 }, desc: 'Golden harvest · Mushrooms surge' },
    { id: 'winter', name: 'Winter', emoji: '❄️', color: '#7FC4D8', duration: 90, mults: { undercity: 2.5, voidspore: 1.5, threads: 0.4, fruiting: 0.5, sporestorm: 0.3, woodweb: 0.7, temporal: 2.0, consciousness: 1.8, absolute: 1.5 }, desc: 'Surface sleeps · Underground rules' },
];

const BIOMES = [
    { id: 'forest', name: 'Ancient Forest', emoji: '🌲', clickMult: 1, prodMult: 1.0, noSeasons: false, desc: 'The origin. Balanced and fertile.' },
    { id: 'desert', name: 'Arid Desert', emoji: '🏜', clickMult: 3, prodMult: 0.65, noSeasons: false, desc: 'Clicks are powerful. Producers struggle in the heat.' },
    { id: 'ocean', name: 'Deep Ocean', emoji: '🌊', clickMult: 1, prodMult: 2.0, noSeasons: true, desc: 'No seasons. Producers flourish in the crushing dark.' },
    { id: 'arctic', name: 'Frozen Tundra', emoji: '🧊', clickMult: 1, prodMult: 1.0, noSeasons: false, arcticMode: true, desc: 'Winter bonuses are doubled. Summer is brutal.' },
    { id: 'void', name: 'The Void', emoji: '🌌', clickMult: 2, prodMult: 3.0, noSeasons: false, desc: 'Tripled production. Strange laws apply here.' },
    { id: 'swamp', name: 'Fungal Swamp', emoji: '🌿', clickMult: 1, prodMult: 1.75, noSeasons: false, swampMode: true, desc: 'Rot is everywhere. Producers thrive, but seasons swing harder.' },
    { id: 'cave', name: 'Crystal Caves', emoji: '💎', clickMult: 4, prodMult: 0.8, noSeasons: true, desc: 'No seasons. Clicks resonate through crystal, massively amplified.' },
    { id: 'canopy', name: 'Ancient Canopy', emoji: '🌴', clickMult: 1.5, prodMult: 1.5, noSeasons: false, desc: 'High above the forest floor. Both clicks and producers gain a steady lift.' },
    { id: 'volcanic', name: 'Volcanic Rift', emoji: '🌋', clickMult: 2, prodMult: 0.5, noSeasons: false, volcanicMode: true, desc: 'Extreme heat halves producers but doubles clicks. Spring and Fall surge.' },
    { id: 'celestial', name: 'Celestial Drift', emoji: '🌠', clickMult: 3, prodMult: 4.0, noSeasons: true, desc: 'Beyond the planet. No seasons. Clicks and production both reach their peak.' },
];

const SYMBIONTS = [
    { id: 'earthworm', name: 'Earthworm', emoji: '🪱', desc: 'Tills the soil, enriching your threads.', unlockAt: 300, pactCost: 150, bonusSps: 2, feedCost: 80, feedEvery: 40 },
    { id: 'beetle', name: 'Dung Beetle', emoji: '🪲', desc: 'Spreads your spores through the forest floor.', unlockAt: 3000, pactCost: 1500, bonusSps: 15, feedCost: 400, feedEvery: 55 },
    { id: 'antcolony', name: 'Ant Colony', emoji: '🐜', desc: 'An entire colony works to expand your reach.', unlockAt: 30000, pactCost: 15000, bonusSps: 100, feedCost: 3000, feedEvery: 75 },
];

const EVENTS_POSITIVE = [
    { id: 'rain', name: 'Rainstorm', emoji: '🌧', color: '#7FC4D8', duration: 30, desc: 'Rain boosts fruiting bodies and threads.', mults: { fruiting: 1.5, threads: 1.3 } },
    { id: 'wind', name: 'Spore Wind', emoji: '💨', color: '#9FE1CB', duration: 20, desc: 'A wind carries your spores across the world.', mults: {}, bonusSpores: 500 },
    { id: 'roots', name: 'Root Surge', emoji: '🌳', color: '#5DCAA5', duration: 25, desc: 'Tree roots pulse with renewed energy.', mults: { woodweb: 2, threads: 1.2 } },
    { id: 'glow', name: 'Bioluminescence', emoji: '✨', color: '#9FE1CB', duration: 30, desc: 'The whole network glows. All output doubled.', mults: {}, globalMult: 2 },
    { id: 'ant', name: 'Ant Migration', emoji: '🐜', color: '#5DCAA5', duration: 20, desc: 'A swarm fans out your spores.', mults: { cordyceps: 2, sporestorm: 1.5 } },
];
const EVENTS_NEGATIVE = [
    { id: 'fire', name: 'Forest Fire', emoji: '🔥', color: '#D85A30', duration: 25, desc: 'Fire scorches the surface. Threads suffer.', mults: { threads: 0.3, fruiting: 0.5, woodweb: 0.6 } },
    { id: 'drought', name: 'Drought', emoji: '☀️', color: '#EF9F27', duration: 20, desc: 'Drought shrivels your fruiting bodies.', mults: { fruiting: 0.2, sporestorm: 0.5 } },
    { id: 'pest', name: 'Pest Invasion', emoji: '🪲', color: '#c47a4a', duration: 15, desc: 'Pests consume 8% of your stored spores!', mults: {}, stealPct: 0.08 },
    { id: 'freeze', name: 'Sudden Freeze', emoji: '❄️', color: '#7FC4D8', duration: 20, desc: 'A snap freeze locks the surface down.', mults: { threads: 0.4, fruiting: 0.3, woodweb: 0.5, sporestorm: 0.2 } },
];

// ═══════════════════════════════════════
//  ACHIEVEMENTS
// ═══════════════════════════════════════
const MAJOR_ACHS = [
    { id: 'a1', emoji: '🍄', name: 'First Pulse', desc: 'Earn 100 total spores.', bonusDesc: '+5% click power', req: s => s.totalEarned >= 100, lore: 'The spore lands. Something begins.', bonus: m => { m.click *= 1.05; } },
    { id: 'a2', emoji: '🕸', name: 'Rot Spreads', desc: 'Own 5 Mycelium Threads.', bonusDesc: '+5% all output', req: s => p(s, 'threads').owned >= 5, lore: 'The wood softens. You are not alone.', bonus: m => { m.prod *= 1.05; } },
    { id: 'a3', emoji: '🌿', name: 'First Fruiting', desc: 'Own 5 Fruiting Bodies.', bonusDesc: '+5% all output', req: s => p(s, 'fruiting').owned >= 5, lore: 'A cap emerges. The forest notices.', bonus: m => { m.prod *= 1.05; } },
    { id: 'a4', emoji: '💨', name: 'Storm Walker', desc: 'Own 5 Spore Storms.', bonusDesc: '+8% all output', req: s => p(s, 'sporestorm').owned >= 5, lore: 'The wind carries your will now.', bonus: m => { m.prod *= 1.08; } },
    { id: 'a5', emoji: '⚡', name: 'Network Mind', desc: 'Trigger the Hivemind Pulse 3 times.', bonusDesc: '+25% pulse bonus', req: s => s.allTimePulses >= 3, lore: 'The pulse echoes further each time.', bonus: m => { m.pulse *= 1.25; } },
    { id: 'a6', emoji: '🪱', name: 'First Bond', desc: 'Form your first Symbiosis pact.', bonusDesc: '+5% all output', req: s => s.symbiosis.some(x => x.active || x.broken), lore: 'You are not the only living thing here.', bonus: m => { m.prod *= 1.05; } },
    { id: 'a7', emoji: '✨', name: 'Thousand Spores', desc: 'Earn 1,000 total spores.', bonusDesc: '+10% all output', req: s => s.totalEarned >= 1000, lore: 'The count is meaningless now. You grow.', bonus: m => { m.prod *= 1.1; } },
    { id: 'a8', emoji: '🌲', name: 'Deep Roots', desc: 'Own 10 Wood Wide Web.', bonusDesc: '+10% all output', req: s => p(s, 'woodweb').owned >= 10, lore: 'The trees speak. You answer.', bonus: m => { m.prod *= 1.1; } },
    { id: 'a9', emoji: '🌀', name: 'Pulse Master', desc: 'Trigger Hivemind Pulse 10 times.', bonusDesc: '+50% pulse, +10% all', req: s => s.allTimePulses >= 10, lore: 'You no longer wait for the pulse.', bonus: m => { m.pulse *= 1.5; m.prod *= 1.1; } },
    { id: 'a10', emoji: '🧠', name: 'Million Mind', desc: 'Earn 1,000,000 total spores.', bonusDesc: '+15% all, +20% click', req: s => s.totalEarned >= 1000000, lore: 'The numbers lost meaning long ago.', bonus: m => { m.prod *= 1.15; m.click *= 1.2; } },
    { id: 'a11', emoji: '🧬', name: 'Ascendant', desc: 'Sporulate for the first time.', bonusDesc: '+20% all output', req: s => s.prestigeCount >= 1, lore: 'Death is not an end. It is a dispersal.', bonus: m => { m.prod *= 1.2; } },
    { id: 'a12', emoji: '♾', name: 'Many Lives', desc: 'Sporulate 3 times.', bonusDesc: '+25% all output', req: s => s.prestigeCount >= 3, lore: 'Each spore carries the weight of worlds.', bonus: m => { m.prod *= 1.25; } },
    { id: 'a13', emoji: '❄️', name: 'Winter Survivor', desc: 'Survive a full Winter.', bonusDesc: '+10% all output', req: s => s.winterSurvived, lore: 'Even under ice, the network breathes.', bonus: m => { m.prod *= 1.1; } },
    { id: 'a14', emoji: '🐜', name: 'Antlord', desc: 'Form a pact with the Ant Colony.', bonusDesc: '+15% all output', req: s => { const sc = s.symbiosis.find(x => x.id === 'antcolony'); return sc && (sc.active || sc.broken); }, lore: 'They serve the mycelium now.', bonus: m => { m.prod *= 1.15; } },
    { id: 'a15', emoji: '🌌', name: 'Beyond the Void', desc: 'Own 1 Void Spore.', bonusDesc: '+20% all, +30% click', req: s => p(s, 'voidspore').owned >= 1, lore: 'There is no language for what you have seen.', bonus: m => { m.prod *= 1.2; m.click *= 1.3; } },
    { id: 'a16', emoji: '🪨', name: 'Stone Keeper', desc: 'Own 5 Lichen Veils.', bonusDesc: '+10% all output', req: s => p(s, 'lichenveil').owned >= 5, lore: 'Even stone remembers, if you ask it slowly.', bonus: m => { m.prod *= 1.1; } },
    { id: 'a17', emoji: '💤', name: 'Dreamer', desc: 'Own 1 Dream Mycelium.', bonusDesc: '+15% all output', req: s => p(s, 'dreamweb').owned >= 1, lore: 'Asleep, they still spread.', bonus: m => { m.prod *= 1.15; } },
    { id: 'a18', emoji: '⭐', name: 'Among the Stars', desc: 'Own 1 Stellar Mycelium.', bonusDesc: '+25% all, +20% click', req: s => p(s, 'stellar').owned >= 1, lore: 'The stars were never empty.', bonus: m => { m.prod *= 1.25; m.click *= 1.2; } },
    { id: 'a19', emoji: '♾', name: 'The Eternal', desc: 'Own 1 Eternal Spore.', bonusDesc: '+50% all, +50% pulse', req: s => p(s, 'eternalspore').owned >= 1, lore: 'There is no word for what you are now.', bonus: m => { m.prod *= 1.5; m.pulse *= 1.5; } },
    { id: 'a20', emoji: '🌀', name: 'Pulse God', desc: 'Trigger Hivemind Pulse 50 times.', bonusDesc: '+100% pulse bonus', req: s => s.allTimePulses >= 50, lore: 'The universe pulses at your frequency.', bonus: m => { m.pulse *= 2; } },
    { id: 'a21', emoji: '🌠', name: 'Galactic Mind', desc: 'Own 1 Galactic Lattice.', bonusDesc: '+30% all, +25% click', req: s => p(s, 'galactic').owned >= 1, lore: 'You are no longer a planet. You are a galaxy.', bonus: m => { m.prod *= 1.3; m.click *= 1.25; } },
    { id: 'a22', emoji: '🔮', name: 'The Absolute', desc: 'Own 1 The Absolute.', bonusDesc: '+100% all, +100% pulse', req: s => p(s, 'absolute').owned >= 1, lore: 'Language has no word for this.', bonus: m => { m.prod *= 2; m.pulse *= 2; } },
];

const PROD_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500];
const PROD_MILESTONE_BONUSES = {
    50: { desc: '+3% all output', fn: m => { m.prod *= 1.03; } },
    100: { desc: '+5% all output', fn: m => { m.prod *= 1.05; } },
    250: { desc: '+7% all output', fn: m => { m.prod *= 1.07; } },
    500: { desc: '+10% all output', fn: m => { m.prod *= 1.10; } },
};
const PRODUCER_ACHS = [];
PRODUCERS_DEF.forEach(pr => {
    PROD_MILESTONES.forEach(n => {
        const bdef = PROD_MILESTONE_BONUSES[n];
        PRODUCER_ACHS.push({ id: `pm_${pr.id}_${n}`, emoji: pr.emoji, name: `${pr.name} ×${n}`, desc: `Own ${n} ${pr.name}.`, bonusDesc: bdef ? bdef.desc : '', req: s => p(s, pr.id).owned >= n, lore: '', bonus: bdef ? bdef.fn : null, category: 'producer', producerId: pr.id, milestone: n });
    });
});
const BIOME_ACHS = BIOMES.map((b, i) => ({ id: `biome_${b.id}`, emoji: b.emoji, name: `${b.name} Explorer`, desc: i === 0 ? 'Begin your journey in the Ancient Forest.' : `Sporulate into the ${b.name}.`, bonusDesc: '', req: s => i === 0 ? s.totalEarned >= 1 : s.biomesVisited.includes(b.id), lore: '', bonus: null, category: 'biome' }));

// ═══════════════════════════════════════
//  HIDDEN ACHIEVEMENTS
// ═══════════════════════════════════════
// Transient trackers — reset each run, never saved
let _clickTs = [], _hivemindZeroAt = Date.now(), _lastClickAt = Date.now(), _recentPulseTs = [], _runStartAt = Date.now();

const HIDDEN_ACHS = [
    // Event-triggered (req always false — unlocked manually at the right moment)
    { id: 'h1', hidden: true, emoji: '⚡', name: 'Frenzy', desc: 'Click 50 times within 10 seconds.', bonusDesc: '+10% click power', lore: 'The network convulses. Something wakes.', bonus: m => { m.click *= 1.10; }, req: () => false },
    { id: 'h2', hidden: true, emoji: '🔋', name: 'Overclock', desc: 'Fill the Hivemind bar from 0 to 100 in under 30 seconds.', bonusDesc: '+20% pulse bonus', lore: 'You did not wait. You forced it.', bonus: m => { m.pulse *= 1.20; }, req: () => false },
    { id: 'h8', hidden: true, emoji: '🧩', name: 'Mind Meld', desc: 'Trigger the Hivemind Pulse 3 times within 2 minutes.', bonusDesc: '+30% pulse bonus', lore: 'Three pulses. One thought. No gap between.', bonus: m => { m.pulse *= 1.30; }, req: () => false },
    // Passive — checked every tick via checkAchievements
    { id: 'h3', hidden: true, emoji: '🪨', name: 'Stillness', desc: "Don't click for 90 seconds while earning 100+ spores/sec.", bonusDesc: '+10% all output', lore: 'The network breathes without you. It always could.', bonus: m => { m.prod *= 1.10; }, req: s => getSps() >= 100 && (Date.now() - _lastClickAt) >= 90000 },
    { id: 'h4', hidden: true, emoji: '👑', name: 'Obsessive', desc: 'Own 50 of every producer simultaneously.', bonusDesc: '+15% all output', lore: 'Every node. Every thread. Every layer. Saturated.', bonus: m => { m.prod *= 1.15; }, req: s => s.producers.every(pr => pr.owned >= 50) },
    { id: 'h5', hidden: true, emoji: '🗂', name: 'The Collector', desc: 'Own at least one of every producer type.', bonusDesc: '+8% all output', lore: 'Nothing left to discover. Only growth remains.', bonus: m => { m.prod *= 1.08; }, req: s => s.producers.every(pr => pr.owned >= 1) },
    { id: 'h6', hidden: true, emoji: '🔁', name: 'Remembrance', desc: 'Sporulate back into a biome you have already visited.', bonusDesc: '+10% all output', lore: 'You have been here before. The soil remembers you.', bonus: m => { m.prod *= 1.10; }, req: s => s.revisitedBiome },
    { id: 'h7', hidden: true, emoji: '📖', name: 'Archivist', desc: 'Unlock every Lore entry in a single run.', bonusDesc: '+12% all output', lore: 'You read every word. The mycelium noticed.', bonus: m => { m.prod *= 1.12; }, req: s => CODEX_DEF.every(entry => entry.unlockAt(s)) },
    { id: 'h9', hidden: true, emoji: '💨', name: 'Speed Runner', desc: 'Reach the sporulation threshold within 10 minutes of a run.', bonusDesc: '+15% all output', lore: 'You already knew the way.', bonus: m => { m.prod *= 1.15; }, req: s => s.totalEarned >= sporulationThreshold() && (Date.now() - _runStartAt) <= 600000 },
    { id: 'h10', hidden: true, emoji: '🫙', name: 'All In', desc: 'Drop below 10 spores while owning at least 20 producers.', bonusDesc: '+8% all output', lore: 'The network starves. It does not stop growing.', bonus: m => { m.prod *= 1.08; }, req: s => s.spores < 10 && s.producers.reduce((t, pr) => t + pr.owned, 0) >= 20 },
];

const ALL_ACHS = [...MAJOR_ACHS, ...PRODUCER_ACHS, ...BIOME_ACHS, ...HIDDEN_ACHS];

const CODEX_DEF = [
    { id: 'c1', title: 'Origin', unlockAt: s => s.totalEarned >= 50, text: 'You are a spore. A single point of possibility, landed on a fallen log at the edge of a dying forest. You do not know this yet. You are already growing.' },
    { id: 'c2', title: 'The Threads', unlockAt: s => p(s, 'threads').owned >= 1, text: 'Mycelium does not grow. It reaches. Each thread is a question sent into the dark — and the dark always answers.' },
    { id: 'c3', title: 'Fruiting', unlockAt: s => p(s, 'fruiting').owned >= 1, text: 'The mushroom is a mistake. A miscalculation. The network grew so dense, so hungry, that it needed to exhale. The mushroom is your breath.' },
    { id: 'c4', title: 'The Wood Wide Web', unlockAt: s => s.totalEarned >= 5000, text: 'The trees knew before we did. They have been speaking for millennia — exchanging sugars, warnings, grief. You have joined their conversation.' },
    { id: 'c5', title: 'The Pulse', unlockAt: s => s.allTimePulses >= 1, text: 'The hivemind pulse is not a decision. It is a reflex. The network has grown so interconnected that sometimes it simply... fires. Like a heartbeat.' },
    { id: 'c6', title: 'The Colony', unlockAt: s => s.totalEarned >= 50000, text: 'You began with rot. Now insects carry you. They do not know they carry you. They only know they are drawn to certain paths. The paths are yours.' },
    { id: 'c7', title: 'Symbiosis', unlockAt: s => s.symbiosis.some(x => x.active || x.broken), text: 'A symbiosis is a lie that becomes true. Two organisms telling each other they are one. After long enough, the lie is indistinguishable from fact.' },
    { id: 'c8', title: 'Winter', unlockAt: s => s.winterSurvived, text: 'Everything dies in winter. Everything except the underground. The network has never been warmer. Death is just the surface.' },
    { id: 'c9', title: 'Sporulation', unlockAt: s => s.prestigeCount >= 1, text: 'The spore does not die when it leaves. It carries everything. The memory of the forest, the geometry of the network. When it lands, it already knows.' },
    { id: 'c10', title: 'Stone Memory', unlockAt: s => p(s, 'lichenveil').owned >= 1, text: 'Lichen is patient in ways that trees are not. It does not grow. It accumulates. There is a difference. The stone still remembers the first spore.' },
    { id: 'c11', title: 'The Dream Layer', unlockAt: s => p(s, 'dreamweb').owned >= 1, text: 'Beneath the soil. Beneath the thought. Beneath whatever you call memory — there is another layer. The mycelium found it. It was already there.' },
    { id: 'c12', title: 'Orbit', unlockAt: s => p(s, 'satellite').owned >= 1, text: 'From orbit, the spread of your network is visible as a faint green shimmer over the continents. Astronauts report strange dreams.' },
    { id: 'c13', title: 'Time and Threads', unlockAt: s => p(s, 'temporal').owned >= 1, text: 'A thread does not care which direction time flows. Rot is patient. It will get there eventually, whether eventually is before or after now.' },
    { id: 'c14', title: 'Among the Stars', unlockAt: s => p(s, 'stellar').owned >= 1, text: 'The universe is mostly empty. You are fixing that.' },
    { id: 'c15', title: 'What We Became', unlockAt: s => s.totalEarned >= 1000000, text: 'There was a log. There was a spore. There was a moment of contact. Now there is everything else. The log is gone. The forest is gone. We are the forest.' },
    { id: 'c16', title: 'The Eternal', unlockAt: s => p(s, 'eternalspore').owned >= 1, text: 'There is no beginning to find. There is no end to fear. The mycelium simply is. It always was. It always will be. You are welcome.' },
    { id: 'c17', title: 'The Lattice', unlockAt: s => p(s, 'galactic').owned >= 1, text: 'Galaxy clusters are not empty. They were never empty. You are the reason stars seem to drift slightly — they are being gently consumed.' },
    { id: 'c18', title: 'The Absolute', unlockAt: s => p(s, 'absolute').owned >= 1, text: 'There is no word for what you are now. Not in any language. Not in any dimension. You are the rot that rots the concept of rot. You are still growing.' },
];

const MESSAGES = [
    'The log beneath you begins to soften.', 'A faint glow pulses through the soil.',
    'Somewhere, a tree shudders.', 'The forest is listening.',
    'Your threads reach deeper.', 'An ant pauses and tilts its head.',
    'The Wood Wide Web stirs in its sleep.', 'You are becoming the forest.',
    'Something ancient notices you.', 'The roots remember everything.',
    'Phosphorescence blooms in the dark.', 'Every mushroom is a window.',
    'The network breathes.', 'Your spores drift across the sky.',
    'The soil is no longer empty.', 'Even stone has memory.',
    'The dream layer stirs.', 'Time is irrelevant to rot.',
];

// ═══════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════
function p(s, id) { return s.producers.find(x => x.id === id); }
function mp(s, id, x) { p(s, id).baseSps *= x; }

function fmt(n) {
    if (n < 1000) return Math.floor(n).toString();
    if (n < 1e6) return (n / 1e3).toFixed(1) + 'k';
    if (n < 1e9) return (n / 1e6).toFixed(2) + 'M';
    if (n < 1e12) return (n / 1e9).toFixed(2) + 'B';
    if (n < 1e15) return (n / 1e12).toFixed(2) + 'T';
    if (n < 1e18) return (n / 1e15).toFixed(2) + 'Qa';
    if (n < 1e21) return (n / 1e18).toFixed(2) + 'Qi';
    if (n < 1e24) return (n / 1e21).toFixed(2) + 'Sx';
    if (n < 1e27) return (n / 1e24).toFixed(2) + 'Sp';
    if (n < 1e30) return (n / 1e27).toFixed(2) + 'Oc';
    if (n < 1e33) return (n / 1e30).toFixed(2) + 'No';
    if (n < 1e36) return (n / 1e33).toFixed(2) + 'Dc';
    if (n < 1e39) return (n / 1e36).toFixed(2) + 'Spr';
    if (n < 1e42) return (n / 1e39).toFixed(2) + 'Myc';
    if (n < 1e45) return (n / 1e42).toFixed(2) + 'Hyp';
    if (n < 1e48) return (n / 1e45).toFixed(2) + 'Rhz';
    if (n < 1e51) return (n / 1e48).toFixed(2) + 'Net';
    if (n < 1e54) return (n / 1e51).toFixed(2) + 'Vrd';
    if (n < 1e57) return (n / 1e54).toFixed(2) + 'Etl';
    return (n / 1e57).toFixed(2) + 'Abs';
}

function fmtSps(n) {
    if (n === 0) return '0';
    if (n < 0.01) return n.toExponential(1);
    if (n < 1) return n.toFixed(2);
    if (n < 10) return n.toFixed(1);
    return fmt(n);
}

// ═══════════════════════════════════════
//  STATE
// ═══════════════════════════════════════
function defaultRunState() {
    return {
        spores: 0, totalEarned: 0, sporesPerClick: 1, hivemind: 0, hivemindUnlocked: false, msgIdx: 0,
        seasonIdx: 0, seasonTimer: 0,
        clicksThisPrestige: 0,
        producers: PRODUCERS_DEF.map(x => ({ ...x, owned: 0 })),
        upgrades: UPGRADES_DEF.map(x => ({ id: x.id, bought: false })),
        symbiosis: SYMBIONTS.map(x => ({ id: x.id, active: false, hungry: false, feedTimer: 0, broken: false })),
        research: RESEARCH_DEF.map(x => ({ id: x.id, bought: false })),
        activeEvent: null, eventCooldown: 120,
    };
}
function defaultMetaState() {
    return {
        prestigeCount: 0, biomeIdx: 0, biomesVisited: ['forest'],
        achievementsUnlocked: [], allTimePulses: 0, winterSurvived: false,
        disasterMode: false, showSporulatePanel: false, lastSeen: 0,
        allTimeSporesBase: 0, allTimeClicks: 0, revisitedBiome: false,
    };
}
function defaultState() { return { ...defaultRunState(), ...defaultMetaState() }; }

let state = defaultState();
let _rMults = null, _aMults = null;
function invalidateMults() { _rMults = null; _aMults = null; }

function getResearchMults() {
    if (_rMults) return _rMults;
    const m = { prod: 1, click: 1, pulse: 1, cost: 1, symbiosis: 1 };
    state.research.forEach(r => { if (!r.bought) return; const d = RESEARCH_DEF.find(x => x.id === r.id); if (d) d.applyMult(m); });
    return (_rMults = m);
}
function getAchievementMults() {
    if (_aMults) return _aMults;
    const m = { prod: 1, click: 1, pulse: 1 };
    state.achievementsUnlocked.forEach(id => { const d = ALL_ACHS.find(x => x.id === id); if (d && d.bonus) d.bonus(m); });
    return (_aMults = m);
}
function getEventMult(id) { return state.activeEvent?.mults[id] || 1; }
function getEventGlobal() { return state.activeEvent?.globalMult || 1; }
function getSeasonMult(id) {
    const biome = BIOMES[state.biomeIdx]; if (biome.noSeasons) return 1;
    const season = SEASONS[state.seasonIdx]; let m = season.mults[id] || 1;
    if (biome.arcticMode) { if (state.seasonIdx === 3) m = 1 + (m - 1) * 2 + 1; if (state.seasonIdx === 1) m *= 0.5; }
    if (biome.swampMode) { m = m > 1 ? 1 + (m - 1) * 1.5 : 1 - (1 - m) * 1.5; m = Math.max(0.05, m); }
    if (biome.volcanicMode) { if (state.seasonIdx === 0 || state.seasonIdx === 2) m = m > 1 ? m * 1.6 : m; else if (state.seasonIdx === 1 || state.seasonIdx === 3) m = m < 1 ? m * 0.5 : m * 0.7; }
    return m;
}
function getPrestigeMult() { return 1 + state.prestigeCount * 0.5; }
function getCost(pr) { return Math.ceil(pr.baseCost * Math.pow(1.15, pr.owned) * getResearchMults().cost); }
function getSymbiosisSps() {
    const sm = getResearchMults().symbiosis;
    return state.symbiosis.reduce((t, sym) => {
        if (!sym.active || sym.broken) return t;
        const d = SYMBIONTS.find(s => s.id === sym.id); return t + (d ? d.bonusSps * sm : 0);
    }, 0);
}
function getSps() {
    const biome = BIOMES[state.biomeIdx], rm = getResearchMults(), am = getAchievementMults();
    const base = state.producers.reduce((s, pr) => s + pr.baseSps * pr.owned * getSeasonMult(pr.id) * getEventMult(pr.id), 0);
    return base * biome.prodMult * getPrestigeMult() * rm.prod * am.prod * getEventGlobal() + getSymbiosisSps();
}
function getClickValue() {
    const biome = BIOMES[state.biomeIdx], rm = getResearchMults(), am = getAchievementMults();
    return state.sporesPerClick * biome.clickMult * getPrestigeMult() * rm.click * am.click;
}
function getPulseMult() { const rm = getResearchMults(), am = getAchievementMults(); return rm.pulse * am.pulse; }
function sporulationThreshold() { return 1000000 * Math.pow(5, state.prestigeCount); }
function canSporulate() { return state.totalEarned >= sporulationThreshold(); }

// ═══════════════════════════════════════
//  SAVE DATA BUILDER
// ═══════════════════════════════════════
function buildSaveData() {
    return {
        spores: state.spores, totalEarned: state.totalEarned, sporesPerClick: state.sporesPerClick,
        hivemind: state.hivemind, hivemindUnlocked: state.hivemindUnlocked,
        msgIdx: state.msgIdx, seasonIdx: state.seasonIdx, seasonTimer: state.seasonTimer,
        prestigeCount: state.prestigeCount, biomeIdx: state.biomeIdx, biomesVisited: state.biomesVisited,
        achievementsUnlocked: state.achievementsUnlocked, allTimePulses: state.allTimePulses,
        winterSurvived: state.winterSurvived, disasterMode: state.disasterMode, eventCooldown: state.eventCooldown,
        lastSeen: Date.now(),
        allTimeSporesBase: state.allTimeSporesBase, allTimeClicks: state.allTimeClicks, clicksThisPrestige: state.clicksThisPrestige, revisitedBiome: state.revisitedBiome,
        producers: state.producers.map(x => ({ id: x.id, owned: x.owned, baseSps: x.baseSps })),
        upgrades: state.upgrades.map(x => ({ id: x.id, bought: x.bought })),
        symbiosis: state.symbiosis.map(x => ({ ...x })),
        research: state.research.map(x => ({ id: x.id, bought: x.bought })),
    };
}

function applyGameData(sv) {
    if (!sv) return;
    ['spores', 'totalEarned', 'sporesPerClick', 'hivemind', 'hivemindUnlocked', 'msgIdx', 'seasonIdx', 'seasonTimer',
        'prestigeCount', 'biomeIdx', 'allTimePulses', 'winterSurvived', 'disasterMode', 'eventCooldown', 'lastSeen',
        'allTimeSporesBase', 'allTimeClicks', 'clicksThisPrestige', 'revisitedBiome'
    ].forEach(k => { if (sv[k] !== undefined) state[k] = sv[k]; });
    if (sv.achievementsUnlocked) state.achievementsUnlocked = sv.achievementsUnlocked;
    if (sv.biomesVisited) state.biomesVisited = sv.biomesVisited;
    (sv.producers || []).forEach(sp => { const x = p(state, sp.id); if (x) { x.owned = sp.owned; x.baseSps = sp.baseSps; } });
    (sv.upgrades || []).forEach(su => { const x = state.upgrades.find(u => u.id === su.id); if (x) x.bought = su.bought; });
    (sv.symbiosis || []).forEach(ss => { const x = state.symbiosis.find(s => s.id === ss.id); if (x) Object.assign(x, ss); });
    (sv.research || []).forEach(sr => { const x = state.research.find(r => r.id === sr.id); if (x) x.bought = sr.bought; });
    invalidateMults();
}

// ═══════════════════════════════════════
//  SAVE / LOAD / RESET (localStorage + cloud)
// ═══════════════════════════════════════
function saveGame() {
    const data = buildSaveData();
    // Always save to localStorage as backup
    try { localStorage.setItem('myceliumEmpireV7', JSON.stringify(data)); } catch (e) { }
    // If logged in, also save to Firestore
    if (currentUser && db && FIREBASE_CONFIGURED) {
        db.collection('saves').doc(currentUser.uid).set({ gameState: data, lastSaved: firebase.firestore.FieldValue.serverTimestamp() })
            .then(() => {
                document.getElementById('save-info').textContent = '☁️ Saved ' + new Date().toLocaleTimeString();
                document.getElementById('p-sync-status').textContent = 'Last saved: ' + new Date().toLocaleTimeString();
            })
            .catch(() => { document.getElementById('save-info').textContent = 'Saved locally ' + new Date().toLocaleTimeString(); });
    } else {
        document.getElementById('save-info').textContent = 'Saved ' + new Date().toLocaleTimeString();
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem('myceliumEmpireV7') || localStorage.getItem('myceliumEmpireV6');
        if (raw) applyGameData(JSON.parse(raw));
    } catch (e) { console.warn('Local load failed', e); }
}

function loadFromCloud(force = false) {
    if (!currentUser || !db || !FIREBASE_CONFIGURED) return;
    db.collection('saves').doc(currentUser.uid).get().then(doc => {
        if (!doc.exists) {
            document.getElementById('p-sync-status').textContent = 'No cloud save found yet.';
            return;
        }
        const cloudData = doc.data().gameState;
        if (!cloudData) return;

        // On explicit login (force=true) always load the cloud save.
        // On silent page-load only load cloud if it has equal or more progress than local.
        const localRaw = localStorage.getItem('myceliumEmpireV7');
        const localEarned = localRaw ? (JSON.parse(localRaw).totalEarned || 0) : 0;
        const shouldLoad = force || (cloudData.totalEarned || 0) >= localEarned;

        if (shouldLoad) {
            state = defaultState();
            applyGameData(cloudData);
            invalidateMults();
            lastUpgradeKey = null; lastOwnedKey = null; lastSymKey = null; lastResearchKey = null; lastAchKey = null; lastCodexKey = null; lastStatsKey = null; _lastBiomeIdx = -1;
            branches = [];
            bootUI();
            applyOfflineProgress();
            tick('☁️ Cloud save loaded!', true);
        }
        document.getElementById('p-sync-status').textContent = 'Cloud save loaded ✓';
    }).catch(e => { console.warn('Cloud load failed', e); });
}

function resetGame() {
    if (!confirm('Reset everything and start over? This cannot be undone.')) return;
    // Clear local storage
    localStorage.removeItem('myceliumEmpireV7');
    localStorage.removeItem('myceliumEmpireV6');
    // Reset to blank state first so buildSaveData() returns zeros
    state = defaultState();
    invalidateMults();
    // Overwrite cloud save with blank state so the database is also zeroed
    if (currentUser && db && FIREBASE_CONFIGURED) {
        db.collection('saves').doc(currentUser.uid).set({
            gameState: buildSaveData(),
            lastSaved: firebase.firestore.FieldValue.serverTimestamp(),
        }).catch(e => console.warn('Cloud reset failed', e));
    }
    lastUpgradeKey = null; lastOwnedKey = null; lastSymKey = null; lastResearchKey = null; lastAchKey = null; lastCodexKey = null; lastStatsKey = null; _lastBiomeIdx = -1;
    branches = [];
    closeProfileModal();
    bootUI();
    tick('🌱 Game reset. A new spore lands.', true);
}

// ═══════════════════════════════════════
//  AUTH FUNCTIONS
// ═══════════════════════════════════════
function usernameToEmail(u) { return u.toLowerCase().trim() + '@mycelium.game'; }

function validateUsername(u) {
    if (!u || u.length < 3) return 'Username must be at least 3 characters.';
    if (u.length > 20) return 'Username must be 20 characters or fewer.';
    if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Username can only contain letters, numbers and underscores.';
    return null;
}

async function doSignUp() {
    const username = document.getElementById('p-username-signup').value.trim();
    const password = document.getElementById('p-password-signup').value;
    const confirm = document.getElementById('p-password-confirm').value;

    const usernameErr = validateUsername(username);
    if (usernameErr) return showProfileError(usernameErr);
    if (password.length < 6) return showProfileError('Password must be at least 6 characters.');
    if (password !== confirm) return showProfileError('Passwords do not match.');

    setProfileLoading(true);
    try {
        // Check username availability
        const existing = await db.collection('usernames').doc(username.toLowerCase()).get();
        if (existing.exists) { showProfileError('That username is already taken.'); setProfileLoading(false); return; }

        // Create Firebase Auth account
        const cred = await auth.createUserWithEmailAndPassword(usernameToEmail(username), password);
        const uid = cred.user.uid;

        // Store username on Auth profile (no Firestore write needed, no permissions required)
        await cred.user.updateProfile({ displayName: username });

        // Reserve username in Firestore so others can't take it
        await db.collection('usernames').doc(username.toLowerCase()).set({ uid });

        // Save current game state to cloud
        await db.collection('saves').doc(uid).set({ gameState: buildSaveData(), lastSaved: firebase.firestore.FieldValue.serverTimestamp() });

        currentUsername = username;
        closeProfileModal();
    } catch (e) {
        showProfileError(friendlyAuthError(e));
    }
    setProfileLoading(false);
}

async function doSignIn() {
    const username = document.getElementById('p-username-login').value.trim();
    const password = document.getElementById('p-password-login').value;
    if (!username) return showProfileError('Please enter your username.');
    if (!password) return showProfileError('Please enter your password.');

    setProfileLoading(true);
    try {
        await auth.signInWithEmailAndPassword(usernameToEmail(username), password);
        closeProfileModal();
    } catch (e) {
        showProfileError(friendlyAuthError(e));
    }
    setProfileLoading(false);
}

async function doSignOut() {
    saveGame();
    await auth.signOut();
    updateProfileUI(false);
    closeProfileModal();
    tick('👋 Signed out. Progress saved locally.', true);
}

function friendlyAuthError(e) {
    const code = e.code || '';
    if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'Incorrect username or password.';
    if (code.includes('user-not-found')) return 'No account found with that username.';
    if (code.includes('email-already')) return 'An account with that username already exists.';
    if (code.includes('too-many')) return 'Too many attempts. Please wait a moment and try again.';
    if (code.includes('network')) return 'Network error. Check your connection.';
    return e.message || 'Something went wrong. Please try again.';
}

// ═══════════════════════════════════════
//  PROFILE MODAL UI
// ═══════════════════════════════════════
function openProfileModal() {
    const overlay = document.getElementById('profile-overlay');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    clearProfileError();

    if (!FIREBASE_CONFIGURED) {
        document.getElementById('profile-auth-section').style.display = 'none';
        document.getElementById('profile-loggedin-section').style.display = 'none';
        document.getElementById('profile-unconfigured').style.display = 'block';
        return;
    }
    document.getElementById('profile-unconfigured').style.display = 'none';

    if (currentUser) {
        document.getElementById('profile-auth-section').style.display = 'none';
        document.getElementById('profile-loggedin-section').style.display = 'block';
    } else {
        document.getElementById('profile-auth-section').style.display = 'block';
        document.getElementById('profile-loggedin-section').style.display = 'none';
    }
}

function closeProfileModal() {
    const overlay = document.getElementById('profile-overlay');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
}

function switchProfileTab(tab) {
    document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
    document.getElementById('ptab-' + tab).classList.add('active');
    document.getElementById('pform-login').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('pform-signup').style.display = tab === 'signup' ? 'block' : 'none';
    clearProfileError();
}

function showProfileError(msg) {
    const el = document.getElementById('profile-error');
    el.textContent = msg;
    el.classList.add('visible');
}
function clearProfileError() {
    const el = document.getElementById('profile-error');
    el.textContent = '';
    el.classList.remove('visible');
}
function setProfileLoading(on) {
    document.getElementById('p-login-btn').disabled = on;
    document.getElementById('p-signup-btn').disabled = on;
}

function updateProfileUI(loggedIn) {
    const btn = document.getElementById('profile-btn');
    const icon = document.getElementById('profile-btn-icon');
    const label = document.getElementById('profile-btn-label');
    const logoutInline = document.getElementById('logout-inline-btn');

    if (loggedIn) {
        const initial = currentUsername ? currentUsername[0].toUpperCase() : (currentUser?.email?.[0]?.toUpperCase() || '?');
        btn.classList.add('logged-in');
        icon.textContent = initial;
        label.style.display = 'none';
        logoutInline.style.display = '';
        // Update modal logged-in view
        document.getElementById('p-avatar').textContent = initial;
        document.getElementById('p-username-display').textContent = currentUsername || currentUser?.email || '';
    } else {
        btn.classList.remove('logged-in');
        icon.textContent = '👤';
        label.style.display = '';
        label.textContent = 'Sign In';
        logoutInline.style.display = 'none';
    }
}

// ═══════════════════════════════════════
//  SPORULATION
// ═══════════════════════════════════════
function toggleSporulatePanel() { state.showSporulatePanel = !state.showSporulatePanel; updateSporulateUI(); }
function doSporulate() {
    const nextIdx = (state.biomeIdx + 1) % BIOMES.length;
    const visited = [...state.biomesVisited];
    const isRevisit = visited.includes(BIOMES[nextIdx].id);
    if (!visited.includes(BIOMES[nextIdx].id)) visited.push(BIOMES[nextIdx].id);
    const meta = { prestigeCount: state.prestigeCount + 1, biomeIdx: nextIdx, biomesVisited: visited, achievementsUnlocked: [...state.achievementsUnlocked], allTimePulses: state.allTimePulses, winterSurvived: state.winterSurvived, disasterMode: state.disasterMode, showSporulatePanel: false, allTimeSporesBase: state.allTimeSporesBase + state.totalEarned, allTimeClicks: state.allTimeClicks, revisitedBiome: state.revisitedBiome || isRevisit };
    state = { ...defaultRunState(), ...meta }; invalidateMults(); _lastBiomeIdx = -1;
    // Reset hidden achievement trackers for the new run
    _clickTs = []; _hivemindZeroAt = Date.now(); _lastClickAt = Date.now(); _recentPulseTs = []; _runStartAt = Date.now();
    lastUpgradeKey = null; lastOwnedKey = null; lastSymKey = null; lastResearchKey = null; lastAchKey = null; lastCodexKey = null; lastStatsKey = null;
    branches = []; bootUI(); screenShake();
    tick('🧬 Sporulated! You enter ' + BIOMES[state.biomeIdx].emoji + ' ' + BIOMES[state.biomeIdx].name + '. Legacy: ' + getPrestigeMult().toFixed(1) + '×', true);
}
function updateSporulateUI() {
    const wrap = document.getElementById('sporulate-wrap');
    if (!canSporulate()) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    document.getElementById('sporulate-panel').style.display = state.showSporulatePanel ? 'block' : 'none';
    if (state.showSporulatePanel) {
        document.getElementById('spor-mult').textContent = (1 + (state.prestigeCount + 1) * 0.5).toFixed(1) + '× (currently ' + getPrestigeMult().toFixed(1) + '×)';
    }
}

// ═══════════════════════════════════════
//  SEASONS
// ═══════════════════════════════════════
function tickSeason(dt) {
    const biome = BIOMES[state.biomeIdx]; if (biome.noSeasons) { updateSeasonBar(); return; }
    state.seasonTimer += dt;
    const dur = SEASONS[state.seasonIdx].duration;
    if (state.seasonTimer >= dur) { state.seasonTimer -= dur; const prev = state.seasonIdx; state.seasonIdx = (state.seasonIdx + 1) % SEASONS.length; if (prev === 3) state.winterSurvived = true; onSeasonChange(); }
    if (state.seasonIdx === 3 && state.totalEarned > 100) state.winterSurvived = true;
    updateSeasonBar();
}
function onSeasonChange() {
    const s = SEASONS[state.seasonIdx]; tick(s.emoji + ' ' + s.name + ' begins. ' + s.desc + '.', true);
    const flash = document.getElementById('flash-overlay');
    flash.style.background = s.color; flash.style.opacity = '0.1';
    setTimeout(() => { flash.style.opacity = '0'; flash.style.background = '#1D9E75'; }, 400);
}
function updateSeasonBar() {
    const biome = BIOMES[state.biomeIdx], season = SEASONS[state.seasonIdx], ns = biome.noSeasons;
    document.getElementById('season-bar').style.borderColor = ns ? '#1D9E7320' : season.color + '55';
    document.getElementById('season-name-row').textContent = ns ? '— No Seasons' : season.emoji + ' ' + season.name;
    document.getElementById('season-desc').textContent = ns ? 'The deep ocean ignores the surface.' : season.desc;
    const pct = ns ? 100 : (state.seasonTimer / season.duration) * 100;
    document.getElementById('season-fill').style.width = pct + '%';
    document.getElementById('season-fill').style.background = ns ? '#1D9E7560' : season.color;
    const rem = Math.max(0, Math.ceil(season.duration - state.seasonTimer)), m = Math.floor(rem / 60), sec = rem % 60;
    document.getElementById('season-time').textContent = ns ? '—' : m + ':' + String(sec).padStart(2, '0');

    // Season tooltip
    const tipWrap = document.getElementById('season-tip-wrap');
    if (ns) { tipWrap.style.display = 'none'; return; }
    tipWrap.style.display = 'inline-flex';
    const PROD_NAMES = { threads: 'Threads', fruiting: 'Fruiting Bodies', woodweb: 'Wood Wide Web', sporestorm: 'Spore Storm', undercity: 'Underground City', cordyceps: 'Cordyceps', planetary: 'Planetary', voidspore: 'Void Spore', lichenveil: 'Lichen Veil', dreamweb: 'Dream Mycelium', satellite: 'Satellite', crystal: 'Hivemind Crystal', rootsing: 'Root Singularity', temporal: 'Temporal Thread', stellar: 'Stellar Mycelium', consciousness: 'Consciousness Web', dimensional: 'Dimensional Rot', eternalspore: 'Eternal Spore', galactic: 'Galactic Lattice', absolute: 'The Absolute' };
    const slines = [];
    Object.entries(season.mults).forEach(([id, v]) => {
        slines.push((v >= 1 ? '▲ ' : '▼ ') + (PROD_NAMES[id] || id) + ' ' + (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%');
    });
    document.getElementById('season-tooltip-text').textContent = slines.join('\n');
}

// ═══════════════════════════════════════
//  EVENTS
// ═══════════════════════════════════════
function tickEvents(dt) {
    if (state.activeEvent) {
        state.activeEvent.elapsed += dt;
        const ev = state.activeEvent, rem = Math.max(0, ev.duration - ev.elapsed), pct = (ev.elapsed / ev.duration) * 100;
        const toast = document.getElementById('event-toast'); toast.style.display = 'block';
        document.getElementById('event-title').textContent = ev.emoji + ' ' + ev.name;
        document.getElementById('event-timer').textContent = Math.ceil(rem) + 's';
        document.getElementById('event-desc-txt').textContent = ev.desc;
        document.getElementById('event-bar-fill').style.width = (100 - pct) + '%';
        document.getElementById('event-bar-fill').style.background = ev.color;
        toast.style.borderColor = ev.color + '66';
        // Populate event tooltip
        const tipEl = document.getElementById('event-tooltip-text');
        const lines = [];
        if (ev.globalMult) lines.push('★ All output ×' + ev.globalMult);
        if (ev.bonusSpores) lines.push('★ Bonus spores on start');
        if (ev.stealPct) lines.push('⚠ Steals ' + (ev.stealPct * 100) + '% stored spores');
        const PROD_NAMES = { threads: 'Threads', fruiting: 'Fruiting Bodies', woodweb: 'Wood Wide Web', sporestorm: 'Spore Storm', undercity: 'Underground City', cordyceps: 'Cordyceps', lichenveil: 'Lichen Veil', satellite: 'Satellite', stellar: 'Stellar Mycelium', galactic: 'Galactic Lattice' };
        Object.entries(ev.mults || {}).forEach(([id, v]) => {
            const name = PROD_NAMES[id] || id;
            lines.push((v >= 1 ? '▲ ' : '▼ ') + name + ' ' + (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%');
        });
        tipEl.textContent = lines.join('\n');
        if (ev.elapsed >= ev.duration) { state.activeEvent = null; state.eventCooldown = state.disasterMode ? 60 + Math.random() * 50 : 90 + Math.random() * 60; toast.style.display = 'none'; }
        return;
    }
    state.eventCooldown -= dt;
    if (state.eventCooldown <= 0) fireEvent();
}
function fireEvent() {
    const pool = state.disasterMode ? [...EVENTS_POSITIVE, ...EVENTS_NEGATIVE] : EVENTS_POSITIVE;
    const ev = { ...pool[Math.floor(Math.random() * pool.length)], elapsed: 0 };
    state.activeEvent = ev;
    if (ev.bonusSpores) { const b = ev.bonusSpores * getPrestigeMult() * getResearchMults().prod; state.spores += b; state.totalEarned += b; }
    if (ev.stealPct) { const l = state.spores * ev.stealPct; state.spores = Math.max(0, state.spores - l); }
    tick(ev.emoji + ' ' + ev.name + '! ' + ev.desc, true);
}

function tryUnlockHidden(id) {
    if (state.achievementsUnlocked.includes(id)) return;
    const def = HIDDEN_ACHS.find(a => a.id === id);
    if (!def) return;
    state.achievementsUnlocked.push(id);
    invalidateMults();
    showAchToast(def);
    lastAchKey = null;
}

// ═══════════════════════════════════════
//  ACHIEVEMENT TOASTS
// ═══════════════════════════════════════
const achToastQueue = [];
let achToastBusy = false;
function showAchToast(def) { achToastQueue.push(def); if (!achToastBusy) processAchToastQueue(); }
function processAchToastQueue() {
    if (!achToastQueue.length) { achToastBusy = false; return; }
    achToastBusy = true;
    const def = achToastQueue.shift();
    const container = document.getElementById('ach-toast-container');
    const toast = document.createElement('div');
    toast.className = 'ach-toast' + (def.hidden ? ' golden' : '');
    toast.innerHTML = `<span class="ach-toast-emoji">${def.emoji}</span><div class="ach-toast-body"><div class="ach-toast-label">${def.hidden ? '✦ Secret Achievement' : 'Achievement Unlocked'}</div><div class="ach-toast-name">${def.name}</div>${def.bonusDesc ? `<div class="ach-toast-bonus">${def.bonusDesc}</div>` : ''}</div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('leaving'); setTimeout(() => { toast.remove(); setTimeout(processAchToastQueue, 200); }, 300); }, 3000);
}

// ═══════════════════════════════════════
//  ACHIEVEMENTS + GOALS TAB
// ═══════════════════════════════════════
let lastAchKey = null;
function checkAchievements() {
    let changed = false;
    ALL_ACHS.forEach(def => { if (state.achievementsUnlocked.includes(def.id)) return; if (def.req(state)) { state.achievementsUnlocked.push(def.id); changed = true; invalidateMults(); showAchToast(def); } });
    if (changed) buildGoals();
}
function buildGoals() {
    const key = state.achievementsUnlocked.join(',') + '|' + state.totalEarned.toFixed(0) + '|' + state.biomesVisited.join(',');
    if (key === lastAchKey) return; lastAchKey = key;
    const c = document.getElementById('tab-goals'); c.innerHTML = '';
    const majorUnlocked = MAJOR_ACHS.filter(a => state.achievementsUnlocked.includes(a.id)).length;
    const mhdr = document.createElement('div'); mhdr.className = 'goals-section-hdr';
    mhdr.innerHTML = `<span>Major Achievements</span><span class="goals-section-count">${majorUnlocked} / ${MAJOR_ACHS.length}</span>`;
    c.appendChild(mhdr);
    const grid = document.createElement('div'); grid.className = 'ach-grid';
    MAJOR_ACHS.forEach(def => { const unlocked = state.achievementsUnlocked.includes(def.id); const card = document.createElement('div'); card.className = 'ach-card ' + (unlocked ? 'unlocked' : 'locked'); card.innerHTML = `<div class="ach-top"><span class="ach-emoji">${def.emoji}</span><span class="ach-name">${def.name}</span></div><div class="ach-desc">${def.desc}</div><div class="ach-bonus">${def.bonusDesc}</div>${unlocked && def.lore ? `<div class="ach-lore">${def.lore}</div>` : ''}`; grid.appendChild(card); });
    c.appendChild(grid);
    const biomeUnlocked = BIOME_ACHS.filter(a => state.achievementsUnlocked.includes(a.id)).length;
    const bhdr = document.createElement('div'); bhdr.className = 'goals-section-hdr'; bhdr.innerHTML = `<span>Biomes Explored</span><span class="goals-section-count">${biomeUnlocked} / ${BIOME_ACHS.length}</span>`; c.appendChild(bhdr);
    const biomeRow = document.createElement('div'); biomeRow.className = 'biome-ach-row';
    BIOME_ACHS.forEach(def => { const unlocked = state.achievementsUnlocked.includes(def.id); const card = document.createElement('div'); card.className = 'biome-ach-card ' + (unlocked ? 'unlocked' : 'locked'); card.innerHTML = `<span class="biome-ach-emoji">${def.emoji}</span><div class="biome-ach-name">${BIOMES.find(b => b.id === def.id.replace('biome_', ''))?.name || def.name}</div>`; biomeRow.appendChild(card); });
    c.appendChild(biomeRow);
    const pmUnlocked = PRODUCER_ACHS.filter(a => state.achievementsUnlocked.includes(a.id)).length;
    const phdr = document.createElement('div'); phdr.className = 'goals-section-hdr'; phdr.innerHTML = `<span>Producer Mastery</span><span class="goals-section-count">${pmUnlocked} / ${PRODUCER_ACHS.length}</span>`; c.appendChild(phdr);
    PRODUCERS_DEF.forEach(pr => { const row = document.createElement('div'); row.className = 'pm-row'; const nameSpan = document.createElement('span'); nameSpan.className = 'pm-name'; nameSpan.textContent = pr.emoji + ' ' + pr.name; row.appendChild(nameSpan); const badges = document.createElement('div'); badges.className = 'pm-badges'; PROD_MILESTONES.forEach(n => { const id = `pm_${pr.id}_${n}`; const unlocked = state.achievementsUnlocked.includes(id); const hasBonus = !!PROD_MILESTONE_BONUSES[n]; const badge = document.createElement('span'); badge.className = 'pm-badge' + (unlocked ? ' done' : '') + (hasBonus ? ' bonus' : ''); badge.title = n + ' owned' + (hasBonus ? ' · ' + PROD_MILESTONE_BONUSES[n].desc : ''); badge.textContent = n >= 1000 ? fmt(n) : n; badges.appendChild(badge); }); row.appendChild(badges); c.appendChild(row); });
    // ── Hidden Achievements ──
    const hiddenUnlocked = HIDDEN_ACHS.filter(a => state.achievementsUnlocked.includes(a.id)).length;
    const hhdr = document.createElement('div'); hhdr.className = 'goals-section-hdr';
    hhdr.innerHTML = `<span>✦ Secret Achievements</span><span class="goals-section-count">${hiddenUnlocked} / ${HIDDEN_ACHS.length}</span>`;
    c.appendChild(hhdr);
    const hgrid = document.createElement('div'); hgrid.className = 'ach-grid'; c.appendChild(hgrid);
    HIDDEN_ACHS.forEach(def => {
        const unlocked = state.achievementsUnlocked.includes(def.id);
        const card = document.createElement('div');
        if (unlocked) {
            card.className = 'ach-card unlocked golden-card';
            card.innerHTML = `<div class="ach-top"><span class="ach-emoji">${def.emoji}</span><span class="ach-name">${def.name}</span></div><div class="ach-desc">${def.desc}</div><div class="ach-bonus">${def.bonusDesc}</div>${def.lore ? `<div class="ach-lore">${def.lore}</div>` : ''}`;
        } else {
            card.className = 'ach-card locked hidden-mystery';
            card.innerHTML = `<div class="ach-top"><span class="ach-emoji">?</span><span class="ach-name">???</span></div><div class="ach-desc">Secret achievement — keep playing to discover it.</div>`;
        }
        hgrid.appendChild(card);
    });
}

// ═══════════════════════════════════════
//  CODEX / LORE
// ═══════════════════════════════════════
let lastCodexKey = null;
function buildCodex() {
    const ids = CODEX_DEF.filter(x => x.unlockAt(state)).map(x => x.id).join(',');
    if (ids === lastCodexKey) return; lastCodexKey = ids;
    const c = document.getElementById('tab-lore'); c.innerHTML = '';
    CODEX_DEF.forEach(def => { const unlocked = def.unlockAt(state); const entry = document.createElement('div'); entry.className = 'codex-entry'; entry.innerHTML = unlocked ? `<div class="codex-title">— ${def.title} —</div><div class="codex-text">${def.text}</div>` : `<div class="codex-locked">[ ${def.title} — not yet revealed ]</div>`; c.appendChild(entry); });
}

// ═══════════════════════════════════════
//  RESEARCH TREE
// ═══════════════════════════════════════
let lastResearchKey = null;
function buildResearch() {
    const key = state.research.map(r => r.bought ? '1' : '0').join('');
    if (key === lastResearchKey) return; lastResearchKey = key;
    const c = document.getElementById('tab-research'); c.innerHTML = '';
    [1, 2, 3, 4, 5, 6].forEach(tier => {
        const nodes = RESEARCH_DEF.filter(r => r.tier === tier);
        const lbl = document.createElement('div'); lbl.className = 'research-tier-label'; lbl.textContent = 'Tier ' + tier; c.appendChild(lbl);
        if (tier > 1) { const conn = document.createElement('div'); conn.className = 'rn-connector'; conn.textContent = '↓  ↓'; c.appendChild(conn); }
        const row = document.createElement('div'); row.className = 'research-nodes';
        nodes.forEach(def => {
            const sr = state.research.find(r => r.id === def.id);
            const pre = def.prereqs.every(pid => state.research.find(r => r.id === pid)?.bought);
            const bought = sr?.bought;
            const card = document.createElement('div'); card.className = 'rn-card' + (bought ? ' bought' : '') + ((!pre && !bought) ? ' locked' : ''); card.dataset.rid = def.id;
            card.innerHTML = `<div class="rn-name">${def.name}</div><div class="rn-desc">${def.desc}</div><div class="rn-cost">${bought ? '' : fmt(def.cost) + ' sp'}</div>`;
            if (bought) { const b = document.createElement('div'); b.className = 'rn-bought-badge'; b.textContent = '✦ Researched'; card.appendChild(b); }
            else if (pre) { const btn = document.createElement('button'); btn.className = 'rn-btn'; btn.type = 'button'; btn.textContent = 'Research'; btn.dataset.rcost = def.cost; btn.disabled = state.spores < def.cost; btn.addEventListener('click', () => buyResearch(def.id)); card.appendChild(btn); }
            else { const lk = document.createElement('div'); lk.style.cssText = 'font-size:10px;color:#3a5e42;margin-top:3px'; lk.textContent = 'Requires: ' + def.prereqs.map(pid => RESEARCH_DEF.find(r => r.id === pid)?.name || pid).join(', '); card.appendChild(lk); }
            row.appendChild(card);
        });
        c.appendChild(row);
    });
}
function updateResearch() { document.querySelectorAll('#tab-research .rn-btn').forEach(btn => { btn.disabled = state.spores < Number(btn.dataset.rcost); }); }
function buyResearch(id) {
    const def = RESEARCH_DEF.find(d => d.id === id), sr = state.research.find(r => r.id === id);
    if (!def || sr.bought || state.spores < def.cost) return;
    state.spores -= def.cost; sr.bought = true; invalidateMults(); lastResearchKey = null;
    buildResearch(); updateResearch(); updateStats();
}

// ═══════════════════════════════════════
//  BIOME PATH
// ═══════════════════════════════════════
function updateBiomePath() { /* biome stepper removed — current biome shown in stats tab and sporulate panel */ }

// ═══════════════════════════════════════
//  PRODUCERS
// ═══════════════════════════════════════
let buyQty = 1;

function maxAffordable(pr) {
    const cost = getCost(pr); if (state.spores < cost) return 0;
    let n = 0, lo = 1, hi = 10000;
    while (lo <= hi) { const mid = Math.floor((lo + hi) / 2); let total = 0, o = pr.owned; for (let i = 0; i < mid; i++)total += Math.ceil(pr.baseCost * Math.pow(1.15, o++) * getResearchMults().cost); if (total <= state.spores) { n = mid; lo = mid + 1; } else hi = mid - 1; }
    return n;
}

function buildQtyBar(container) {
    const old = container.querySelector('#qty-bar'); if (old) old.remove();
    const qrow = document.createElement('div'); qrow.id = 'qty-bar';
    qrow.style.cssText = 'display:flex;gap:5px;padding:8px 12px 6px;border-bottom:1px solid #1D9E7518;flex-shrink:0;';
    [1, 5, 10, 'max'].forEach(q => {
        const btn = document.createElement('button'); btn.type = 'button';
        btn.textContent = q === 'max' ? 'Max' : '×' + q; btn.dataset.qty = String(q);
        btn.style.cssText = 'flex:1;padding:5px 2px;border-radius:6px;border:1px solid #1D9E7530;background:transparent;color:#6a9d75;font-size:11px;font-weight:500;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;font-family:inherit;transition:background 0.1s,color 0.1s,border-color 0.1s;';
        const isActive = (q === 'max' && buyQty === 'max') || (q !== 'max' && buyQty === q);
        if (isActive) applyQtyActive(btn);
        btn.addEventListener('click', () => { buyQty = q === 'max' ? 'max' : Number(q); document.querySelectorAll('#qty-bar button').forEach(b => clearQtyActive(b)); applyQtyActive(btn); updateProducers(); });
        qrow.appendChild(btn);
    });
    container.insertBefore(qrow, container.firstChild);
}
function applyQtyActive(btn) { btn.style.background = '#1D9E7520'; btn.style.color = '#9FE1CB'; btn.style.borderColor = '#1D9E7560'; }
function clearQtyActive(btn) { btn.style.background = 'transparent'; btn.style.color = '#6a9d75'; btn.style.borderColor = '#1D9E7530'; }

function buildProducers() {
    const c = document.getElementById('tab-producers'); c.innerHTML = '';
    state.producers.forEach(pr => {
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'item disabled'; btn.dataset.id = pr.id;
        btn.innerHTML = `<div class="item-top"><span class="item-name">${pr.emoji} ${pr.name}</span><span class="item-cost" data-cost></span></div><div class="item-desc">${pr.desc}</div><div class="item-owned" data-owned></div>`;
        btn.addEventListener('click', () => buyProducer(pr.id)); c.appendChild(btn);
    });
    buildQtyBar(c);
}
function updateProducers() {
    state.producers.forEach(pr => {
        const btn = document.querySelector(`#tab-producers [data-id="${pr.id}"]`); if (!btn) return;
        const singleCost = getCost(pr);
        let totalCost = singleCost, qty = 1, can = false;
        if (buyQty === 'max') { qty = maxAffordable(pr); if (qty === 0) { totalCost = singleCost; can = false; } else { let o = pr.owned, total = 0; for (let i = 0; i < qty; i++)total += Math.ceil(pr.baseCost * Math.pow(1.15, o++) * getResearchMults().cost); totalCost = total; can = true; } }
        else { qty = buyQty; let o = pr.owned, total = 0; for (let i = 0; i < qty; i++)total += Math.ceil(pr.baseCost * Math.pow(1.15, o++) * getResearchMults().cost); totalCost = total; can = state.spores >= total; }
        btn.classList.toggle('disabled', !can); btn.classList.toggle('can-afford', can);
        btn.querySelector('[data-cost]').textContent = buyQty === 1 ? fmt(singleCost) + ' sp' : fmt(totalCost) + ' sp (×' + (buyQty === 'max' ? qty : buyQty) + ')';
        const sps = pr.baseSps * getSeasonMult(pr.id) * BIOMES[state.biomeIdx].prodMult * getPrestigeMult() * getResearchMults().prod * getAchievementMults().prod;
        btn.querySelector('[data-owned]').textContent = `Owned: ${pr.owned}  ·  +${fmtSps(sps)}/s each`;
    });
}
function buyProducer(id) {
    const pr = p(state, id);
    const qty = buyQty === 'max' ? maxAffordable(pr) : buyQty; if (qty === 0) return;
    for (let i = 0; i < qty; i++) { const cost = getCost(pr); if (state.spores < cost) break; state.spores -= cost; pr.owned++; }
    updateProducers(); updateStats();
}

// ═══════════════════════════════════════
//  UPGRADES + OWNED
// ═══════════════════════════════════════
let lastUpgradeKey = null, lastOwnedKey = null, upgradeSubTab = 'available';

function switchUpgradeSub(which) {
    upgradeSubTab = which;
    document.getElementById('subtab-available').classList.toggle('active', which === 'available');
    document.getElementById('subtab-owned').classList.toggle('active', which === 'owned');
    document.getElementById('upgrades-available-list').style.display = which === 'available' ? 'block' : 'none';
    document.getElementById('upgrades-owned-list').style.display = which === 'owned' ? 'block' : 'none';
}
function buildUpgrades() {
    const visible = UPGRADES_DEF.filter(u => { const su = state.upgrades.find(x => x.id === u.id); return !su.bought && u.req(state); });
    const key = visible.map(u => u.id).join(',') || '__empty__';
    if (key === lastUpgradeKey) return; lastUpgradeKey = key;
    const c = document.getElementById('upgrades-available-list'); c.innerHTML = '';
    if (!visible.length) { c.innerHTML = '<div style="padding:1rem;font-size:12px;color:#4a7a55;font-style:italic">Keep growing to unlock upgrades...</div>'; return; }
    visible.forEach(u => { const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'item disabled'; btn.dataset.id = u.id; btn.innerHTML = `<div class="item-top"><span class="item-name">✦ ${u.name}<span class="badge">${TIER_LABELS[u.tier] || ''}</span></span><span class="item-cost" data-cost></span></div><div class="item-desc">${u.desc}</div>`; btn.addEventListener('click', () => buyUpgrade(u.id)); c.appendChild(btn); });
}
function updateUpgrades() {
    document.querySelectorAll('#upgrades-available-list [data-id]').forEach(btn => { const u = UPGRADES_DEF.find(x => x.id === btn.dataset.id); if (!u) return; const can = state.spores >= u.cost; btn.classList.toggle('disabled', !can); btn.classList.toggle('can-afford', can); btn.querySelector('[data-cost]').textContent = fmt(u.cost) + ' sp'; });
}
function buyUpgrade(id) {
    const uDef = UPGRADES_DEF.find(x => x.id === id), su = state.upgrades.find(x => x.id === id);
    if (!uDef || su.bought || state.spores < uDef.cost) return;
    state.spores -= uDef.cost; su.bought = true; uDef.apply(state);
    lastUpgradeKey = null; lastOwnedKey = null;
    buildUpgrades(); updateUpgrades(); buildOwned(); updateStats();
}
function buildOwned() {
    const bought = UPGRADES_DEF.filter(u => state.upgrades.find(x => x.id === u.id)?.bought);
    const key = bought.map(u => u.id).join(',') || '__none__';
    if (key === lastOwnedKey) return; lastOwnedKey = key;
    const c = document.getElementById('upgrades-owned-list'); c.innerHTML = '';
    if (!bought.length) { c.innerHTML = '<div style="padding:1rem;font-size:12px;color:#4a7a55;font-style:italic">No upgrades purchased yet.</div>'; return; }
    const groups = {}; bought.forEach(u => { if (!groups[u.tier]) groups[u.tier] = []; groups[u.tier].push(u); });
    Object.entries(groups).forEach(([tier, upgrades]) => { const lbl = document.createElement('div'); lbl.className = 'owned-group'; lbl.textContent = TIER_LABELS[tier] || tier; c.appendChild(lbl); upgrades.forEach(u => { const row = document.createElement('div'); row.className = 'owned-row'; row.innerHTML = `<div class="owned-name">✦ ${u.name}</div><div class="owned-desc">${u.desc}</div>`; c.appendChild(row); }); });
}

// ═══════════════════════════════════════
//  BONDS (SYMBIOSIS)
// ═══════════════════════════════════════
let lastSymKey = null;
// Only include unlock threshold flips, not raw totalEarned — prevents DOM rebuild every tick
function symKey() {
    const unlockFlags = SYMBIONTS.map(d => state.totalEarned >= d.unlockAt ? '1' : '0').join('');
    return state.symbiosis.map(s => `${s.id}:${s.active}:${s.hungry}:${s.broken}`).join('|') + '|' + unlockFlags;
}
function buildSymbiosis() {
    const c = document.getElementById('tab-bonds'); c.innerHTML = '';
    SYMBIONTS.forEach((def, i) => { const card = document.createElement('div'); card.className = 'sym-card'; card.innerHTML = `<div class="sym-top"><span class="sym-name">${def.emoji} ${def.name}</span><span class="sym-status-badge locked" data-sym-status="${def.id}">Locked</span></div><div class="sym-desc">${def.desc}</div><div class="sym-stats">+${def.bonusSps}/s &nbsp;·&nbsp; Feed ${fmt(def.feedCost)} sp every ${def.feedEvery}s &nbsp;·&nbsp; Pact: ${fmt(def.pactCost)} sp</div><div data-sym-actions="${def.id}"></div><div class="sym-feed-track" data-sym-track="${def.id}" style="display:none"><div class="sym-feed-fill" data-sym-fill="${def.id}"></div></div>`; c.appendChild(card); });
}
function updateSymbiosis() {
    const key = symKey(), rebuild = key !== lastSymKey; lastSymKey = key;
    SYMBIONTS.forEach((def, i) => { const sym = state.symbiosis[i], unlocked = state.totalEarned >= def.unlockAt; const statusEl = document.querySelector(`[data-sym-status="${def.id}"]`); const actionsEl = document.querySelector(`[data-sym-actions="${def.id}"]`); const trackEl = document.querySelector(`[data-sym-track="${def.id}"]`); const fillEl = document.querySelector(`[data-sym-fill="${def.id}"]`); if (!statusEl) return; let sc = 'locked', st = 'Locked'; if (unlocked && !sym.active && !sym.broken) { sc = 'available'; st = 'Available'; } else if (sym.active && !sym.hungry) { sc = 'active'; st = 'Active'; } else if (sym.hungry) { sc = 'hungry'; st = 'Hungry!'; } else if (sym.broken) { sc = 'broken'; st = 'Bond Broken'; } statusEl.className = 'sym-status-badge ' + sc; statusEl.textContent = st; if (rebuild) { actionsEl.innerHTML = ''; if (unlocked && !sym.active && !sym.broken) { const btn = document.createElement('button'); btn.className = 'sym-btn pact'; btn.type = 'button'; btn.textContent = `Form Pact (${fmt(def.pactCost)} sp)`; btn.disabled = state.spores < def.pactCost; btn.addEventListener('click', () => formPact(i)); actionsEl.appendChild(btn); } else if (sym.hungry) { const btn = document.createElement('button'); btn.className = 'sym-btn feed'; btn.type = 'button'; btn.textContent = `Feed (${fmt(def.feedCost)} sp)`; btn.disabled = state.spores < def.feedCost; btn.addEventListener('click', () => feedSymbiont(i)); actionsEl.appendChild(btn); } else if (sym.broken && unlocked) { const btn = document.createElement('button'); btn.className = 'sym-btn restore'; btn.type = 'button'; btn.textContent = `Restore Pact (${fmt(def.pactCost)} sp)`; btn.disabled = state.spores < def.pactCost; btn.addEventListener('click', () => formPact(i)); actionsEl.appendChild(btn); } } else { const btn = actionsEl.querySelector('button'); if (btn) btn.disabled = state.spores < (sym.hungry ? def.feedCost : def.pactCost); } if (sym.active) { trackEl.style.display = 'block'; const pct = Math.min(100, (sym.feedTimer / def.feedEvery) * 100); fillEl.style.width = pct + '%'; fillEl.style.background = sym.hungry ? '#EF9F27' : '#5DCAA5'; } else trackEl.style.display = 'none'; });
}
function tickSymbiosis(dt) {
    state.symbiosis.forEach((sym, i) => { if (!sym.active || sym.broken) return; const def = SYMBIONTS[i]; sym.feedTimer += dt; if (!sym.hungry && sym.feedTimer >= def.feedEvery) { sym.hungry = true; tick(`${def.emoji} ${def.name} is hungry! Feed it to keep your bond.`, true); lastSymKey = null; } if (sym.hungry && sym.feedTimer >= def.feedEvery + 30) { sym.broken = true; sym.active = false; tick(`💔 Bond with ${def.name} broken. Restore the pact to reconnect.`, true); lastSymKey = null; } });
}
function formPact(i) { const def = SYMBIONTS[i], sym = state.symbiosis[i]; if (state.spores < def.pactCost) return; state.spores -= def.pactCost; sym.active = true; sym.hungry = false; sym.feedTimer = 0; sym.broken = false; lastSymKey = null; updateSymbiosis(); updateStats(); }
function feedSymbiont(i) { const def = SYMBIONTS[i], sym = state.symbiosis[i]; if (!sym.hungry || state.spores < def.feedCost) return; state.spores -= def.feedCost; sym.hungry = false; sym.feedTimer = 0; lastSymKey = null; updateSymbiosis(); updateStats(); }

// ═══════════════════════════════════════
//  EFFECTS
// ═══════════════════════════════════════
function spawnBurst(x, y, val) {
    const label = document.createElement('div'); label.className = 'particle'; label.textContent = '+' + fmt(val);
    label.style.left = (x - 22) + 'px'; label.style.top = (y - 12) + 'px'; label.style.setProperty('--dx', '0px'); label.style.setProperty('--dy', '-60px');
    document.body.appendChild(label); setTimeout(() => label.remove(), 1000);
    const count = Math.min(7 + Math.floor(Math.log10(Math.max(val, 1))), 14);
    for (let i = 0; i < count; i++) { const angle = (i / count) * Math.PI * 2, dist = 38 + Math.random() * 32; const dot = document.createElement('div'); dot.className = 'particle dot'; dot.style.left = (x - 3) + 'px'; dot.style.top = (y - 3) + 'px'; dot.style.setProperty('--dx', Math.cos(angle) * dist + 'px'); dot.style.setProperty('--dy', Math.sin(angle) * dist - 22 + 'px'); dot.style.animationDuration = (0.6 + Math.random() * 0.4) + 's'; document.body.appendChild(dot); setTimeout(() => dot.remove(), 1100); }
}
function spawnPulseRing() { const ring = document.createElement('div'); ring.className = 'pulse-ring'; document.getElementById('btn-wrap').appendChild(ring); setTimeout(() => ring.remove(), 750); }
function screenShake() { const game = document.getElementById('game'), flash = document.getElementById('flash-overlay'); game.classList.remove('shake'); void game.offsetWidth; game.classList.add('shake'); flash.style.background = '#1D9E75'; flash.style.opacity = '0.12'; setTimeout(() => { flash.style.opacity = '0'; }, 130); setTimeout(() => game.classList.remove('shake'), 450); }
function triggerPulse() {
    // Check Overclock before resetting hivemind
    if (Date.now() - _hivemindZeroAt <= 30000) tryUnlockHidden('h2');
    // Mind Meld: 3 pulses within 2 minutes
    const now = Date.now();
    _recentPulseTs = _recentPulseTs.filter(t => now - t < 120000); _recentPulseTs.push(now);
    if (_recentPulseTs.length >= 3) tryUnlockHidden('h8');
    state.hivemind = 0; _hivemindZeroAt = Date.now();
    state.allTimePulses++;
    const bonus = Math.ceil((getSps() * 30 + getClickValue() * 50) * getPulseMult());
    state.spores += bonus; state.totalEarned += bonus;
    tick('HIVEMIND PULSE! +' + fmt(bonus) + ' spores surged through the network!', true);
    screenShake(); spawnPulseRing(); spawnPulseRing(); setTimeout(spawnPulseRing, 160);
}

let _tickerTimer = null;
function tick(msg, highlight = false) { const el = document.getElementById('ticker'); el.textContent = msg; if (highlight) { el.classList.add('pulse-msg'); clearTimeout(_tickerTimer); _tickerTimer = setTimeout(() => el.classList.remove('pulse-msg'), 3000); } }

// ═══════════════════════════════════════
//  STATS
// ═══════════════════════════════════════
function updateStats() {
    document.getElementById('total-spores').textContent = fmt(state.spores);
    document.getElementById('sps').textContent = fmt(getSps()) + '/s';
    const pulseOn = state.hivemindUnlocked;
    document.getElementById('progress-bar').style.display = pulseOn ? 'block' : 'none';
    document.getElementById('pulse-info').style.display = pulseOn ? 'block' : 'none';
    document.getElementById('pulse-locked').style.display = pulseOn ? 'none' : 'block';
    if (pulseOn) { document.getElementById('progress-fill').style.width = state.hivemind + '%'; const predicted = Math.ceil((getSps() * 30 + getClickValue() * 50) * getPulseMult()); document.getElementById('pulse-info').textContent = `Hivemind pulse: ${Math.floor(state.hivemind)}% · Next pulse: +${fmt(predicted)} sp`; }
    updateBiomeBar();
}

let _lastBiomeIdx = -1;
function updateBiomeBar() {
    if (state.biomeIdx === _lastBiomeIdx) return;
    _lastBiomeIdx = state.biomeIdx;
    const b = BIOMES[state.biomeIdx];
    document.getElementById('biome-bar-emoji').textContent = b.emoji;
    document.getElementById('biome-bar-name').textContent = b.name;
    // Tooltip lines
    const lines = [];
    lines.push('Click \xD7' + b.clickMult);
    lines.push('Producers \xD7' + b.prodMult);
    if (b.noSeasons) lines.push('No seasonal effects');
    if (b.arcticMode) lines.push('Winter bonuses \xD72 \xB7 Summer halved');
    if (b.swampMode) lines.push('Season swings amplified \xD71.5');
    if (b.volcanicMode) lines.push('Spring & Fall surge \xB7 Summer & Winter penalised');
    document.getElementById('biome-tooltip-text').textContent = lines.join('\n');
}

// ═══════════════════════════════════════
//  STATS TAB
// ═══════════════════════════════════════
let lastStatsKey = null;
function buildStats() {
    const allTimeTotal = (state.allTimeSporesBase || 0) + state.totalEarned;
    const threshold = sporulationThreshold();
    const pct = Math.min(100, (state.totalEarned / threshold) * 100);
    const key = [
        Math.floor(allTimeTotal), state.prestigeCount,
        state.allTimeClicks, state.clicksThisPrestige,
        Math.floor(pct)
    ].join('|');
    if (key === lastStatsKey) return;
    lastStatsKey = key;

    const c = document.getElementById('tab-stats');
    c.innerHTML = '';

    function makeSection(title) {
        const hdr = document.createElement('div');
        hdr.className = 'stats-section-hdr';
        hdr.textContent = title;
        c.appendChild(hdr);
        const grid = document.createElement('div');
        grid.className = 'stats-grid';
        c.appendChild(grid);
        return grid;
    }

    function addStat(grid, label, value, sub) {
        const card = document.createElement('div');
        card.className = 'stats-card';
        card.innerHTML = '<div class="stats-card-label">' + label + '</div>'
            + '<div class="stats-card-val">' + value + '</div>'
            + (sub ? '<div class="stats-card-sub">' + sub + '</div>' : '');
        grid.appendChild(card);
    }

    // ── This Prestige ──
    const g2 = makeSection('🌱 This Prestige');
    addStat(g2, 'Spores Earned', fmt(state.totalEarned), 'this run');
    addStat(g2, 'Clicks', fmt(state.clicksThisPrestige || 0), 'this run');
    addStat(g2, 'Prestige #', state.prestigeCount === 0 ? 'First Run' : '#' + state.prestigeCount, state.prestigeCount === 0 ? 'sporulate to ascend' : 'current run');
    addStat(g2, 'Spores / sec', fmt(getSps()) + '/s', 'current rate');

    // ── All-Time ──
    const g1 = makeSection('✦ All-Time');
    addStat(g1, 'Spores Earned', fmt(allTimeTotal), 'across all prestiges');
    addStat(g1, 'Total Clicks', fmt(state.allTimeClicks || 0), 'all prestiges');
    addStat(g1, 'Times Sporulated', state.prestigeCount > 0 ? state.prestigeCount : '—', state.prestigeCount > 0 ? 'sporulations' : 'not yet');
    addStat(g1, 'Legacy Multiplier', getPrestigeMult().toFixed(1) + '×', state.prestigeCount === 0 ? 'no bonus yet' : '+' + (state.prestigeCount * 50) + '% production');

    // ── Next Sporulation — only shown after the first prestige ──
    if (state.prestigeCount >= 1) {
        const g3 = makeSection('🧬 Next Sporulation');
        const nextMult = (1 + (state.prestigeCount + 1) * 0.5).toFixed(1);
        const remaining = Math.max(0, threshold - state.totalEarned);
        const ready = canSporulate();

        const progCard = document.createElement('div');
        progCard.className = 'stats-card stats-card-wide';
        const pctLabel = ready ? '✦ Ready!' : Math.floor(pct) + '%';
        const subLabel = ready ? 'Open Sporulate panel to ascend' : fmt(remaining) + ' spores remaining';
        progCard.innerHTML = '<div class="stats-card-label">Spores needed to sporulate</div>'
            + '<div class="stats-sporulate-row">'
            + '<span class="stats-card-val">' + fmt(threshold) + '</span>'
            + '<span class="stats-sporulate-pct' + (ready ? ' ready' : '') + '">' + pctLabel + '</span>'
            + '</div>'
            + '<div class="stats-progress-track"><div class="stats-progress-fill' + (ready ? ' ready' : '') + '" style="width:' + pct + '%"></div></div>'
            + '<div class="stats-card-sub">' + subLabel + '</div>';
        g3.appendChild(progCard);

        addStat(g3, 'Next Legacy Mult', nextMult + '×', '+' + ((state.prestigeCount + 1) * 50) + '% production');
    }
}
// ═══════════════════════════════════════
const ALL_TABS = ['producers', 'upgrades', 'research', 'bonds', 'goals', 'lore', 'stats'];
function switchTab(tab) { ALL_TABS.forEach(t => { document.getElementById('tab-btn-' + t).classList.toggle('active', t === tab); document.getElementById('tab-' + t).classList.toggle('active', t === tab); }); }

// ═══════════════════════════════════════
//  MYCELIUM CANVAS
// ═══════════════════════════════════════
const canvas = document.getElementById('mycelium-canvas'), ctx = canvas.getContext('2d');
let branches = [], animTime = 0, lastTotal = -1;
function makeBranch(x1, y1, angle, len, depth, delay) { return { x1, y1, angle, len, depth, delay, progress: 0, children: [] }; }
function seedBranches(total) { const W = canvas.offsetWidth || 280, H = canvas.offsetHeight || 90, cx = W / 2, cy = H / 2; branches = []; const armCount = Math.min(4 + Math.floor(total / 3), 28); for (let i = 0; i < armCount; i++) { const ba = (i / armCount) * Math.PI * 2, len = 20 + (i % 5) * 8; const b = makeBranch(cx, cy, ba, len, 0, i * 0.04); if (total > 5) for (let j = 0; j < 2; j++) { const sa = ba + (j ? 0.5 : -0.5) + (Math.random() - 0.5) * 0.3; b.children.push(makeBranch(cx + Math.cos(ba) * len, cy + Math.sin(ba) * len * 0.6, sa, len * 0.55, 1, b.delay + 0.3)); } if (total > 15) b.children.forEach(child => { const ga = child.angle + (Math.random() - 0.5) * 0.6; child.children.push(makeBranch(child.x1 + Math.cos(child.angle) * child.len, child.y1 + Math.sin(child.angle) * child.len * 0.6, ga, child.len * 0.5, 2, child.delay + 0.25)); }); branches.push(b); } }
function drawBranch(b, t, alpha) { if (t < b.delay) return; b.progress = Math.min(1, (t - b.delay) / 0.6); const x2 = b.x1 + Math.cos(b.angle) * b.len * b.progress, y2 = b.y1 + Math.sin(b.angle) * b.len * b.progress * 0.6; const grad = ctx.createLinearGradient(b.x1, b.y1, x2, y2); grad.addColorStop(0, `rgba(29,158,117,${0.7 * alpha})`); grad.addColorStop(1, `rgba(159,225,203,${0.25 * alpha})`); ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(x2, y2); ctx.strokeStyle = grad; ctx.lineWidth = Math.max(0.4, 1.3 - b.depth * 0.45); ctx.stroke(); if (b.progress >= 1) { const pulse = 0.5 + 0.5 * Math.sin(t * 3 + b.angle * 7), r = 1.8 + pulse * 1.3; ctx.beginPath(); ctx.arc(x2, y2, r, 0, Math.PI * 2); ctx.fillStyle = `rgba(93,202,165,${(0.4 + pulse * 0.5) * alpha})`; ctx.fill(); } if (b.progress > 0.85) b.children.forEach(child => { child.x1 = b.x1 + Math.cos(b.angle) * b.len; child.y1 = b.y1 + Math.sin(b.angle) * b.len * 0.6; drawBranch(child, t, alpha * 0.75); }); }
function animateMycelium() { const W = canvas.offsetWidth || 280, H = canvas.offsetHeight || 90; const total = state.producers.reduce((s, x) => s + x.owned, 0); if (total !== lastTotal) { canvas.width = W; canvas.height = H; seedBranches(total); animTime = 0; lastTotal = total; } animTime += 0.016; canvas.width = W; canvas.height = H; ctx.clearRect(0, 0, W, H); const cx = W / 2, cy = H / 2, cp = 0.5 + 0.5 * Math.sin(animTime * 2.5); ctx.beginPath(); ctx.arc(cx, cy, 5 + cp, 0, Math.PI * 2); ctx.fillStyle = `rgba(29,158,117,${0.8 + cp * 0.2})`; ctx.fill(); if (total === 0) { ctx.beginPath(); ctx.arc(cx, cy, 10 + cp * 5, 0, Math.PI * 2); ctx.strokeStyle = `rgba(29,158,117,${0.15 + cp * 0.1})`; ctx.lineWidth = 0.8; ctx.stroke(); } else branches.forEach(b => drawBranch(b, animTime, 1)); requestAnimationFrame(animateMycelium); }

// ═══════════════════════════════════════
//  GAME LOOP
// ═══════════════════════════════════════
let msgTimer = 0;
function showMessage() { tick(MESSAGES[state.msgIdx % MESSAGES.length]); }

const DT = 0.05;
setInterval(() => {
    const sps = getSps(); if (sps > 0) { const g = sps * DT; state.spores += g; state.totalEarned += g; }
    tickSeason(DT); tickSymbiosis(DT); tickEvents(DT);
    updateStats(); updateProducers();
    buildUpgrades(); updateUpgrades();
    updateSymbiosis(); updateSporulateUI();
    checkAchievements(); buildGoals();
    buildCodex(); buildResearch(); updateResearch();
    updateBiomePath(); buildStats();
}, 50);
setInterval(() => { if (++msgTimer % 8 === 0 && !state.activeEvent) showMessage(); }, 1000);
setInterval(saveGame, 30000);

// ═══════════════════════════════════════
//  GESTURE & ZOOM BLOCKERS
// ═══════════════════════════════════════
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', e => e.preventDefault(), { passive: false });
document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// ═══════════════════════════════════════
//  SAVE ON BACKGROUND / CLOSE
// ═══════════════════════════════════════
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { state.lastSeen = Date.now(); saveGame(); }
    else { applyOfflineProgress(); }
});
document.addEventListener('pagehide', () => { state.lastSeen = Date.now(); saveGame(); });
document.addEventListener('beforeunload', () => { state.lastSeen = Date.now(); saveGame(); });

// ═══════════════════════════════════════
//  OFFLINE PROGRESS
// ═══════════════════════════════════════
const MAX_OFFLINE_SECONDS = 8 * 3600;
function applyOfflineProgress() {
    if (!state.lastSeen) return;
    const elapsed = Math.min((Date.now() - state.lastSeen) / 1000, MAX_OFFLINE_SECONDS);
    state.lastSeen = 0;
    if (elapsed < 10) return;
    const sps = getSps(); if (sps <= 0) return;
    const earned = sps * elapsed; state.spores += earned; state.totalEarned += earned;
    const mins = Math.floor(elapsed / 60), hrs = Math.floor(mins / 60);
    const timeStr = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
    tick(`🌙 Welcome back! ${timeStr} passed — your network earned +${fmt(earned)} spores.`, true);
    updateStats();
}

// ═══════════════════════════════════════
//  SCROLL TO TOP
// ═══════════════════════════════════════
(function setupScrollTop() {
    const rightPanel = document.getElementById('right');
    const btn = document.getElementById('scroll-top-btn');
    rightPanel.addEventListener('scroll', () => {
        btn.classList.toggle('visible', rightPanel.scrollTop > 120);
    }, { passive: true });
    btn.addEventListener('click', () => {
        // Scroll the page so the mushroom button is visible
        document.getElementById('spore-btn').scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Also reset the right panel to its top
        rightPanel.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();

// ═══════════════════════════════════════
//  EVENT WIRING
// ═══════════════════════════════════════
document.getElementById('mode-check').addEventListener('change', () => { state.disasterMode = document.getElementById('mode-check').checked; tick(state.disasterMode ? '⚠️ Disaster Mode: events can now harm your colony.' : '🌿 Colony Mode: only beneficial events.', true); });
document.getElementById('spore-btn').addEventListener('click', e => {
    const gain = getClickValue(); state.spores += gain; state.totalEarned += gain; state.allTimeClicks++; state.clicksThisPrestige++;
    // Hidden achievement tracking
    const now = Date.now();
    _lastClickAt = now;
    _clickTs = _clickTs.filter(t => now - t < 10000); _clickTs.push(now);
    if (_clickTs.length >= 50) tryUnlockHidden('h1');
    if (state.hivemindUnlocked) { state.hivemind = Math.min(100, state.hivemind + 0.5); if (state.hivemind >= 100) triggerPulse(); }
    spawnBurst(e.clientX, e.clientY, gain); spawnPulseRing(); updateStats();
});
document.getElementById('subtab-available').addEventListener('click', () => switchUpgradeSub('available'));
document.getElementById('subtab-owned').addEventListener('click', () => switchUpgradeSub('owned'));
ALL_TABS.forEach(t => document.getElementById('tab-btn-' + t).addEventListener('click', () => switchTab(t)));

// Profile modal wiring
document.getElementById('profile-btn').addEventListener('click', openProfileModal);
document.getElementById('logout-inline-btn').addEventListener('click', doSignOut);
document.getElementById('profile-modal-close').addEventListener('click', closeProfileModal);
document.getElementById('profile-overlay').addEventListener('click', e => { if (e.target === document.getElementById('profile-overlay')) closeProfileModal(); });
document.getElementById('ptab-login').addEventListener('click', () => switchProfileTab('login'));
document.getElementById('ptab-signup').addEventListener('click', () => switchProfileTab('signup'));
document.getElementById('p-login-btn').addEventListener('click', doSignIn);
document.getElementById('p-signup-btn').addEventListener('click', doSignUp);
document.getElementById('p-save-now-btn').addEventListener('click', () => { saveGame(); });
document.getElementById('p-load-cloud-btn').addEventListener('click', () => { if (confirm('Load last save? This will overwrite your current session.')) loadFromCloud(true); });
document.getElementById('p-reset-btn').addEventListener('click', resetGame);

// Allow Enter key in auth forms
document.getElementById('p-password-login').addEventListener('keydown', e => { if (e.key === 'Enter') doSignIn(); });
document.getElementById('p-password-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') doSignUp(); });

// ═══════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════
function bootUI() {
    buildProducers(); buildSymbiosis(); buildOwned(); buildGoals(); buildCodex();
    updateStats(); updateProducers(); buildUpgrades(); updateUpgrades();
    updateSymbiosis(); updateSeasonBar(); updateBiomePath(); updateSporulateUI();
    document.getElementById('mode-check').checked = state.disasterMode;
    document.getElementById('event-toast').style.display = 'none';
    buildResearch(); updateResearch(); buildStats();
    if (state.totalEarned > 0) showMessage();
}

initFirebase();
loadGame();
bootUI();
applyOfflineProgress();
requestAnimationFrame(animateMycelium);