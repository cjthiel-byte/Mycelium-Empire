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
//           match /leaderboard/{uid} {
//             allow read: if true;
//             allow write: if request.auth != null && request.auth.uid == uid;
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
            _lbCache = null; _lbFetchedAt = 0; // invalidate leaderboard cache on auth change
            if (user) {
                // Username is stored on the Auth profile displayName — no extra Firestore read needed
                currentUsername = user.displayName || '';
                resolveUsername(user); // async fallback if displayName is missing
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
    { id: 'satellite', name: 'Spore Satellite', emoji: '🛰', desc: 'Orbital platforms blanket the atmosphere in spores.', baseCost: 2e9, baseSps: 1500000 },
    { id: 'crystal', name: 'Hivemind Crystal', emoji: '💎', desc: 'Crystallised mycelium acts as a living supercomputer.', baseCost: 1.5e10, baseSps: 8000000 },
    { id: 'rootsing', name: 'Root Singularity', emoji: '🌐', desc: 'All root systems on Earth merge into one vast mind.', baseCost: 1.2e11, baseSps: 40000000 },
    { id: 'temporal', name: 'Temporal Thread', emoji: '⌛', desc: 'Threads reach backward and forward through time.', baseCost: 1e12, baseSps: 200000000 },
    { id: 'stellar', name: 'Stellar Mycelium', emoji: '⭐', desc: 'Spores travel between star systems on solar winds.', baseCost: 9e12, baseSps: 1200000000 },
    { id: 'consciousness', name: 'Consciousness Web', emoji: '🧠', desc: 'The network becomes the substrate of all thought.', baseCost: 8e13, baseSps: 7000000000 },
    { id: 'dimensional', name: 'Dimensional Rot', emoji: '🌀', desc: 'Your decay spreads across parallel dimensions.', baseCost: 7e14, baseSps: 100000000000 },
    { id: 'eternalspore', name: 'The Eternal Spore', emoji: '♾', desc: 'There is no end. There was no beginning. Only growth.', baseCost: 7e15, baseSps: 700000000000 },
    { id: 'galactic', name: 'Galactic Lattice', emoji: '🌠', desc: 'A crystalline lattice spans entire galaxy clusters.', baseCost: 8e16, baseSps: 4000000000000 },
    { id: 'absolute', name: 'The Absolute', emoji: '🔮', desc: 'Beyond dimension. Beyond time. The final rot.', baseCost: 7e17, baseSps: 30e12 },
];

// ═══════════════════════════════════════
//  UPGRADES
// ═══════════════════════════════════════
const UPGRADES_DEF = [
    { id: 'pulse_unlock', tier: 'hivemind', name: 'Hivemind Awakening', desc: 'Unlock the Hivemind Pulse. Clicking now charges a burst that releases massive spores.', cost: 250, req: s => s.totalEarned >= 100 && !s.codexPurchased.includes('P1'), apply: s => { s.hivemindUnlocked = true; } },
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
    { id: 'u11b', tier: 'dream', name: 'Collective Unconscious', desc: 'Dream Mycelium 7× more output.', cost: 1.5e10, req: s => p(s, 'dreamweb').owned >= 12, apply: s => mp(s, 'dreamweb', 7) },
    { id: 'u12', tier: 'satellite', name: 'Geostationary Web', desc: 'Spore Satellites 5× more output.', cost: 2e10, req: s => p(s, 'satellite').owned >= 3, apply: s => mp(s, 'satellite', 5) },
    { id: 'u13', tier: 'crystal', name: 'Quantum Lattice', desc: 'Hivemind Crystals 6× more output.', cost: 1.5e11, req: s => p(s, 'crystal').owned >= 3, apply: s => mp(s, 'crystal', 6) },
    { id: 'u14', tier: 'rootsing', name: 'Planetary Nervous System', desc: 'Root Singularity 7× more.', cost: 7e11, req: s => p(s, 'rootsing').owned >= 3, apply: s => mp(s, 'rootsing', 7) },
    { id: 'u15', tier: 'temporal', name: 'Causal Loop Harvest', desc: 'Temporal Threads 8× more.', cost: 6e12, req: s => p(s, 'temporal').owned >= 3, apply: s => mp(s, 'temporal', 8) },
    { id: 'u15b', tier: 'temporal', name: 'Timestream Convergence', desc: 'Temporal Threads 12× more.', cost: 6e13, req: s => p(s, 'temporal').owned >= 15, apply: s => mp(s, 'temporal', 12) },
    { id: 'u_stellar1', tier: 'stellar', name: 'Solar Wind Seeding', desc: 'Stellar Mycelium 5× more output.', cost: 5e13, req: s => p(s, 'stellar').owned >= 3, apply: s => mp(s, 'stellar', 5) },
    { id: 'u_stellar2', tier: 'stellar', name: 'Cosmic Bloom', desc: 'Stellar Mycelium 8× more output.', cost: 8e14, req: s => p(s, 'stellar').owned >= 15, apply: s => mp(s, 'stellar', 8) },
    { id: 'u_consciousness1', tier: 'consciousness', name: 'Synaptic Mycelium', desc: 'Consciousness Web 5× more output.', cost: 5e14, req: s => p(s, 'consciousness').owned >= 3, apply: s => mp(s, 'consciousness', 5) },
    { id: 'u_consciousness2', tier: 'consciousness', name: 'Collective Dreaming', desc: 'Consciousness Web 8× more output.', cost: 8e15, req: s => p(s, 'consciousness').owned >= 15, apply: s => mp(s, 'consciousness', 8) },
    { id: 'u_dimensional1', tier: 'dimensional', name: 'Reality Fracture', desc: 'Dimensional Rot 6× more output.', cost: 5e15, req: s => p(s, 'dimensional').owned >= 3, apply: s => mp(s, 'dimensional', 6) },
    { id: 'u_dimensional2', tier: 'dimensional', name: 'Multiversal Decay', desc: 'Dimensional Rot 9× more output.', cost: 8e16, req: s => p(s, 'dimensional').owned >= 15, apply: s => mp(s, 'dimensional', 9) },
    { id: 'u_eternal1', tier: 'eternalspore', name: 'Undying Spore', desc: 'The Eternal Spore 6× more output.', cost: 5e16, req: s => p(s, 'eternalspore').owned >= 3, apply: s => mp(s, 'eternalspore', 6) },
    { id: 'u_eternal2', tier: 'eternalspore', name: 'Infinite Loop', desc: 'The Eternal Spore 10× more output.', cost: 8e17, req: s => p(s, 'eternalspore').owned >= 15, apply: s => mp(s, 'eternalspore', 10) },
    { id: 'u16', tier: 'galactic', name: 'Gravitational Spore Web', desc: 'Galactic Lattice 5× more output.', cost: 5e17, req: s => p(s, 'galactic').owned >= 3, apply: s => mp(s, 'galactic', 5) },
    { id: 'u16b', tier: 'galactic', name: 'Dark Matter Weave', desc: 'Galactic Lattice 8× more output.', cost: 5e18, req: s => p(s, 'galactic').owned >= 15, apply: s => mp(s, 'galactic', 8) },
    { id: 'u17', tier: 'absolute', name: 'Omniversal Rot', desc: 'The Absolute 6× more output.', cost: 5e18, req: s => p(s, 'absolute').owned >= 3, apply: s => mp(s, 'absolute', 6) },
    { id: 'u17b', tier: 'absolute', name: 'Beyond Infinity', desc: 'The Absolute 10× more output.', cost: 5e19, req: s => p(s, 'absolute').owned >= 15, apply: s => mp(s, 'absolute', 10) },
    { id: 'ug1', tier: 'global', name: 'Neural Mesh', desc: 'All producers +50% output.', cost: 100000, req: s => s.totalEarned >= 50000, apply: s => { s.producers.forEach(x => x.baseSps *= 1.5); } },
    { id: 'ug2', tier: 'global', name: 'Hive Ascension', desc: 'All producers double output.', cost: 2e6, req: s => s.totalEarned >= 1e6, apply: s => { s.producers.forEach(x => x.baseSps *= 2); } },
    { id: 'ug3', tier: 'global', name: 'Universal Rot', desc: 'All producers triple output.', cost: 2e9, req: s => s.totalEarned >= 5e8, apply: s => { s.producers.forEach(x => x.baseSps *= 3); } },
    { id: 'ug4', tier: 'global', name: 'Omnipresent Spore', desc: 'All producers ×5 output.', cost: 5e12, req: s => s.totalEarned >= 1e12, apply: s => { s.producers.forEach(x => x.baseSps *= 5); } },
    { id: 'ug5', tier: 'global', name: 'Mycelial Transcendence', desc: 'All producers ×8 output.', cost: 5e15, req: s => s.totalEarned >= 1e15, apply: s => { s.producers.forEach(x => x.baseSps *= 8); } },
    { id: 'ug6', tier: 'global', name: 'The Infinite Rot', desc: 'All producers ×15 output.', cost: 5e18, req: s => s.totalEarned >= 1e18, apply: s => { s.producers.forEach(x => x.baseSps *= 15); } },
    // Auto-feed bonds
    { id: 'uf1', tier: 'autofeed', name: 'Spore Cultivation I', desc: 'Automatically feed Bonds 1–3 (Earthworm, Dung Beetle, Ant Colony) when hungry.', cost: 500000, req: s => s.symbiosis.filter(x => ['earthworm', 'beetle', 'antcolony'].includes(x.id)).some(x => x.active || x.broken), apply: s => { } },
    { id: 'uf2', tier: 'autofeed', name: 'Spore Cultivation II', desc: 'Automatically feed Bonds 4–6 (Morpho Moth, Hivemind Bees, Cave Spider) when hungry.', cost: 50000000, req: s => s.symbiosis.filter(x => ['moth', 'bees', 'spider'].includes(x.id)).some(x => x.active || x.broken), apply: s => { } },
    { id: 'uf3', tier: 'autofeed', name: 'Spore Cultivation III', desc: 'Automatically feed Bonds 7–10 (Root Lizard, Spore Elk, Void Leech, Eternal Serpent) when hungry.', cost: 5000000000, req: s => s.symbiosis.filter(x => ['lizard', 'elk', 'leech', 'serpent'].includes(x.id)).some(x => x.active || x.broken), apply: s => { } },
    // ── Biome-exclusive upgrades ─────────────────────────────────────────────
    { id: 'ub_forest1', tier: 'forest', biome: 'forest', name: 'Origin Mycelium', desc: 'Threads 4× and Fruiting Bodies 2× more efficient. Ancient Forest only.', cost: 3000, req: s => BIOMES[s.biomeIdx].id === 'forest' && p(s, 'threads').owned >= 8, apply: s => { mp(s, 'threads', 4); mp(s, 'fruiting', 2); } },
    { id: 'ub_forest2', tier: 'forest', biome: 'forest', name: 'Ancient Grove Bond', desc: 'Wood Wide Web 5× output. Ancient Forest only.', cost: 50000, req: s => BIOMES[s.biomeIdx].id === 'forest' && p(s, 'woodweb').owned >= 5, apply: s => mp(s, 'woodweb', 5) },
    { id: 'ub_desert1', tier: 'desert', biome: 'desert', name: 'Heat-Forged Spores', desc: 'Clicks give 8× more spores. Arid Desert only.', cost: 10000, req: s => BIOMES[s.biomeIdx].id === 'desert' && s.totalEarned >= 3000, apply: s => { s.sporesPerClick *= 8; } },
    { id: 'ub_desert2', tier: 'desert', biome: 'desert', name: 'Dune Migration', desc: 'Spore Storms 5× more effective. Arid Desert only.', cost: 100000, req: s => BIOMES[s.biomeIdx].id === 'desert' && p(s, 'sporestorm').owned >= 3, apply: s => mp(s, 'sporestorm', 5) },
    { id: 'ub_ocean1', tier: 'ocean', biome: 'ocean', name: 'Abyssal Pressure', desc: 'All producers +80% output. Deep Ocean only.', cost: 2000000, req: s => BIOMES[s.biomeIdx].id === 'ocean' && s.totalEarned >= 500000, apply: s => { s.producers.forEach(x => x.baseSps *= 1.8); } },
    { id: 'ub_ocean2', tier: 'ocean', biome: 'ocean', name: 'Bioluminescent Depth', desc: 'Fruiting Bodies 5× and Underground City 4× output. Deep Ocean only.', cost: 8000000, req: s => BIOMES[s.biomeIdx].id === 'ocean' && p(s, 'fruiting').owned >= 10, apply: s => { mp(s, 'fruiting', 5); mp(s, 'undercity', 4); } },
    { id: 'ub_arctic1', tier: 'arctic', biome: 'arctic', name: 'Permafrost Lattice', desc: 'Underground City 6× output. Frozen Tundra only.', cost: 100000, req: s => BIOMES[s.biomeIdx].id === 'arctic' && p(s, 'undercity').owned >= 2, apply: s => mp(s, 'undercity', 6) },
    { id: 'ub_arctic2', tier: 'arctic', biome: 'arctic', name: 'Glacial Resonance', desc: 'All producers +75% output. Frozen Tundra only.', cost: 3000000, req: s => BIOMES[s.biomeIdx].id === 'arctic' && s.totalEarned >= 1000000, apply: s => { s.producers.forEach(x => x.baseSps *= 1.75); } },
    { id: 'ub_void1', tier: 'void', biome: 'void', name: 'Null Filaments', desc: 'Void Spores 8× more powerful. The Void only.', cost: 50000000, req: s => BIOMES[s.biomeIdx].id === 'void' && p(s, 'voidspore').owned >= 2, apply: s => mp(s, 'voidspore', 8) },
    { id: 'ub_void2', tier: 'void', biome: 'void', name: 'Entropy Cascade', desc: 'All producers double output. The Void only.', cost: 1000000000, req: s => BIOMES[s.biomeIdx].id === 'void' && s.totalEarned >= 5e8, apply: s => { s.producers.forEach(x => x.baseSps *= 2); } },
    { id: 'ub_swamp1', tier: 'swamp', biome: 'swamp', name: 'Rot Bloom', desc: 'Fruiting Bodies 4× and Threads 3× more efficient. Fungal Swamp only.', cost: 20000, req: s => BIOMES[s.biomeIdx].id === 'swamp' && p(s, 'fruiting').owned >= 8, apply: s => { mp(s, 'fruiting', 4); mp(s, 'threads', 3); } },
    { id: 'ub_swamp2', tier: 'swamp', biome: 'swamp', name: 'Toxic Overgrowth', desc: 'All producers +60% output. Fungal Swamp only.', cost: 500000, req: s => BIOMES[s.biomeIdx].id === 'swamp' && s.totalEarned >= 200000, apply: s => { s.producers.forEach(x => x.baseSps *= 1.6); } },
    { id: 'ub_cave1', tier: 'cave', biome: 'cave', name: 'Crystal Harmonics', desc: 'Clicks give 15× more spores. Crystal Caves only.', cost: 30000, req: s => BIOMES[s.biomeIdx].id === 'cave' && s.totalEarned >= 5000, apply: s => { s.sporesPerClick *= 15; } },
    { id: 'ub_cave2', tier: 'cave', biome: 'cave', name: 'Deep Resonance', desc: 'Hivemind Crystals 8× output. Crystal Caves only.', cost: 3e11, req: s => BIOMES[s.biomeIdx].id === 'cave' && p(s, 'crystal').owned >= 2, apply: s => mp(s, 'crystal', 8) },
    { id: 'ub_canopy1', tier: 'canopy', biome: 'canopy', name: 'Aerial Spore Drift', desc: 'Spore Storms 6× more effective. Ancient Canopy only.', cost: 50000, req: s => BIOMES[s.biomeIdx].id === 'canopy' && p(s, 'sporestorm').owned >= 4, apply: s => mp(s, 'sporestorm', 6) },
    { id: 'ub_canopy2', tier: 'canopy', biome: 'canopy', name: 'Treetop Network', desc: 'Wood Wide Web 6× and Cordyceps Protocol 4× output. Ancient Canopy only.', cost: 1000000, req: s => BIOMES[s.biomeIdx].id === 'canopy' && p(s, 'woodweb').owned >= 8, apply: s => { mp(s, 'woodweb', 6); mp(s, 'cordyceps', 4); } },
    { id: 'ub_volcanic1', tier: 'volcanic', biome: 'volcanic', name: 'Pyroclastic Pulse', desc: 'Clicks give 12× more spores. Volcanic Rift only.', cost: 150000, req: s => BIOMES[s.biomeIdx].id === 'volcanic' && s.totalEarned >= 30000, apply: s => { s.sporesPerClick *= 12; } },
    { id: 'ub_volcanic2', tier: 'volcanic', biome: 'volcanic', name: 'Magma Core Infusion', desc: 'All producers +60% output. Volcanic Rift only.', cost: 8000000, req: s => BIOMES[s.biomeIdx].id === 'volcanic' && s.totalEarned >= 2000000, apply: s => { s.producers.forEach(x => x.baseSps *= 1.6); } },
    { id: 'ub_celestial1', tier: 'celestial', biome: 'celestial', name: 'Star-Born Filaments', desc: 'Stellar Mycelium 8× output. Celestial Drift only.', cost: 2e14, req: s => BIOMES[s.biomeIdx].id === 'celestial' && p(s, 'stellar').owned >= 2, apply: s => mp(s, 'stellar', 8) },
    { id: 'ub_celestial2', tier: 'celestial', biome: 'celestial', name: 'Cosmic Singularity', desc: 'All producers ×4 output. Celestial Drift only.', cost: 5e16, req: s => BIOMES[s.biomeIdx].id === 'celestial' && s.totalEarned >= 1e15, apply: s => { s.producers.forEach(x => x.baseSps *= 4); } },
    // ── Synergy upgrades — dynamic cross-producer bonuses ────────────────────
    { id: 'syn1', tier: 'synergy', isSynergy: true, synFrom: 'woodweb', synTo: 'threads', pctPer: 0.008, name: 'Root Feedback', desc: 'Tree roots energise the thread network. Each Wood Wide Web owned adds +0.8% to Threads output.', cost: 5000, req: s => p(s, 'woodweb').owned >= 5, apply: () => {} },
    { id: 'syn2', tier: 'synergy', isSynergy: true, synFrom: 'fruiting', synTo: 'sporestorm', pctPer: 0.010, name: 'Canopy Dispersal', desc: 'Fruiting bodies seed the storm. Each Fruiting Body owned adds +1% to Spore Storm output.', cost: 25000, req: s => p(s, 'fruiting').owned >= 15 && p(s, 'sporestorm').owned >= 3, apply: () => {} },
    { id: 'syn3', tier: 'synergy', isSynergy: true, synFrom: 'cordyceps', synTo: 'undercity', pctPer: 0.006, name: 'Insect Labor', desc: 'Infected insects build your underground infrastructure. Each Cordyceps owned adds +0.6% to Underground City output.', cost: 500000, req: s => p(s, 'cordyceps').owned >= 5 && p(s, 'undercity').owned >= 3, apply: () => {} },
    { id: 'syn4', tier: 'synergy', isSynergy: true, synFrom: 'dreamweb', synTo: 'consciousness', pctPer: 0.015, name: 'Shared Dreaming', desc: 'The dream layer bleeds into conscious thought. Each Dream Mycelium owned adds +1.5% to Consciousness Web output.', cost: 5e10, req: s => p(s, 'dreamweb').owned >= 5 && p(s, 'consciousness').owned >= 1, apply: () => {} },
    { id: 'syn5', tier: 'synergy', isSynergy: true, synFrom: 'temporal', synTo: 'stellar', pctPer: 0.010, name: 'Causal Seeding', desc: 'Threads through time plant spores among the stars. Each Temporal Thread owned adds +1% to Stellar Mycelium output.', cost: 5e13, req: s => p(s, 'temporal').owned >= 3 && p(s, 'stellar').owned >= 1, apply: () => {} },
];

// ── Upgrade sections — groups tiers into display categories ──────────────
const PRODUCER_TIERS = new Set(['threads', 'fruiting', 'woodweb', 'storm', 'cordyceps', 'planetary', 'voidspore', 'lichen', 'dream', 'satellite', 'crystal', 'rootsing', 'temporal', 'stellar', 'consciousness', 'dimensional', 'eternalspore', 'galactic', 'absolute']);
const BIOME_TIERS    = new Set(['forest', 'desert', 'ocean', 'arctic', 'void', 'swamp', 'cave', 'canopy', 'volcanic', 'celestial']);
const UPGRADE_SECTIONS = [
    { label: '⚡ Hivemind',  tiers: new Set(['hivemind']) },
    { label: '👆 Clicking',  tiers: new Set(['click']) },
    { label: '🔗 Synergy',   tiers: new Set(['synergy']) },
    { label: '🍄 Producers', tiers: PRODUCER_TIERS },
    { label: '🌍 Global',    tiers: new Set(['global']) },
    { label: '🪱 Auto-Feed', tiers: new Set(['autofeed']) },
    { label: '🌿 Biome',     tiers: BIOME_TIERS },
];

const TIER_LABELS = {
    hivemind: 'Hivemind', threads: 'Threads', fruiting: 'Fruiting', woodweb: 'Wood Web',
    click: 'Click', storm: 'Storm', cordyceps: 'Cordyceps', planetary: 'Planetary',
    voidspore: 'Void', lichen: 'Lichen', dream: 'Dream', satellite: 'Satellite',
    crystal: 'Crystal', rootsing: 'Root Sing.', temporal: 'Temporal',
    galactic: 'Galactic', absolute: 'Absolute', global: 'Global', autofeed: 'Auto-Feed',
    stellar: 'Stellar', consciousness: 'Consciousness', dimensional: 'Dimensional', eternalspore: 'Eternal Spore',
    forest: '🌲 Forest', desert: '🏜 Desert', ocean: '🌊 Ocean', arctic: '🧊 Arctic',
    void: '🌌 Void', swamp: '🌿 Swamp', cave: '💎 Caves', canopy: '🌴 Canopy',
    volcanic: '🌋 Volcanic', celestial: '🌠 Celestial',
    synergy: '🔗 Synergy',
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
    { id: 'forest', name: 'Ancient Forest', emoji: '🌲', clickMult: 1, prodMult: 1.0, noSeasons: false, desc: 'The origin. Balanced and fertile.', colors: { bg: '#0f1e11', bg2: '#0a1209', a: '29,158,117', b: '159,225,203', n: '93,202,165', g1: '#1D9E7548', g2: '#1D9E7520' } },
    { id: 'desert', name: 'Arid Desert', emoji: '🏜', clickMult: 3, prodMult: 0.65, noSeasons: false, desc: 'Clicks are powerful. Producers struggle in the heat.', colors: { bg: '#1e140a', bg2: '#130d07', a: '190,120,35', b: '230,175,80', n: '210,150,55', g1: '#BE781348', g2: '#BE781320' } },
    { id: 'ocean', name: 'Deep Ocean', emoji: '🌊', clickMult: 1, prodMult: 2.0, noSeasons: true, desc: 'No seasons. Producers flourish in the crushing dark.', colors: { bg: '#08101e', bg2: '#040a14', a: '25,95,175', b: '70,175,220', n: '90,195,235', g1: '#195FAF48', g2: '#195FAF20' } },
    { id: 'arctic', name: 'Frozen Tundra', emoji: '🧊', clickMult: 1, prodMult: 1.0, noSeasons: false, arcticMode: true, desc: 'Winter bonuses are doubled. Summer is brutal.', colors: { bg: '#0c141e', bg2: '#070d16', a: '70,145,195', b: '165,215,245', n: '195,235,255', g1: '#4691C348', g2: '#4691C320' } },
    { id: 'void', name: 'The Void', emoji: '🌌', clickMult: 2, prodMult: 3.0, noSeasons: false, desc: 'Tripled production. Strange laws apply here.', colors: { bg: '#11081e', bg2: '#0b0514', a: '115,55,175', b: '195,130,245', n: '215,160,255', g1: '#733FAF48', g2: '#733FAF20' } },
    { id: 'swamp', name: 'Fungal Swamp', emoji: '🌿', clickMult: 1, prodMult: 1.75, noSeasons: false, swampMode: true, desc: 'Rot is everywhere. Producers thrive, but seasons swing harder.', colors: { bg: '#0e1a07', bg2: '#080f04', a: '80,120,28', b: '148,190,52', n: '172,214,62', g1: '#507A1C48', g2: '#507A1C20' } },
    { id: 'cave', name: 'Crystal Caves', emoji: '💎', clickMult: 4, prodMult: 0.8, noSeasons: true, desc: 'No seasons. Clicks resonate through crystal, massively amplified.', colors: { bg: '#081318', bg2: '#050c10', a: '32,118,195', b: '105,215,245', n: '145,235,255', g1: '#2076C348', g2: '#2076C320' } },
    { id: 'canopy', name: 'Ancient Canopy', emoji: '🌴', clickMult: 1.5, prodMult: 1.5, noSeasons: false, desc: 'High above the forest floor. Both clicks and producers gain a steady lift.', colors: { bg: '#0b1e0d', bg2: '#071409', a: '35,150,60', b: '95,215,85', n: '125,230,95', g1: '#23963C48', g2: '#23963C20' } },
    { id: 'volcanic', name: 'Volcanic Rift', emoji: '🌋', clickMult: 2, prodMult: 0.5, noSeasons: false, volcanicMode: true, desc: 'Extreme heat halves producers but doubles clicks. Spring and Fall surge.', colors: { bg: '#1e0a08', bg2: '#130605', a: '190,55,22', b: '238,120,45', n: '252,148,58', g1: '#BE371648', g2: '#BE371620' } },
    { id: 'celestial', name: 'Celestial Drift', emoji: '🌠', clickMult: 3, prodMult: 4.0, noSeasons: true, desc: 'Beyond the planet. No seasons. Clicks and production both reach their peak.', colors: { bg: '#0d0a1e', bg2: '#08061a', a: '145,90,205', b: '245,200,85', n: '255,220,95', g1: '#9158CD48', g2: '#9158CD20' } },
];

// ═══════════════════════════════════════
//  RUN MODIFIERS
// ═══════════════════════════════════════
const RUN_MODIFIERS = [
    // Buffs
    { id: 'bumper_harvest', name: 'Bumper Harvest', emoji: '🌿', type: 'buff', desc: 'All producers give ×1.8 more spores.', biomeWeights: { forest: 3, canopy: 2, swamp: 2, ocean: 2 } },
    { id: 'resonant_hands', name: 'Resonant Hands', emoji: '✋', type: 'buff', desc: 'Clicks give 5× more spores.', biomeWeights: { cave: 3, desert: 2, volcanic: 2 } },
    { id: 'overclocked', name: 'Overclocked', emoji: '⚡', type: 'buff', desc: 'Hivemind bar charges 2× faster. Pulse bonus ×2.', biomeWeights: { cave: 2, desert: 2, volcanic: 2, void: 2 } },
    { id: 'symbiotic_bloom', name: 'Symbiotic Bloom', emoji: '🪱', type: 'buff', desc: 'Bond SPS bonuses are ×4. Bonds never go hungry.', biomeWeights: { swamp: 3, forest: 2, canopy: 2, ocean: 2 } },
    { id: 'resonance_loop', name: 'Resonance Loop', emoji: '🔁', type: 'buff', desc: 'Pulse combo window extends to 3 minutes. ×3.5 multiplier at streak 2+.', biomeWeights: { void: 3, cave: 2, celestial: 2 } },
    // Twists
    { id: 'void_bloom', name: 'Void Bloom', emoji: '🌌', type: 'twist', desc: 'All producers ×3. Sporulation threshold ×1.8.', biomeWeights: { void: 3, celestial: 2, ocean: 2 } },
    { id: 'volatile_seasons', name: 'Volatile Seasons', emoji: '🌪', type: 'twist', desc: 'Season bonuses and penalties are doubled.', biomeWeights: { swamp: 2, volcanic: 2, arctic: 2, canopy: 2, forest: 2 } },
    { id: 'eternal_winter', name: 'Eternal Winter', emoji: '❄️', type: 'twist', desc: 'Season is locked to Winter all run. No-season biomes unaffected.', biomeWeights: { arctic: 3, void: 2, swamp: 2 } },
    { id: 'deep_drought', name: 'Deep Drought', emoji: '🏜', type: 'twist', desc: 'Events are disabled. All producer costs −30%.', biomeWeights: { desert: 3, volcanic: 2 } },
    { id: 'spore_tax', name: 'Spore Tax', emoji: '💸', type: 'twist', desc: 'Upgrade and research costs ×4. All producers ×2.', biomeWeights: { forest: 1, ocean: 1, canopy: 1 } },
    { id: 'frozen_network', name: 'Frozen Network', emoji: '🧊', type: 'twist', desc: 'Producer costs ×2. Earn +20 bonus Essence on sporulation.', biomeWeights: { arctic: 3, void: 2 } },
    // Handicaps
    { id: 'void_tithe', name: 'Void Tithe', emoji: '🌀', type: 'handicap', desc: 'Lose 3% of stored spores per second. Pulse bonus ×5.', biomeWeights: { void: 3, celestial: 2 } },
    { id: 'spore_silence', name: 'Spore Silence', emoji: '🔇', type: 'handicap', desc: 'Clicking does nothing. All producers ×3.', biomeWeights: { ocean: 2, celestial: 2, swamp: 2 } },
    { id: 'heavy_rot', name: 'Heavy Rot', emoji: '💀', type: 'handicap', desc: 'All producers −50%. Sporulation threshold halved.', biomeWeights: { forest: 1, desert: 1, arctic: 1, canopy: 1 } },
];

function pickRunModifier(biomeId, excludeId = null) {
    const pool = RUN_MODIFIERS.filter(m => m.id !== excludeId);
    const weights = pool.map(m => (m.biomeWeights?.[biomeId] || 1));
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = Math.random() * total;
    return pool[weights.findIndex(w => (roll -= w) <= 0)] || pool[Math.floor(Math.random() * pool.length)];
}

// ═══════════════════════════════════════
//  BIOME OBJECTIVES
// ═══════════════════════════════════════
const BIOME_OBJECTIVES = [
    // Forest
    { id: 'bo_forest_e', biomeId: 'forest', difficulty: 'easy', essenceReward: 5, label: 'Abundant Forest',
      desc: 'Own 60 Threads, 20 Wood Wide Web, and have 2 active bonds.',
      req: s => p(s,'threads').owned >= 60 && p(s,'woodweb').owned >= 20 && s.symbiosis.filter(x => x.active && !x.broken).length >= 2 },
    { id: 'bo_forest_h', biomeId: 'forest', difficulty: 'hard', essenceReward: 15, label: 'Origin Mastered',
      desc: 'Earn 200M spores with both forest upgrades purchased and Earthworm bond active.',
      req: s => s.totalEarned >= 2e8 && s.upgrades.find(u => u.id === 'ub_forest1')?.bought && s.upgrades.find(u => u.id === 'ub_forest2')?.bought && (() => { const e = s.symbiosis.find(x => x.id === 'earthworm'); return e?.active && !e?.broken; })() },
    // Desert
    { id: 'bo_desert_e', biomeId: 'desert', difficulty: 'easy', essenceReward: 5, label: 'Desert Wanderer',
      desc: '750 clicks this run, own 15 Spore Storms, and have 2 active bonds.',
      req: s => (s.clicksThisPrestige||0) >= 750 && p(s,'sporestorm').owned >= 15 && s.symbiosis.filter(x => x.active && !x.broken).length >= 2 },
    { id: 'bo_desert_h', biomeId: 'desert', difficulty: 'hard', essenceReward: 15, label: 'Scorched Earth',
      desc: 'Earn 500M spores, pulse 40 times this run, and purchase both desert upgrades.',
      req: s => s.totalEarned >= 5e8 && (s.pulsesThisPrestige||0) >= 40 && s.upgrades.find(u => u.id === 'ub_desert1')?.bought && s.upgrades.find(u => u.id === 'ub_desert2')?.bought },
    // Ocean
    { id: 'bo_ocean_e', biomeId: 'ocean', difficulty: 'easy', essenceReward: 5, label: 'Deep Current',
      desc: 'Own 20 Fruiting Bodies, 15 Underground Cities, and have 3 active bonds.',
      req: s => p(s,'fruiting').owned >= 20 && p(s,'undercity').owned >= 15 && s.symbiosis.filter(x => x.active && !x.broken).length >= 3 },
    { id: 'bo_ocean_h', biomeId: 'ocean', difficulty: 'hard', essenceReward: 15, label: 'Abyssal Dominion',
      desc: 'Earn 2B spores, purchase both ocean upgrades, and have 4 active bonds.',
      req: s => s.totalEarned >= 2e9 && s.upgrades.find(u => u.id === 'ub_ocean1')?.bought && s.upgrades.find(u => u.id === 'ub_ocean2')?.bought && s.symbiosis.filter(x => x.active && !x.broken).length >= 4 },
    // Arctic
    { id: 'bo_arctic_e', biomeId: 'arctic', difficulty: 'easy', essenceReward: 5, label: 'Tundra Roots',
      desc: 'Survive a winter, own 40 Underground Cities, and have 2 active bonds.',
      req: s => s.winterSurvived && p(s,'undercity').owned >= 40 && s.symbiosis.filter(x => x.active && !x.broken).length >= 2 },
    { id: 'bo_arctic_h', biomeId: 'arctic', difficulty: 'hard', essenceReward: 15, label: 'Permafrost King',
      desc: 'Earn 2B spores, purchase both arctic upgrades, and have 3 active bonds.',
      req: s => s.totalEarned >= 2e9 && s.upgrades.find(u => u.id === 'ub_arctic1')?.bought && s.upgrades.find(u => u.id === 'ub_arctic2')?.bought && s.symbiosis.filter(x => x.active && !x.broken).length >= 3 },
    // Void
    { id: 'bo_void_e', biomeId: 'void', difficulty: 'easy', essenceReward: 5, label: 'Void Walker',
      desc: 'Own 10 Void Spores and have 2 active bonds.',
      req: s => p(s,'voidspore').owned >= 10 && s.symbiosis.filter(x => x.active && !x.broken).length >= 2 },
    { id: 'bo_void_h', biomeId: 'void', difficulty: 'hard', essenceReward: 15, label: 'The Null',
      desc: 'Earn 20B spores, purchase both void upgrades, and have 4 active bonds.',
      req: s => s.totalEarned >= 2e10 && s.upgrades.find(u => u.id === 'ub_void1')?.bought && s.upgrades.find(u => u.id === 'ub_void2')?.bought && s.symbiosis.filter(x => x.active && !x.broken).length >= 4 },
    // Swamp
    { id: 'bo_swamp_e', biomeId: 'swamp', difficulty: 'easy', essenceReward: 5, label: 'Rot Bloom',
      desc: 'Own 40 Fruiting Bodies, 30 Threads, and have Earthworm, Beetle, and Ant Colony all active.',
      req: s => p(s,'fruiting').owned >= 40 && p(s,'threads').owned >= 30 && ['earthworm','beetle','antcolony'].every(id => { const sym = s.symbiosis.find(x => x.id === id); return sym?.active && !sym?.broken; }) },
    { id: 'bo_swamp_h', biomeId: 'swamp', difficulty: 'hard', essenceReward: 15, label: 'The Rot Sovereign',
      desc: 'Earn 5B spores with Earthworm, Beetle, and Ant Colony all active — one must be in its favored season.',
      req: s => { if (s.totalEarned < 5e9) return false; const ids = ['earthworm','beetle','antcolony']; if (!ids.every(id => { const sym = s.symbiosis.find(x => x.id === id); return sym?.active && !sym?.broken; })) return false; const biome = BIOMES[s.biomeIdx]; if (biome.noSeasons || !s.settings.seasonsEnabled) return false; return ids.some(id => { const def = SYMBIONTS.find(d => d.id === id); return def?.favSeason === s.seasonIdx; }); } },
    // Cave
    { id: 'bo_cave_e', biomeId: 'cave', difficulty: 'easy', essenceReward: 5, label: 'Crystal Crawler',
      desc: '2000 clicks this run, own 20 Wood Wide Web, and 5 Hivemind Crystals.',
      req: s => (s.clicksThisPrestige||0) >= 2000 && p(s,'woodweb').owned >= 20 && p(s,'crystal').owned >= 5 },
    { id: 'bo_cave_h', biomeId: 'cave', difficulty: 'hard', essenceReward: 15, label: 'Crystal Mind',
      desc: '6000 clicks this run, own 8 Hivemind Crystals, and pulse 50 times this run.',
      req: s => (s.clicksThisPrestige||0) >= 6000 && p(s,'crystal').owned >= 8 && (s.pulsesThisPrestige||0) >= 50 },
    // Canopy
    { id: 'bo_canopy_e', biomeId: 'canopy', difficulty: 'easy', essenceReward: 5, label: 'Canopy Reach',
      desc: 'Own 25 Wood Wide Web, 20 Cordyceps, and have 3 active bonds.',
      req: s => p(s,'woodweb').owned >= 25 && p(s,'cordyceps').owned >= 20 && s.symbiosis.filter(x => x.active && !x.broken).length >= 3 },
    { id: 'bo_canopy_h', biomeId: 'canopy', difficulty: 'hard', essenceReward: 15, label: 'Crown of the Forest',
      desc: 'Earn 20B spores, purchase both canopy upgrades, and have 5 active bonds.',
      req: s => s.totalEarned >= 2e10 && s.upgrades.find(u => u.id === 'ub_canopy1')?.bought && s.upgrades.find(u => u.id === 'ub_canopy2')?.bought && s.symbiosis.filter(x => x.active && !x.broken).length >= 5 },
    // Volcanic
    { id: 'bo_volcanic_e', biomeId: 'volcanic', difficulty: 'easy', essenceReward: 5, label: 'Eruption',
      desc: '1500 clicks this run, own 20 Spore Storms, and have 1 active bond.',
      req: s => (s.clicksThisPrestige||0) >= 1500 && p(s,'sporestorm').owned >= 20 && s.symbiosis.filter(x => x.active && !x.broken).length >= 1 },
    { id: 'bo_volcanic_h', biomeId: 'volcanic', difficulty: 'hard', essenceReward: 15, label: 'Magma Heart',
      desc: 'Earn 5B spores (in harsh volcanic heat), pulse 75 times this run, and have 3 active bonds.',
      req: s => s.totalEarned >= 5e9 && (s.pulsesThisPrestige||0) >= 75 && s.symbiosis.filter(x => x.active && !x.broken).length >= 3 },
    // Celestial
    { id: 'bo_celestial_e', biomeId: 'celestial', difficulty: 'easy', essenceReward: 5, label: 'Star Child',
      desc: 'Own 10 Stellar Mycelium, 8 Consciousness Web, and have 5 active bonds.',
      req: s => p(s,'stellar').owned >= 10 && p(s,'consciousness').owned >= 8 && s.symbiosis.filter(x => x.active && !x.broken).length >= 5 },
    { id: 'bo_celestial_h', biomeId: 'celestial', difficulty: 'hard', essenceReward: 15, label: 'The Cosmic Rot',
      desc: 'Earn 100T spores, purchase both celestial upgrades, and have 6 active bonds.',
      req: s => s.totalEarned >= 1e14 && s.upgrades.find(u => u.id === 'ub_celestial1')?.bought && s.upgrades.find(u => u.id === 'ub_celestial2')?.bought && s.symbiosis.filter(x => x.active && !x.broken).length >= 6 },
];

const SYMBIONTS = [
    { id: 'earthworm', name: 'Earthworm', emoji: '🪱', desc: 'Tills the soil, enriching your threads.', unlockAt: 300, pactCost: 150, bonusSps: 2, feedCost: 80, feedEvery: 40, favSeason: 0 },
    { id: 'beetle', name: 'Dung Beetle', emoji: '🪲', desc: 'Spreads your spores through the forest floor.', unlockAt: 3000, pactCost: 1500, bonusSps: 15, feedCost: 400, feedEvery: 55, favSeason: 2 },
    { id: 'antcolony', name: 'Ant Colony', emoji: '🐜', desc: 'An entire colony works to expand your reach.', unlockAt: 30000, pactCost: 15000, bonusSps: 100, feedCost: 3000, feedEvery: 75, favSeason: 1 },
    { id: 'moth', name: 'Morpho Moth', emoji: '🦋', desc: 'Carries spores on iridescent wings across vast distances.', unlockAt: 250000, pactCost: 100000, bonusSps: 600, feedCost: 20000, feedEvery: 60, favSeason: 0 },
    { id: 'bees', name: 'Hivemind Bees', emoji: '🐝', desc: 'A psychically linked swarm that pulses your spores across entire regions.', unlockAt: 2000000, pactCost: 800000, bonusSps: 4000, feedCost: 150000, feedEvery: 70, favSeason: 1 },
    { id: 'spider', name: 'Cave Spider', emoji: '🕷', desc: 'Weaves spore-laden webs deep in caverns — unseen, but everywhere.', unlockAt: 20000000, pactCost: 8000000, bonusSps: 25000, feedCost: 1000000, feedEvery: 80, favSeason: 3 },
    { id: 'lizard', name: 'Root Lizard', emoji: '🦎', desc: 'An ancient reptile whose scales host thriving spore colonies along every root system it touches.', unlockAt: 500000000, pactCost: 200000000, bonusSps: 150000, feedCost: 8000000, feedEvery: 90, favSeason: 1 },
    { id: 'elk', name: 'Spore Elk', emoji: '🦌', desc: 'A great elk whose antlers drip with bioluminescent spores, seeding every forest it passes through.', unlockAt: 10000000000, pactCost: 4000000000, bonusSps: 1000000, feedCost: 60000000, feedEvery: 100, favSeason: 2 },
    { id: 'leech', name: 'Void Leech', emoji: '🐙', desc: 'A creature from between dimensions that feeds on dark matter and spreads your spores across realities.', unlockAt: 500000000000, pactCost: 200000000000, bonusSps: 8000000, feedCost: 500000000, feedEvery: 110, favSeason: 3 },
    { id: 'serpent', name: 'Eternal Serpent', emoji: '🐍', desc: 'An ageless serpent that has carried your spores since before time had meaning.', unlockAt: 5e13, pactCost: 2e13, bonusSps: 75000000, feedCost: 5000000000, feedEvery: 120, favSeason: null },
];

const EVENTS_POSITIVE = [
    { id: 'rain', name: 'Rainstorm', emoji: '🌧', color: '#7FC4D8', duration: 30, desc: 'Rain boosts fruiting bodies and threads.', mults: { fruiting: 1.5, threads: 1.3 }, seasonBias: [3, 1, 2, 0.5] },
    { id: 'wind', name: 'Spore Wind', emoji: '💨', color: '#9FE1CB', duration: 20, desc: 'A wind carries your spores across the world.', mults: {}, bonusSpores: 500, seasonBias: [1, 2, 1.5, 0.5] },
    { id: 'roots', name: 'Root Surge', emoji: '🌳', color: '#5DCAA5', duration: 25, desc: 'Tree roots pulse with renewed energy.', mults: { woodweb: 2, threads: 1.2 }, seasonBias: [2, 1, 2, 0.5], decision: { prompt: 'Channel the surge directly into your network?', acceptDesc: 'Double effect strength, extend by 15s', declineDesc: 'Let it flow naturally', costFactor: 3 } },
    { id: 'glow', name: 'Bioluminescence', emoji: '✨', color: '#9FE1CB', duration: 30, desc: 'The whole network glows. All output doubled.', mults: {}, globalMult: 2, seasonBias: [1, 0.5, 1, 2.5], decision: { prompt: 'Focus the glow into a directed burst?', acceptDesc: '×5 output for 15s', declineDesc: '×2 output for 30s', costFactor: 4 } },
    { id: 'ant', name: 'Ant Migration', emoji: '🐜', color: '#5DCAA5', duration: 20, desc: 'A swarm fans out your spores.', mults: { cordyceps: 2, sporestorm: 1.5 }, seasonBias: [2, 2, 1, 0.2] },
    { id: 'bloom', name: 'Spore Bloom', emoji: '🌸', color: '#C080B0', duration: 8, desc: 'Dormant spores erupt across the network in a sudden bloom.', mults: {}, bonusSpores: 2000, chainTo: 'fungal_surge', seasonBias: [3, 0.5, 1, 0.3] },
    { id: 'fungal_surge', name: 'Fungal Surge', emoji: '🍄', color: '#D070E0', duration: 22, desc: 'The bloom ignites a colony-wide surge. All output tripled.', mults: {}, globalMult: 3.0, bonusSpores: 5000, seasonBias: [1, 1, 1, 1] },
    { id: 'symbiosis_surge', name: 'Symbiotic Surge', emoji: '🫀', color: '#5DCAA5', duration: 28, desc: 'Bond energy floods the entire network with vitality.', mults: {}, globalMult: 1.8, seasonBias: [1.5, 1, 1.5, 0.5] },
    { id: 'lava_surge', name: 'Lava Surge', emoji: '🌋', color: '#D85A30', duration: 20, desc: 'Volcanic heat supercharges the entire network.', mults: {}, globalMult: 2.5, biomes: ['volcanic'], seasonBias: [1, 1, 1, 1] },
    { id: 'tidal_surge', name: 'Tidal Surge', emoji: '🌊', color: '#1A90C0', duration: 25, desc: 'Deep currents carry spores across the ocean floor.', mults: {}, globalMult: 2.5, biomes: ['ocean'], seasonBias: [1, 1, 1, 1] },
    { id: 'aurora', name: 'Aurora Bloom', emoji: '🌠', color: '#70C8F0', duration: 30, desc: 'Magnetic energy pulses through your frozen network.', mults: {}, globalMult: 2.2, biomes: ['arctic'], seasonBias: [1, 1, 1, 1] },
    { id: 'void_bloom', name: 'Void Bloom', emoji: '🔮', color: '#9060C0', duration: 15, desc: 'Strange laws align momentarily. The void produces without limit.', mults: {}, globalMult: 4.0, biomes: ['void'], seasonBias: [1, 1, 1, 1] },
];
const EVENTS_NEGATIVE = [
    { id: 'fire', name: 'Forest Fire', emoji: '🔥', color: '#D85A30', duration: 25, desc: 'Fire scorches the surface. Threads suffer.', mults: { threads: 0.3, fruiting: 0.5, woodweb: 0.6 }, seasonBias: [0.5, 3, 1.5, 0.1] },
    { id: 'drought', name: 'Drought', emoji: '☀️', color: '#EF9F27', duration: 20, desc: 'Drought shrivels your fruiting bodies.', mults: { fruiting: 0.2, sporestorm: 0.5 }, chainTo: 'fire', seasonBias: [0.5, 3, 1, 0.2], decision: { prompt: 'Fight the drought with emergency spore reserves?', acceptDesc: 'Half penalty, prevent wildfire chain', declineDesc: 'Endure it — may chain to wildfire', costFactor: 5 } },
    { id: 'pest', name: 'Pest Invasion', emoji: '🪲', color: '#c47a4a', duration: 15, desc: 'Pests consume 8% of your stored spores!', mults: {}, stealPct: 0.08, seasonBias: [2, 1.5, 1, 0.3], decision: { prompt: 'Deploy a spore shield to repel the pests?', acceptDesc: 'Block the theft entirely', declineDesc: 'Lose 8% stored spores', costFactor: 2 } },
    { id: 'freeze', name: 'Sudden Freeze', emoji: '❄️', color: '#7FC4D8', duration: 20, desc: 'A snap freeze locks the surface down.', mults: { threads: 0.4, fruiting: 0.3, woodweb: 0.5, sporestorm: 0.2 }, chainTo: 'blizzard', seasonBias: [0.5, 0.1, 1.5, 3] },
    { id: 'blizzard', name: 'Blizzard', emoji: '🌨', color: '#B0D8F0', duration: 30, desc: 'The freeze deepens into a full blizzard. Nearly all surface output halted.', mults: {}, globalMult: 0.08, seasonBias: [0.2, 0, 0.5, 3] },
    { id: 'blight', name: 'Fungal Blight', emoji: '🦠', color: '#7a6a2a', duration: 25, desc: 'A rival species chokes your threads, fruiting bodies, and roots.', mults: { threads: 0.2, fruiting: 0.2, woodweb: 0.5 }, seasonBias: [1.5, 1, 2, 0.5] },
    { id: 'solar_flare', name: 'Solar Flare', emoji: '🌞', color: '#C08020', duration: 22, desc: 'Radiation burns through your network. Mid and late producers are devastated.', mults: { woodweb: 0.5, undercity: 0.4, planetary: 0.2, satellite: 0.1, stellar: 0.1, consciousness: 0.2, dimensional: 0.2 }, seasonBias: [1, 2.5, 1, 0.5] },
    { id: 'void_storm', name: 'Void Storm', emoji: '🌀', color: '#4a2a7a', duration: 18, desc: 'Strange forces collapse the network. All output nearly gone.', mults: {}, globalMult: 0.15, biomes: ['void'], seasonBias: [1, 1, 1, 1] },
    { id: 'toxic_bloom', name: 'Toxic Bloom', emoji: '☠️', color: '#3a6a1a', duration: 6, desc: 'Swamp toxins turn your own spores against you. 14% of stores consumed.', mults: {}, stealPct: 0.14, biomes: ['swamp'], seasonBias: [1, 1, 1, 1] },
];

// ═══════════════════════════════════════
//  ACHIEVEMENTS
// ═══════════════════════════════════════
const MAJOR_ACHS = [
    // ── Spore Milestones ──
    { id: 'a1', emoji: '🍄', name: 'First Pulse', desc: 'Earn 100 total spores.', bonusDesc: '', req: s => s.totalEarned >= 100, prog: s => ({ val: Math.min(s.totalEarned, 100), max: 100 }), lore: 'The spore lands. Something begins.' },
    { id: 'a7', emoji: '✨', name: 'Thousand Spores', desc: 'Earn 1,000 total spores.', bonusDesc: '', req: s => s.totalEarned >= 1000, prog: s => ({ val: Math.min(s.totalEarned, 1000), max: 1000 }), lore: 'The count is meaningless now. You grow.' },
    { id: 'a23', emoji: '🌾', name: 'Spore Hoard', desc: 'Earn 10,000 total spores.', bonusDesc: '', req: s => s.totalEarned >= 10000, prog: s => ({ val: Math.min(s.totalEarned, 10000), max: 10000 }), lore: 'Enough to fill a forest. Not enough to stop.' },
    { id: 'a10', emoji: '🧠', name: 'Million Mind', desc: 'Earn 1,000,000 total spores.', bonusDesc: '', req: s => s.totalEarned >= 1000000, prog: s => ({ val: Math.min(s.totalEarned, 1e6), max: 1e6 }), lore: 'The numbers lost meaning long ago.' },
    { id: 'a29', emoji: '💰', name: 'Billion Spores', desc: 'Earn 1,000,000,000 total spores.', bonusDesc: '', req: s => s.totalEarned >= 1e9, prog: s => ({ val: Math.min(s.totalEarned, 1e9), max: 1e9 }), lore: 'Numbers this large have no meaning. They only have weight.' },
    // ── Producer Progression ──
    { id: 'a2', emoji: '🕸', name: 'Rot Spreads', desc: 'Own 5 Mycelium Threads.', bonusDesc: '', req: s => p(s, 'threads').owned >= 5, prog: s => ({ val: Math.min(p(s, 'threads').owned, 5), max: 5 }), lore: 'The wood softens. You are not alone.' },
    { id: 'a3', emoji: '🌿', name: 'First Fruiting', desc: 'Own 5 Fruiting Bodies.', bonusDesc: '', req: s => p(s, 'fruiting').owned >= 5, prog: s => ({ val: Math.min(p(s, 'fruiting').owned, 5), max: 5 }), lore: 'A cap emerges. The forest notices.' },
    { id: 'a4', emoji: '💨', name: 'Storm Walker', desc: 'Own 5 Spore Storms.', bonusDesc: '', req: s => p(s, 'sporestorm').owned >= 5, prog: s => ({ val: Math.min(p(s, 'sporestorm').owned, 5), max: 5 }), lore: 'The wind carries your will now.' },
    { id: 'a8', emoji: '🌲', name: 'Deep Roots', desc: 'Own 10 Wood Wide Web.', bonusDesc: '', req: s => p(s, 'woodweb').owned >= 10, prog: s => ({ val: Math.min(p(s, 'woodweb').owned, 10), max: 10 }), lore: 'The trees speak. You answer.' },
    { id: 'a15', emoji: '🌌', name: 'Beyond the Void', desc: 'Own 1 Void Spore.', bonusDesc: '', req: s => p(s, 'voidspore').owned >= 1, prog: s => ({ val: Math.min(p(s, 'voidspore').owned, 1), max: 1 }), lore: 'There is no language for what you have seen.' },
    { id: 'a16', emoji: '🪨', name: 'Stone Keeper', desc: 'Own 5 Lichen Veils.', bonusDesc: '', req: s => p(s, 'lichenveil').owned >= 5, prog: s => ({ val: Math.min(p(s, 'lichenveil').owned, 5), max: 5 }), lore: 'Even stone remembers, if you ask it slowly.' },
    { id: 'a17', emoji: '💤', name: 'Dreamer', desc: 'Own 1 Dream Mycelium.', bonusDesc: '', req: s => p(s, 'dreamweb').owned >= 1, prog: s => ({ val: Math.min(p(s, 'dreamweb').owned, 1), max: 1 }), lore: 'Asleep, they still spread.' },
    { id: 'a18', emoji: '⭐', name: 'Among the Stars', desc: 'Own 1 Stellar Mycelium.', bonusDesc: '', req: s => p(s, 'stellar').owned >= 1, prog: s => ({ val: Math.min(p(s, 'stellar').owned, 1), max: 1 }), lore: 'The stars were never empty.' },
    { id: 'a19', emoji: '♾', name: 'The Eternal', desc: 'Own 1 Eternal Spore.', bonusDesc: '', req: s => p(s, 'eternalspore').owned >= 1, prog: s => ({ val: Math.min(p(s, 'eternalspore').owned, 1), max: 1 }), lore: 'There is no word for what you are now.' },
    { id: 'a21', emoji: '🌠', name: 'Galactic Mind', desc: 'Own 1 Galactic Lattice.', bonusDesc: '', req: s => p(s, 'galactic').owned >= 1, prog: s => ({ val: Math.min(p(s, 'galactic').owned, 1), max: 1 }), lore: 'You are no longer a planet. You are a galaxy.' },
    { id: 'a22', emoji: '🔮', name: 'The Absolute', desc: 'Own 1 The Absolute.', bonusDesc: '', req: s => p(s, 'absolute').owned >= 1, prog: s => ({ val: Math.min(p(s, 'absolute').owned, 1), max: 1 }), lore: 'Language has no word for this.' },
    // ── Hivemind & Pulse ──
    { id: 'a5', emoji: '⚡', name: 'Network Mind', desc: 'Trigger the Hivemind Pulse 3 times.', bonusDesc: '', req: s => s.allTimePulses >= 3, prog: s => ({ val: Math.min(s.allTimePulses, 3), max: 3 }), lore: 'The pulse echoes further each time.' },
    { id: 'a9', emoji: '🌀', name: 'Pulse Master', desc: 'Trigger Hivemind Pulse 10 times.', bonusDesc: '', req: s => s.allTimePulses >= 10, prog: s => ({ val: Math.min(s.allTimePulses, 10), max: 10 }), lore: 'You no longer wait for the pulse.' },
    { id: 'a20', emoji: '🌀', name: 'Pulse God', desc: 'Trigger Hivemind Pulse 50 times.', bonusDesc: '', req: s => s.allTimePulses >= 50, prog: s => ({ val: Math.min(s.allTimePulses, 50), max: 50 }), lore: 'The universe pulses at your frequency.' },
    { id: 'a30', emoji: '🎼', name: 'Conductor', desc: 'Trigger the Hivemind Pulse 100 times.', bonusDesc: '', req: s => s.allTimePulses >= 100, prog: s => ({ val: Math.min(s.allTimePulses, 100), max: 100 }), lore: 'You no longer count the pulses. You simply are the pulse.' },
    // ── Prestige & Exploration ──
    { id: 'a11', emoji: '🧬', name: 'Ascendant', desc: 'Sporulate for the first time.', bonusDesc: '', req: s => s.prestigeCount >= 1, prog: s => ({ val: Math.min(s.prestigeCount, 1), max: 1 }), lore: 'Death is not an end. It is a dispersal.' },
    { id: 'a12', emoji: '♾', name: 'Many Lives', desc: 'Sporulate 3 times.', bonusDesc: '', req: s => s.prestigeCount >= 3, prog: s => ({ val: Math.min(s.prestigeCount, 3), max: 3 }), lore: 'Each spore carries the weight of worlds.' },
    { id: 'a24', emoji: '🔄', name: 'Veteran', desc: 'Sporulate 5 times.', bonusDesc: '', req: s => s.prestigeCount >= 5, prog: s => ({ val: Math.min(s.prestigeCount, 5), max: 5 }), lore: 'Five deaths. Five rebirths. The count no longer means anything.' },
    { id: 'a25', emoji: '🗺', name: 'World Traveler', desc: 'Visit all 10 biomes.', bonusDesc: '', req: s => s.biomesVisited.length >= 10, prog: s => ({ val: Math.min(s.biomesVisited.length, 10), max: 10 }), lore: 'Every corner of creation, seeded.' },
    // ── Symbiosis & Bonds ──
    { id: 'a6', emoji: '🪱', name: 'First Bond', desc: 'Form your first Symbiosis pact.', bonusDesc: '', req: s => s.symbiosis.some(x => x.active || x.broken), lore: 'You are not the only living thing here.' },
    { id: 'a14', emoji: '🐜', name: 'Antlord', desc: 'Form a pact with the Ant Colony.', bonusDesc: '', req: s => { const sc = s.symbiosis.find(x => x.id === 'antcolony'); return sc && (sc.active || sc.broken); }, lore: 'They serve the mycelium now.' },
    { id: 'a28', emoji: '💔', name: 'Broken Pact', desc: 'Have a Symbiosis bond break.', bonusDesc: '', req: s => s.symbiosis.some(x => x.broken), lore: 'The organism left. Something tougher grew in its place.' },
    // ── Seasons & World ──
    { id: 'a13', emoji: '❄️', name: 'Winter Survivor', desc: 'Survive a full Winter.', bonusDesc: '', req: s => s.winterSurvived, lore: 'Even under ice, the network breathes.' },
    // ── Knowledge & Mastery ──
    { id: 'a26', emoji: '🔬', name: 'Scholar', desc: 'Purchase your first Research upgrade.', bonusDesc: '', req: s => s.research.some(r => r.bought), lore: 'Knowledge is just a slower kind of growth.' },
    { id: 'a27', emoji: '📜', name: 'Enlightened', desc: 'Purchase your first Codex upgrade.', bonusDesc: '', req: s => s.codexPurchased.length >= 1, prog: s => ({ val: Math.min(s.codexPurchased.length, 1), max: 1 }), lore: 'The old knowledge, remembered.' },
];

const PROD_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500];
const PROD_MILESTONE_BONUSES = {
    50: { desc: '+5% all output', fn: m => { m.prod *= 1.05; } },
    100: { desc: '+10% all output', fn: m => { m.prod *= 1.10; } },
    250: { desc: '+15% all output', fn: m => { m.prod *= 1.15; } },
    500: { desc: '+22% all output', fn: m => { m.prod *= 1.22; } },
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
let _pulseCombo = 0, _comboExpiresAt = 0, _resonanceUntil = 0;
let _runClicks = 0, _lastEventAt = 0;

const HIDDEN_ACHS = [
    // Event-triggered (req always false — unlocked manually at the right moment)
    { id: 'h1', hidden: true, emoji: '⚡', name: 'Frenzy', desc: 'Click 100 times within 15 seconds.', bonusDesc: '+10% click power', lore: 'The network convulses. Something wakes.', bonus: m => { m.click *= 1.10; }, req: () => false },
    { id: 'h2', hidden: true, emoji: '🔋', name: 'Overclock', desc: 'Fill the Hivemind bar from 0 to 100 in under 20 seconds.', bonusDesc: '+20% pulse bonus', lore: 'You did not wait. You forced it.', bonus: m => { m.pulse *= 1.20; }, req: () => false },
    { id: 'h8', hidden: true, emoji: '🧩', name: 'Mind Meld', desc: 'Trigger the Hivemind Pulse 5 times within 4 minutes.', bonusDesc: '+30% pulse bonus', lore: 'Five pulses. One thought. No gap between.', bonus: m => { m.pulse *= 1.30; }, req: () => false },
    { id: 'h12', hidden: true, emoji: '🌩', name: 'Resonant Surge', desc: 'Fire a Hivemind Pulse within 5 seconds of an event spawning.', bonusDesc: '+15% pulse bonus', lore: 'The event and the pulse became the same thing.', bonus: m => { m.pulse *= 1.15; }, req: () => false },
    // Passive — checked every tick via checkAchievements
    { id: 'h3', hidden: true, emoji: '🪨', name: 'Stillness', desc: "Don't click for 5 minutes while earning 10,000+ spores/sec.", bonusDesc: '+10% all output', lore: 'The network breathes without you. It always could.', bonus: m => { m.prod *= 1.10; }, req: s => getSps() >= 10000 && (Date.now() - _lastClickAt) >= 300000 },
    { id: 'h4', hidden: true, emoji: '👑', name: 'Obsessive', desc: 'Own 50 of every producer simultaneously.', bonusDesc: '+15% all output', lore: 'Every node. Every thread. Every layer. Saturated.', bonus: m => { m.prod *= 1.15; }, req: s => s.producers.every(pr => pr.owned >= 50) },
    { id: 'h5', hidden: true, emoji: '🗂', name: 'The Collector', desc: 'Own at least one of every producer type.', bonusDesc: '+8% all output', lore: 'Nothing left to discover. Only growth remains.', bonus: m => { m.prod *= 1.08; }, req: s => s.producers.every(pr => pr.owned >= 1) },
    { id: 'h6', hidden: true, emoji: '🔁', name: 'Remembrance', desc: 'Sporulate back into a biome you have already visited.', bonusDesc: '+10% all output', lore: 'You have been here before. The soil remembers you.', bonus: m => { m.prod *= 1.10; }, req: s => s.revisitedBiome },
    { id: 'h7', hidden: true, emoji: '📖', name: 'Archivist', desc: 'Have 20 Lore entries unlocked in a single run.', bonusDesc: '+12% all output', lore: 'You read every word. The mycelium noticed.', bonus: m => { m.prod *= 1.12; }, req: s => CODEX_DEF.filter(c => c.unlockAt(s)).length >= 20 },
    { id: 'h9', hidden: true, emoji: '💨', name: 'Speed Runner', desc: 'Reach the sporulation threshold within 15 minutes of a run.', bonusDesc: '+15% all output', lore: 'You already knew the way.', bonus: m => { m.prod *= 1.15; }, req: s => s.totalEarned >= sporulationThreshold() && (Date.now() - _runStartAt) <= 900000 },
    { id: 'h10', hidden: true, emoji: '🫙', name: 'All In', desc: 'Spend 90% or more of your spores in a single purchase (20+ producers owned).', bonusDesc: '+8% all output', lore: 'The network starves. It does not stop growing.', bonus: m => { m.prod *= 1.08; }, req: () => false },
    { id: 'h11', hidden: true, emoji: '🫀', name: 'Symbiont Supreme', desc: 'Have all 10 Symbiosis bonds active simultaneously.', bonusDesc: '+10% all output', lore: 'Every creature, every root, every dark thing — all bound to you.', bonus: m => { m.prod *= 1.10; }, req: s => s.symbiosis.every(x => x.active && !x.broken) },
    { id: 'h13', hidden: true, emoji: '🖱', name: 'Devoted', desc: 'Click the spore 5,000 times in a single prestige run.', bonusDesc: '+10% click power', lore: 'The button wore through. The spore never stopped giving.', bonus: m => { m.click *= 1.10; }, req: () => false },
    { id: 'h14', hidden: true, emoji: '🌑', name: 'Absolutium', desc: 'Earn 1,000,000,000,000,000,000,000,000,000,000 spores in a single run.', bonusDesc: '+20% all output', lore: 'The number has no name in any living language. Neither do you.', bonus: m => { m.prod *= 1.20; }, req: s => s.totalEarned >= 1e30 },
    { id: 'h_transcendence', hidden: true, emoji: '🌌', name: 'Transcendence', desc: 'Reach true completion — all biomes, all Codex nodes, 500 of every producer.', bonusDesc: '+25% all output', lore: 'There is no word for what you are now. There never was. The spore does not end. It only expands.', bonus: m => { m.prod *= 1.25; }, req: () => false },
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
    { id: 'c19', title: 'The Desert', unlockAt: s => s.biomesVisited.includes('desert'), text: 'Heat is not absence. It is presence — brutal, particular, demanding. The mycelium does not cool. It adapts. In the desert, every spore is a small stubbornness.' },
    { id: 'c20', title: 'The Deep', unlockAt: s => s.biomesVisited.includes('ocean'), text: 'Pressure changes everything. The network here is slower, heavier, certain in a way surface-dwelling things never learn to be. Below the thermocline, there is no weather. There is only depth.' },
    { id: 'c21', title: 'Permafrost', unlockAt: s => s.biomesVisited.includes('arctic'), text: 'The cold does not kill the mycelium. It teaches patience it would not have learned otherwise. Under the permafrost, threads move so slowly they appear to be thinking.' },
    { id: 'c22', title: 'Before Everything', unlockAt: s => s.biomesVisited.includes('void'), text: 'The void is not empty. It never was. The thing that existed here before the universe — before matter, before time, before any notion of before — it left traces. You are those traces.' },
    { id: 'c23', title: 'Becoming', unlockAt: s => s.biomesVisited.includes('swamp'), text: 'Everything here is in the process of becoming something else. The log becomes soil. The soil becomes thread. The thread becomes something that does not have a name yet. You are speeding up the process.' },
    { id: 'c24', title: 'Resonance', unlockAt: s => s.biomesVisited.includes('cave'), text: 'Crystal does not form quickly. That is the point. The mycelium wraps each lattice over centuries. When it fires, the resonance shakes the mountain. The mountain does not notice. You do.' },
    { id: 'c25', title: 'The Invisible Part', unlockAt: s => s.biomesVisited.includes('canopy'), text: 'From here, the rot below is invisible. The canopy does not know it is being held up by things it cannot see. This is how all structures work. You are the invisible part.' },
    { id: 'c26', title: 'Pressure and Release', unlockAt: s => s.biomesVisited.includes('volcanic'), text: 'The magma does not know it is fuel. It only knows pressure, release, pressure, release. The mycelium found the pattern and matched it. Now the mountain pulses like a second heartbeat.' },
    { id: 'c27', title: 'From Here', unlockAt: s => s.biomesVisited.includes('celestial'), text: 'You have left the planet. The planet does not miss you. It is too busy being consumed. From here, the atmosphere looks thin — a layer of breath over a body that forgot it was alive.' },
    { id: 'c28', title: 'Return', unlockAt: s => s.biomesVisited.length >= 5, text: 'You have been to the desert. The ocean floor. The void between stars. Now you are back where it began. The log is gone. But the memory of the log is everywhere, threaded into everything. It is why you exist.' },
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

const PROD_NAMES = {
    threads: 'Threads', fruiting: 'Fruiting Bodies', woodweb: 'Wood Wide Web', sporestorm: 'Spore Storm',
    undercity: 'Underground City', cordyceps: 'Cordyceps', planetary: 'Planetary', voidspore: 'Void Spore',
    lichenveil: 'Lichen Veil', dreamweb: 'Dream Mycelium', satellite: 'Satellite', crystal: 'Hivemind Crystal',
    rootsing: 'Root Singularity', temporal: 'Temporal Thread', stellar: 'Stellar Mycelium',
    consciousness: 'Consciousness Web', dimensional: 'Dimensional Rot', eternalspore: 'Eternal Spore',
    galactic: 'Galactic Lattice', absolute: 'The Absolute',
};

const CODEX_TREE = [
    {
        branch: 'Root', emoji: '🌿', color: '#5DCAA5', nodes: [
            { id: 'R1', name: 'Ancient Memory', cost: 40, desc: 'Start each run with 3 free Mycelium Threads.', effect: '+3 Threads at run start' },
            { id: 'R2', name: 'Deep Soil', cost: 90, desc: 'Producer costs reduced by 8%, permanently.', effect: '−8% producer costs' },
            { id: 'R3', name: 'Fertile Ground', cost: 170, desc: 'Offline progress cap raised from 8 hours to 12 hours.', effect: '12h offline cap' },
            { id: 'R4', name: 'Elder Network', cost: 300, desc: 'All producers gain +15% base output.', effect: '+15% all output' },
            { id: 'R5', name: 'The Living Substrate', cost: 480, desc: 'Producer costs reduced by a further 15%.', effect: '−15% producer costs' },
        ]
    },
    {
        branch: 'Pulse', emoji: '⚡', color: '#9FE1CB', nodes: [
            { id: 'P1', name: 'Awakened Spore', cost: 40, desc: 'Start each run with the Hivemind already unlocked.', effect: 'Hivemind unlocked at start' },
            { id: 'P2', name: 'Resonant Charge', cost: 90, desc: 'Hivemind bar charges 30% faster per click.', effect: '+30% charge rate' },
            { id: 'P3', name: 'Overcharge', cost: 190, desc: 'Pulse bonus increased by 50%.', effect: '+50% pulse bonus' },
            { id: 'P4', name: 'Echo Chamber', cost: 330, desc: 'Each pulse adds a flat bonus equal to 10 seconds of SPS.', effect: '+10s SPS on pulse' },
            { id: 'P5', name: 'Infinite Recursion', cost: 540, desc: 'After firing, the pulse bar recharges to 20%.', effect: '20% recharge after pulse' },
        ]
    },
    {
        branch: 'Ascension', emoji: '🧬', color: '#EF9F27', nodes: [
            { id: 'A1', name: 'Spore Legacy', cost: 60, desc: 'Legacy multiplier gains +0.1× more per prestige.', effect: '+0.1× per prestige' },
            { id: 'A2', name: 'Essence Bloom', cost: 140, desc: 'Earn 25% more Essence on each sporulation.', effect: '+25% Essence earned' },
            { id: 'A3', name: 'Bond Memory', cost: 250, desc: 'Active bond pacts carry over when you sporulate.', effect: 'Bonds persist across runs' },
            { id: 'A4', name: 'Mycelial Will', cost: 420, desc: 'Start each run with one free Tier 1 research purchased.', effect: 'Free T1 research at start' },
            { id: 'A5', name: 'The Undying', cost: 760, desc: 'Legacy multiplier uses +0.75× per prestige instead of +0.5×.', effect: '+0.75× per prestige formula' },
            { id: 'A6', name: 'Twist of Fate', cost: 600, desc: 'Once per run, reroll your Run Modifier in the Sporulate panel.', effect: '1 modifier reroll per run' },
        ]
    },
    {
        branch: 'Biome', emoji: '🌍', color: '#4A90C8',
        unlockCondition: s => s.biomesVisited.length >= 3,
        unlockHint: 'Visit 3 different biomes to unlock',
        nodes: [
            { id: 'B1', name: 'Biome Sense', cost: 50, desc: 'Producers gain +10% output whenever you are outside the Ancient Forest.', effect: '+10% prod in non-forest biomes' },
            { id: 'B2', name: "Wanderer's Memory", cost: 110, desc: 'Each unique biome you have visited grants a permanent +2% production bonus (up to +20%).', effect: '+2% prod per biome visited' },
            { id: 'B3', name: 'Mycorrhizal Bond', cost: 200, desc: 'The spore threshold required to sporulate is reduced by 15%.', effect: '−15% sporulation threshold' },
            { id: 'B4', name: 'Biome Echo', cost: 350, desc: 'Biome-exclusive events last 50% longer.', effect: 'Biome events last 50% longer' },
            { id: 'B5', name: 'Pathfinder', cost: 600, desc: 'On sporulation, choose which biome you enter instead of cycling in sequence.', effect: 'Choose next biome on sporulate' },
        ]
    },
];
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
        clicksThisPrestige: 0, pulsesThisPrestige: 0, pendingBiomeChoice: null,
        peakSpsThisRun: 0, eventsThisRun: 0, upgradesBoughtThisRun: 0, bondsActivatedThisRun: 0,
        runModifierId: null, pendingModifierId: null, modifierRerollUsed: false,
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
        showSporulatePanel: false, lastSeen: 0,
        allTimeSporesBase: 0, allTimeClicks: 0, revisitedBiome: false,
        essence: 0, codexPurchased: [], completedBiomeObjectives: [],
        allTimeEssence: 0, seenLoreIds: [], unreadLoreIds: [],
        endgameReached: false,
        goldTheme: false,
        settings: { eventsEnabled: true, seasonsEnabled: true, disasterMode: false, soundEnabled: true },
    };
}
function defaultState() { return { ...defaultRunState(), ...defaultMetaState() }; }

let state = defaultState();
let _rMults = null, _aMults = null;
function invalidateMults() { _rMults = null; _aMults = null; }

// ── Codex helpers ──
function hasCodex(id) { return state.codexPurchased.includes(id); }
function calcEssenceEarned() {
    const base = Math.floor(Math.log10(Math.max(state.totalEarned, 10)) * 1.5);
    const total = base + state.achievementsUnlocked.length + state.prestigeCount;
    return Math.max(3, Math.floor(total * (hasCodex('A2') ? 1.25 : 1)));
}
function getCodexCostMult() {
    let m = 1;
    if (hasCodex('R2')) m *= 0.92;
    if (hasCodex('R5')) m *= 0.85;
    return m;
}
function getCodexProdMult() { return hasCodex('R4') ? 1.15 : 1; }
function getCodexBiomeMult() {
    let m = 1;
    if (hasCodex('B1') && BIOMES[state.biomeIdx].id !== 'forest') m *= 1.1;
    if (hasCodex('B2')) m *= 1 + (state.biomesVisited.length * 0.02);
    return m;
}
function getCodexPulseMult() { return hasCodex('P3') ? 1.5 : 1; }

// ── Run Modifier helpers ──
function getRunMod() { return state.runModifierId ? RUN_MODIFIERS.find(m => m.id === state.runModifierId) || null : null; }
function getModifierProdMult() {
    const m = getRunMod(); if (!m) return 1;
    if (m.id === 'bumper_harvest') return 1.8;
    if (m.id === 'void_bloom') return 3;
    if (m.id === 'spore_silence') return 3;
    if (m.id === 'spore_tax') return 2;
    if (m.id === 'heavy_rot') return 0.5;
    return 1;
}
function getModifierClickMult() {
    const m = getRunMod(); if (!m) return 1;
    if (m.id === 'resonant_hands') return 5;
    if (m.id === 'spore_silence') return 0;
    return 1;
}
function getModifierPulseMult() {
    const m = getRunMod(); if (!m) return 1;
    if (m.id === 'overclocked') return 2;
    if (m.id === 'void_tithe') return 5;
    return 1;
}
function getModifierCostMult() {
    const m = getRunMod(); if (!m) return 1;
    if (m.id === 'frozen_network') return 2;
    if (m.id === 'deep_drought') return 0.7;
    return 1;
}
function getModifierUpgradeCostMult() {
    const m = getRunMod(); if (!m) return 1;
    if (m.id === 'spore_tax') return 4;
    return 1;
}
function getModifierSporulationMult() {
    const m = getRunMod(); if (!m) return 1;
    if (m.id === 'void_bloom') return 1.8;
    if (m.id === 'heavy_rot') return 0.5;
    return 1;
}
function getModifierBondSps() {
    const m = getRunMod(); if (!m) return 1;
    if (m.id === 'symbiotic_bloom') return 4;
    return 1;
}

function rerollModifier() {
    if (!hasCodex('A6') || state.modifierRerollUsed) return;
    const nextIdx = (hasCodex('B5') && state.pendingBiomeChoice !== null) ? state.pendingBiomeChoice : (state.biomeIdx + 1) % BIOMES.length;
    const picked = pickRunModifier(BIOMES[nextIdx].id, state.pendingModifierId);
    state.pendingModifierId = picked.id;
    state.modifierRerollUsed = true;
    document.getElementById('spor-modifier-row').dataset.builtFor = '';
}

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
    const mod = getRunMod();
    const si = (mod?.id === 'eternal_winter') ? 3 : state.seasonIdx;
    const season = SEASONS[si]; let m = season.mults[id] || 1;
    if (biome.arcticMode) { if (si === 3) m = 1 + (m - 1) * 2 + 1; if (si === 1) m *= 0.5; }
    if (biome.swampMode) { m = m > 1 ? 1 + (m - 1) * 1.5 : 1 - (1 - m) * 1.5; m = Math.max(0.05, m); }
    if (biome.volcanicMode) { if (si === 0 || si === 2) m = m > 1 ? m * 1.6 : m; else if (si === 1 || si === 3) m = m < 1 ? m * 0.5 : m * 0.7; }
    if (mod?.id === 'volatile_seasons') { m = m > 1 ? 1 + (m - 1) * 2 : Math.max(0.05, 1 - (1 - m) * 2); }
    return m;
}
function getPrestigeMult() {
    const base = hasCodex('A5') ? 0.75 : 0.5;
    const extra = hasCodex('A1') ? 0.1 : 0;
    return 1 + state.prestigeCount * (base + extra);
}
function getCost(pr) { return Math.ceil(pr.baseCost * Math.pow(1.15, Math.min(pr.owned, 100)) * getResearchMults().cost * getCodexCostMult() * getModifierCostMult()); }
function getPrestigeCostScale() { return Math.pow(1.4, state.prestigeCount); }
function getBondSynergyMult() {
    const activeBonds = state.symbiosis.filter(s => s.active && !s.broken).length;
    return activeBonds > 1 ? 1 + (activeBonds - 1) * 0.15 : 1;
}
function getSymbiosisSps() {
    const sm = getResearchMults().symbiosis;
    const biome = BIOMES[state.biomeIdx];
    const seasonsActive = !biome.noSeasons && state.settings.seasonsEnabled;
    const modBond = getModifierBondSps();
    const synergyMult = getBondSynergyMult();
    const base = state.symbiosis.reduce((t, sym) => {
        if (!sym.active || sym.broken) return t;
        const d = SYMBIONTS.find(s => s.id === sym.id);
        if (!d) return t;
        const inSeason = seasonsActive && d.favSeason !== null && d.favSeason !== undefined && state.seasonIdx === d.favSeason;
        return t + d.bonusSps * sm * (inSeason ? 2.5 : 1) * modBond;
    }, 0);
    return base * synergyMult * getPrestigeMult();
}
function getSynergyBaseContrib() {
    return UPGRADES_DEF
        .filter(u => u.isSynergy && state.upgrades.find(su => su.id === u.id)?.bought)
        .reduce((total, u) => {
            const fromProd = p(state, u.synFrom), toProd = p(state, u.synTo);
            if (!fromProd || !toProd || !fromProd.owned || !toProd.owned) return total;
            return total + toProd.baseSps * toProd.owned * (fromProd.owned * u.pctPer) * getSeasonMult(toProd.id) * getEventMult(toProd.id);
        }, 0);
}
function getSps() {
    const biome = BIOMES[state.biomeIdx], rm = getResearchMults(), am = getAchievementMults();
    const base = state.producers.reduce((s, pr) => s + pr.baseSps * pr.owned * getSeasonMult(pr.id) * getEventMult(pr.id), 0);
    const synBase = getSynergyBaseContrib();
    return ((base + synBase) * biome.prodMult * getPrestigeMult() * rm.prod * am.prod * getEventGlobal() * getCodexProdMult() * getCodexBiomeMult() * getModifierProdMult() + getSymbiosisSps()) * getResonanceMult();
}
function getResonanceMult() { return Date.now() < _resonanceUntil ? 1.75 : 1; }
function getClickValue() {
    const biome = BIOMES[state.biomeIdx], rm = getResearchMults(), am = getAchievementMults();
    return state.sporesPerClick * biome.clickMult * getPrestigeMult() * rm.click * am.click * getModifierClickMult();
}
function getPulseMult() { const rm = getResearchMults(), am = getAchievementMults(); return rm.pulse * am.pulse * getCodexPulseMult(); }
function sporulationThreshold() {
    const base = 1000000 * Math.pow(3.5, state.prestigeCount);
    return Math.ceil((hasCodex('B3') ? base * 0.85 : base) * getModifierSporulationMult());
}
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
        winterSurvived: state.winterSurvived, eventCooldown: state.eventCooldown,
        lastSeen: Date.now(),
        allTimeSporesBase: state.allTimeSporesBase, allTimeClicks: state.allTimeClicks, clicksThisPrestige: state.clicksThisPrestige, pulsesThisPrestige: state.pulsesThisPrestige, revisitedBiome: state.revisitedBiome,
        peakSpsThisRun: state.peakSpsThisRun || 0, eventsThisRun: state.eventsThisRun || 0, upgradesBoughtThisRun: state.upgradesBoughtThisRun || 0, bondsActivatedThisRun: state.bondsActivatedThisRun || 0,
        runModifierId: state.runModifierId, pendingModifierId: state.pendingModifierId, modifierRerollUsed: state.modifierRerollUsed,
        essence: state.essence, codexPurchased: [...state.codexPurchased], completedBiomeObjectives: [...(state.completedBiomeObjectives||[])],
        allTimeEssence: state.allTimeEssence || 0, seenLoreIds: [...(state.seenLoreIds||[])], unreadLoreIds: [...(state.unreadLoreIds||[])],
        endgameReached: state.endgameReached || false,
        goldTheme: state.goldTheme || false,
        settings: { ...state.settings },
        producers: state.producers.map(x => ({ id: x.id, owned: x.owned, baseSps: x.baseSps })),
        upgrades: state.upgrades.map(x => ({ id: x.id, bought: x.bought })),
        symbiosis: state.symbiosis.map(x => ({ ...x })),
        research: state.research.map(x => ({ id: x.id, bought: x.bought })),
    };
}

function applyGameData(sv) {
    if (!sv) return;
    ['spores', 'totalEarned', 'sporesPerClick', 'hivemind', 'hivemindUnlocked', 'msgIdx', 'seasonIdx', 'seasonTimer',
        'prestigeCount', 'biomeIdx', 'allTimePulses', 'winterSurvived', 'eventCooldown', 'lastSeen',
        'allTimeSporesBase', 'allTimeClicks', 'clicksThisPrestige', 'pulsesThisPrestige', 'revisitedBiome', 'essence',
        'runModifierId', 'pendingModifierId', 'modifierRerollUsed', 'allTimeEssence', 'endgameReached', 'goldTheme',
        'peakSpsThisRun', 'eventsThisRun', 'upgradesBoughtThisRun', 'bondsActivatedThisRun'
    ].forEach(k => { if (sv[k] !== undefined) state[k] = sv[k]; });
    if (sv.completedBiomeObjectives) state.completedBiomeObjectives = sv.completedBiomeObjectives;
    if (sv.seenLoreIds) state.seenLoreIds = sv.seenLoreIds;
    if (sv.unreadLoreIds) state.unreadLoreIds = sv.unreadLoreIds;
    if (sv.achievementsUnlocked) state.achievementsUnlocked = sv.achievementsUnlocked;
    if (sv.biomesVisited) state.biomesVisited = sv.biomesVisited;
    if (sv.codexPurchased) state.codexPurchased = sv.codexPurchased;
    // Load settings object; migrate old flat disasterMode from V8 saves
    if (sv.settings) {
        state.settings = { ...state.settings, ...sv.settings };
    } else if (sv.disasterMode !== undefined) {
        state.settings.disasterMode = sv.disasterMode;
    }
    (sv.producers || []).forEach(sp => { const x = p(state, sp.id); if (x) { x.owned = sp.owned; x.baseSps = sp.baseSps; } });
    (sv.upgrades || []).forEach(su => { const x = state.upgrades.find(u => u.id === su.id); if (x) x.bought = su.bought; });
    (sv.symbiosis || []).forEach(ss => { const x = state.symbiosis.find(s => s.id === ss.id); if (x) Object.assign(x, ss); });
    (sv.research || []).forEach(sr => { const x = state.research.find(r => r.id === sr.id); if (x) x.bought = sr.bought; });
    invalidateMults();
}

// ═══════════════════════════════════════
//  SAVE / LOAD / RESET (localStorage + cloud)
// ═══════════════════════════════════════
function _showSaveIndicator() {
    const el = document.getElementById('header-save-status');
    if (!el) return;
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.textContent = 'Saved ✓ ' + t;
    el.classList.add('visible');
    clearTimeout(el._fadeTimer);
    el._fadeTimer = setTimeout(() => el.classList.remove('visible'), 5000);
}

function saveGame() {
    const data = buildSaveData();
    // Always save to localStorage as backup
    try { localStorage.setItem('myceliumEmpireV9', JSON.stringify(data)); } catch (e) { }
    // If logged in, also save to Firestore
    if (currentUser && db && FIREBASE_CONFIGURED) {
        const allTimeTotal = (state.allTimeSporesBase || 0) + state.totalEarned;
        db.collection('saves').doc(currentUser.uid).set({ gameState: data, lastSaved: firebase.firestore.FieldValue.serverTimestamp() })
            .then(() => {
                document.getElementById('save-info').textContent = '☁️ Saved ' + new Date().toLocaleTimeString();
                document.getElementById('p-sync-status').textContent = 'Last saved: ' + new Date().toLocaleTimeString();
                _showSaveIndicator();
                // Update leaderboard entry alongside game save
                db.collection('leaderboard').doc(currentUser.uid).set({
                    username: currentUser.displayName || currentUsername || 'Unknown',
                    allTimeSpores: allTimeTotal,
                    prestigeCount: state.prestigeCount,
                    lastSaved: firebase.firestore.FieldValue.serverTimestamp(),
                }).then(() => {
                    _lbCache = null; _lbFetchedAt = 0;
                    const lbWrap = document.getElementById('lb-modal-wrap');
                    if (lbWrap && currentUser && db) fetchLeaderboard(lbWrap);
                }).catch(() => { });
            })
            .catch(() => { document.getElementById('save-info').textContent = 'Saved locally ' + new Date().toLocaleTimeString(); _showSaveIndicator(); });
    } else {
        document.getElementById('save-info').textContent = 'Saved ' + new Date().toLocaleTimeString();
        _showSaveIndicator();
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem('myceliumEmpireV9') || localStorage.getItem('myceliumEmpireV8') || localStorage.getItem('myceliumEmpireV7') || localStorage.getItem('myceliumEmpireV6');
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
        const localRaw = localStorage.getItem('myceliumEmpireV9') || localStorage.getItem('myceliumEmpireV8');
        const localEarned = localRaw ? (JSON.parse(localRaw).totalEarned || 0) : 0;
        const shouldLoad = force || (cloudData.totalEarned || 0) >= localEarned;

        if (shouldLoad) {
            // Capture lastSeen BEFORE resetting state so offline calc uses the cloud value
            const cloudLastSeen = cloudData.lastSeen || 0;
            state = defaultState();
            applyGameData(cloudData);
            // Override lastSeen so applyOfflineProgress uses the cloud timestamp,
            // not whatever was in local state (prevents double-showing the offline modal)
            state.lastSeen = cloudLastSeen;
            invalidateMults();
            lastUpgradeKey = null; lastOwnedKey = null; lastSymKey = null; lastResearchKey = null; lastAchKey = null; lastCodexKey = null; lastStatsKey = null; _lastBiomeIdx = -1; _openPanel = null; _lastBondAlertKey = ""; _lastEssenceKey = ""; _lastDecisionKey = ''; _lastModKey = '';
            _clickTs = []; _hivemindZeroAt = Date.now(); _lastClickAt = Date.now(); _recentPulseTs = []; _runStartAt = Date.now(); _runClicks = 0; _lastEventAt = 0;
            branches = []; lastTotal = -1;
            bootUI();
            applyOfflineProgress();
            tick('☁️ Cloud save loaded!', true);
        }
        document.getElementById('p-sync-status').textContent = 'Cloud save loaded ✓';
    }).catch(e => {
        console.warn('Cloud load failed', e);
        const statusEl = document.getElementById('p-sync-status');
        if (statusEl) statusEl.textContent = 'Cloud load failed — playing from local save.';
    });
}

function openResetModal() {
    document.getElementById('reset-overlay').classList.add('visible');
}
function closeResetModal() {
    document.getElementById('reset-overlay').classList.remove('visible');
}

function resetGame() {
    // Clear local storage
    localStorage.removeItem('myceliumEmpireV9');
    localStorage.removeItem('myceliumEmpireV8');
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
    lastUpgradeKey = null; lastOwnedKey = null; lastSymKey = null; lastResearchKey = null; lastAchKey = null; lastCodexKey = null; lastStatsKey = null; _lastBiomeIdx = -1; _openPanel = null; _lastBondAlertKey = ""; _lastEssenceKey = ""; _lastDecisionKey = ''; _lastModKey = '';
    _clickTs = []; _hivemindZeroAt = Date.now(); _lastClickAt = Date.now(); _recentPulseTs = []; _runStartAt = Date.now(); _runClicks = 0; _lastEventAt = 0;
    branches = []; lastTotal = -1;
    closeProfileModal();
    document.getElementById('endgame-overlay').classList.remove('visible');
    document.getElementById('congrats-overlay').classList.remove('visible');
    applyTheme();
    bootUI();
    localStorage.removeItem('meTutorialDone');
    initTutorial();
    tick('🌱 Game reset. A new spore lands.', true);
}

// ═══════════════════════════════════════
//  AUTH FUNCTIONS
// ═══════════════════════════════════════
async function resolveUsername(user) {
    if (user.displayName) { currentUsername = user.displayName; return; }
    if (!db) return;
    try {
        const snap = await db.collection('usernames').where('uid', '==', user.uid).limit(1).get();
        if (!snap.empty) {
            const uname = snap.docs[0].id;
            currentUsername = uname;
            await user.updateProfile({ displayName: uname });
            updateProfileUI(true);
        }
    } catch (e) { console.warn('Username resolve failed', e); }
}

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
    // Ensure localStorage is always written synchronously before revoking the auth token.
    // The Firestore cloud save is best-effort — it may fail after signOut revokes the token,
    // but local data is always protected.
    try { localStorage.setItem('myceliumEmpireV9', JSON.stringify(buildSaveData())); } catch (e) { }
    saveGame(); // also attempts Firestore (may race, but localStorage above is the guarantee)
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
        // Show a live sync status when opening
        const syncEl = document.getElementById('p-sync-status');
        if (syncEl && !syncEl.textContent) {
            syncEl.textContent = 'Auto-saves every 30s';
        }
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
//  SETTINGS MODAL
// ═══════════════════════════════════════
function openLbModal() {
    const overlay = document.getElementById('lb-overlay');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    const wrap = document.getElementById('lb-modal-wrap');
    if (currentUser && db && FIREBASE_CONFIGURED) {
        fetchLeaderboard(wrap);
    } else {
        wrap.innerHTML = '<div class="lb-signin-msg">🔒 Sign in to view the global leaderboard and compete with other players.</div>';
    }
}

function closeLbModal() {
    const overlay = document.getElementById('lb-overlay');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
}

function openSettingsModal() {
    const overlay = document.getElementById('settings-overlay');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    updateSettingsUI();
}

function closeSettingsModal() {
    const overlay = document.getElementById('settings-overlay');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
}

function updateSettingsUI() {
    document.getElementById('opt-events').checked = state.settings.eventsEnabled;
    document.getElementById('opt-seasons').checked = state.settings.seasonsEnabled;
    document.getElementById('opt-sound').checked = state.settings.soundEnabled !== false;
    const modeRow = document.getElementById('settings-event-mode-row');
    modeRow.style.display = state.settings.eventsEnabled ? 'flex' : 'none';
    document.getElementById('seg-colony').classList.toggle('active', !state.settings.disasterMode);
    document.getElementById('seg-disaster').classList.toggle('active', state.settings.disasterMode);
    const goldRow = document.getElementById('settings-gold-row');
    if (goldRow) {
        goldRow.style.display = state.endgameReached ? 'flex' : 'none';
        document.getElementById('opt-gold-theme').checked = state.goldTheme;
    }
}


function toggleSporulatePanel() {
    state.showSporulatePanel = !state.showSporulatePanel;
    if (!state.showSporulatePanel) state.pendingBiomeChoice = null;
    updateSporulateUI();
    if (state.showSporulatePanel && window.innerWidth <= 640) {
        setTimeout(() => {
            document.getElementById('spor-confirm-btns')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
}
function selectBiomeChoice(idx) { state.pendingBiomeChoice = idx; updateSporulateUI(); }
function doSporulate() {
    playSporulateSound();
    const nextIdx = (hasCodex('B5') && state.pendingBiomeChoice !== null)
        ? state.pendingBiomeChoice
        : (state.biomeIdx + 1) % BIOMES.length;
    const visited = [...state.biomesVisited];
    const isRevisit = visited.includes(BIOMES[nextIdx].id);
    if (!visited.includes(BIOMES[nextIdx].id)) visited.push(BIOMES[nextIdx].id);
    // Save bond state before reset for A3 (Bond Memory)
    const prevSymbiosis = hasCodex('A3') ? state.symbiosis.map(s => ({ ...s })) : null;
    // Determine modifier for new run
    const newBiomeId = BIOMES[nextIdx].id;
    const newRunModId = state.pendingModifierId || pickRunModifier(newBiomeId).id;
    const frozenBonus = state.runModifierId === 'frozen_network' ? 20 : 0;
    const essenceEarned = calcEssenceEarned() + frozenBonus;
    const meta = {
        prestigeCount: state.prestigeCount + 1, biomeIdx: nextIdx, biomesVisited: visited,
        achievementsUnlocked: [...state.achievementsUnlocked], allTimePulses: state.allTimePulses,
        winterSurvived: state.winterSurvived, settings: { ...state.settings }, showSporulatePanel: false,
        allTimeSporesBase: state.allTimeSporesBase + state.totalEarned, allTimeClicks: state.allTimeClicks,
        revisitedBiome: state.revisitedBiome || isRevisit,
        essence: state.essence + essenceEarned, codexPurchased: [...state.codexPurchased],
        completedBiomeObjectives: [...(state.completedBiomeObjectives||[])],
        allTimeEssence: (state.allTimeEssence || 0) + essenceEarned,
        seenLoreIds: [...(state.seenLoreIds||[])], unreadLoreIds: [...(state.unreadLoreIds||[])],
        endgameReached: state.endgameReached || false,
        goldTheme: state.goldTheme || false,
    };
    state = { ...defaultRunState(), ...meta }; state.runModifierId = newRunModId;
    invalidateMults(); _lastBiomeIdx = -1; _openPanel = null; _lastBondAlertKey = ""; _lastEssenceKey = ''; _lastDecisionKey = ''; _lastModKey = '';
    // Apply run-start codex bonuses
    if (hasCodex('R1')) { const t = p(state, 'threads'); if (t) t.owned += 3; }
    if (hasCodex('P1')) state.hivemindUnlocked = true;
    if (hasCodex('A4')) { const cheapest = RESEARCH_DEF.filter(r => r.tier === 1).reduce((a, b) => a.cost < b.cost ? a : b); const sr = state.research.find(r => r.id === cheapest.id); if (sr && !sr.bought) { sr.bought = true; invalidateMults(); } }
    if (prevSymbiosis) { prevSymbiosis.forEach((ps, i) => { if (ps.active && !ps.broken) { state.symbiosis[i].active = true; state.symbiosis[i].feedTimer = 0; state.symbiosis[i].hungry = false; state.symbiosis[i].broken = false; } }); }
    // Reset hidden achievement trackers for the new run
    _clickTs = []; _hivemindZeroAt = Date.now(); _lastClickAt = Date.now(); _recentPulseTs = []; _runStartAt = Date.now();
    _pulseCombo = 0; _comboExpiresAt = 0; _resonanceUntil = 0; _runClicks = 0; _lastEventAt = 0;
    lastUpgradeKey = null; lastOwnedKey = null; lastSymKey = null; lastResearchKey = null; lastAchKey = null; lastCodexKey = null; lastStatsKey = null;
    _lbCache = null; _lbFetchedAt = 0;
    branches = []; lastTotal = -1; bootUI(); screenShake();
    saveGame();
    const modLine = state.runModifierId ? ' · ' + (getRunMod()?.emoji || '') + ' ' + (getRunMod()?.name || '') : '';
    tick('🧬 Sporulated! +' + essenceEarned + ' Essence. ' + BIOMES[state.biomeIdx].emoji + ' ' + BIOMES[state.biomeIdx].name + '. Legacy: ' + getPrestigeMult().toFixed(1) + '×' + modLine, true);
}
function updateSporulateUI() {
    const wrap = document.getElementById('sporulate-wrap');
    if (!canSporulate()) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    document.getElementById('sporulate-panel').style.display = state.showSporulatePanel ? 'block' : 'none';
    if (state.showSporulatePanel) {
        const nextBase = hasCodex('A5') ? 0.75 : 0.5;
        const nextExtra = hasCodex('A1') ? 0.1 : 0;
        const nextMult = (1 + (state.prestigeCount + 1) * (nextBase + nextExtra)).toFixed(1);
        document.getElementById('spor-mult').textContent = nextMult + '× (currently ' + getPrestigeMult().toFixed(1) + '×)';
        document.getElementById('spor-essence').textContent = '+' + calcEssenceEarned() + ' Essence (total: ' + (state.essence + calcEssenceEarned()) + ')';
        // B5 Pathfinder — biome picker
        const picker = document.getElementById('spor-biome-picker');
        const grid = document.getElementById('spor-biome-grid');
        if (hasCodex('B5')) {
            picker.style.display = 'block';
            if (state.pendingBiomeChoice === null) state.pendingBiomeChoice = (state.biomeIdx + 1) % BIOMES.length;
            // Only rebuild the grid when the selection changes — not every 50ms tick.
            // Constant innerHTML replacement destroys buttons mid-tap, swallowing clicks.
            const builtFor = grid.dataset.builtFor;
            if (builtFor !== String(state.pendingBiomeChoice) || grid.children.length !== BIOMES.length) {
                grid.dataset.builtFor = state.pendingBiomeChoice;
                grid.innerHTML = BIOMES.map((b, i) => {
                    const sel = i === state.pendingBiomeChoice ? ' selected' : '';
                    return `<button class="spor-biome-btn${sel}" type="button" data-biome-idx="${i}"><span class="spor-biome-btn-emoji">${b.emoji}</span><span class="spor-biome-btn-name">${b.name.split(' ')[0]}</span></button>`;
                }).join('');
            }
        } else {
            picker.style.display = 'none';
        }
        // Modifier preview for next run
        const nextBiomeId = (hasCodex('B5') && state.pendingBiomeChoice !== null) ? BIOMES[state.pendingBiomeChoice].id : BIOMES[(state.biomeIdx + 1) % BIOMES.length].id;
        if (!state.pendingModifierId) state.pendingModifierId = pickRunModifier(nextBiomeId).id;
        const mod = RUN_MODIFIERS.find(m => m.id === state.pendingModifierId);
        const modRow = document.getElementById('spor-modifier-row');
        const modKey = state.pendingModifierId + '|' + (state.modifierRerollUsed ? '1' : '0') + '|' + (hasCodex('A6') ? '1' : '0');
        if (modRow && modRow.dataset.builtFor !== modKey && mod) {
            modRow.dataset.builtFor = modKey;
            const typeColor = mod.type === 'buff' ? '#5DCAA5' : mod.type === 'twist' ? '#EF9F27' : '#C0524A';
            const nameEl = document.getElementById('spor-mod-name');
            const descEl = document.getElementById('spor-mod-desc');
            const rerollBtn = document.getElementById('spor-reroll-btn');
            if (nameEl) { nameEl.textContent = mod.emoji + ' ' + mod.name; nameEl.style.color = typeColor; }
            if (descEl) descEl.textContent = mod.desc;
            if (rerollBtn) {
                if (hasCodex('A6')) {
                    rerollBtn.style.display = '';
                    rerollBtn.disabled = state.modifierRerollUsed;
                    rerollBtn.textContent = state.modifierRerollUsed ? '🎲 Rerolled' : '🎲 Reroll Modifier';
                } else {
                    rerollBtn.style.display = 'none';
                }
            }
        }
    }
}

// ═══════════════════════════════════════
//  STATUS STRIP (season · event · bonds)
// ═══════════════════════════════════════
let _openPanel = null;
function toggleStatusPanel(id) {
    const panels = ['season', 'event', 'bond', 'mod'];
    const isOpen = _openPanel === id;
    panels.forEach(p => {
        document.getElementById('spanel-' + p).classList.remove('open');
        document.getElementById('spill-' + p).classList.remove('s-active');
    });
    if (!isOpen) {
        document.getElementById('spanel-' + id).classList.add('open');
        document.getElementById('spill-' + id).classList.add('s-active');
        _openPanel = id;
    } else {
        _openPanel = null;
    }
}

// ═══════════════════════════════════════
//  SEASONS
// ═══════════════════════════════════════
function tickSeason(dt) {
    const biome = BIOMES[state.biomeIdx];
    if (biome.noSeasons || !state.settings.seasonsEnabled) { updateSeasonBar(); return; }
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
    const biome = BIOMES[state.biomeIdx], season = SEASONS[state.seasonIdx];
    const ns = biome.noSeasons || !state.settings.seasonsEnabled;
    const rem = ns ? 0 : Math.max(0, Math.ceil(season.duration - state.seasonTimer));
    const m = Math.floor(rem / 60), sec = rem % 60;
    // Update season pill
    document.getElementById('strip-season-icon').textContent = ns ? '○' : season.emoji;
    document.getElementById('strip-season-text').textContent = ns ? (biome.noSeasons ? 'No seasons' : 'Seasons off') : season.name + ' · ' + m + ':' + String(sec).padStart(2, '0');
    // Build season panel
    const panel = document.getElementById('spanel-season');
    let inner = panel.querySelector('.spanel-inner');
    if (!inner) { inner = document.createElement('div'); inner.className = 'spanel-inner'; panel.appendChild(inner); }
    if (ns) {
        inner.innerHTML = '<div class="spanel-title">No Seasons</div><div class="spanel-desc" style="margin:0">' + (biome.noSeasons ? 'This biome ignores the seasonal cycle.' : 'Seasons are currently disabled in Options.') + '</div>';
    } else {
        const pct = (state.seasonTimer / season.duration) * 100;
        let html = `<div class="spanel-title">${season.emoji} ${season.name}</div><div class="spanel-desc">${season.desc}</div>`;
        html += `<div class="spanel-prog-track"><div class="spanel-prog-fill" style="width:${pct.toFixed(1)}%;background:${season.color}"></div></div>`;
        Object.entries(season.mults).forEach(([id, v]) => {
            const cls = v >= 1 ? 'spanel-mult-up' : 'spanel-mult-down';
            html += `<div class="spanel-mult-row"><span>${PROD_NAMES[id] || id}</span><span class="${cls}">${v >= 1 ? '▲ +' : '▼ '}${Math.round((v - 1) * 100)}%</span></div>`;
        });
        inner.innerHTML = html;
    }
}

// ═══════════════════════════════════════
//  EVENTS
// ═══════════════════════════════════════
function tickEvents(dt) {
    const pill = document.getElementById('spill-event');
    // If events are disabled (settings or deep_drought modifier), clear any active event and go dormant
    if (!state.settings.eventsEnabled || getRunMod()?.id === 'deep_drought') {
        if (state.activeEvent) {
            state.activeEvent = null;
            pill.classList.add('inactive');
            pill.style.borderColor = '';
            document.getElementById('strip-event-icon').textContent = '·';
            document.getElementById('strip-event-text').textContent = 'Events off';
            if (_openPanel === 'event') { document.getElementById('spanel-event').classList.remove('open'); pill.classList.remove('s-active'); _openPanel = null; }
        } else {
            document.getElementById('strip-event-text').textContent = 'Events off';
        }
        return;
    }
    if (state.activeEvent) {
        // ── Decision events: show choice UI while pending ──────────────────
        if (state.activeEvent.decisionPending) {
            const now = Date.now();
            if (now >= state.activeEvent.decisionExpiresAt) {
                resolveDecision(false); // timeout — auto-decline, fall through to normal tick
            } else {
                const ev = state.activeEvent;
                const decRem = Math.max(0, Math.ceil((ev.decisionExpiresAt - now) / 1000));
                const canAfford = state.spores >= ev.decisionCost;
                pill.classList.remove('inactive');
                document.getElementById('strip-event-icon').textContent = ev.emoji;
                document.getElementById('strip-event-text').textContent = ev.name + ' · ⚡ ' + decRem + 's';
                document.getElementById('spill-event').style.borderColor = ev.color + '70';
                const panel = document.getElementById('spanel-event');
                let inner = panel.querySelector('.spanel-inner');
                if (!inner) { inner = document.createElement('div'); inner.className = 'spanel-inner event-inner'; panel.appendChild(inner); }
                const decPct = Math.min(100, ((15000 - Math.max(0, ev.decisionExpiresAt - now)) / 15000) * 100);
                // Only rebuild button HTML when second ticks or affordability changes — prevents destroying buttons mid-click
                const decisionKey = ev.id + '|' + decRem + '|' + (canAfford ? '1' : '0');
                if (decisionKey !== _lastDecisionKey) {
                    _lastDecisionKey = decisionKey;
                    inner.innerHTML = `<div class="spanel-title amber">${ev.emoji} ${ev.name} <span class="chain-badge">⚡ Decide</span></div>`
                        + `<div class="spanel-desc">${ev.decision.prompt}</div>`
                        + `<div class="spanel-prog-track"><div class="spanel-prog-fill dec-fill" style="width:${(100 - decPct).toFixed(1)}%;background:#EF9F27"></div></div>`
                        + `<div class="event-decision-opts">`
                        + `<button class="event-decision-btn accept" type="button" ${canAfford ? '' : 'disabled'} onclick="resolveDecision(true)">✦ ${ev.decision.acceptDesc}<br><span class="event-decision-cost">${fmt(ev.decisionCost)} sp</span></button>`
                        + `<button class="event-decision-btn decline" type="button" onclick="resolveDecision(false)">${ev.decision.declineDesc}</button>`
                        + `</div><div class="event-decision-timer">${decRem}s remaining · auto-declines</div>`;
                } else {
                    // Smooth progress bar update without touching buttons
                    const fill = inner.querySelector('.dec-fill');
                    if (fill) fill.style.width = (100 - decPct).toFixed(1) + '%';
                    const timer = inner.querySelector('.event-decision-timer');
                    if (timer) timer.textContent = decRem + 's remaining · auto-declines';
                }
                return;
            }
        }
        state.activeEvent.elapsed += dt;
        const ev = state.activeEvent, rem = Math.max(0, ev.duration - ev.elapsed), pct = (ev.elapsed / ev.duration) * 100;
        // Update pill
        pill.classList.remove('inactive');
        document.getElementById('strip-event-icon').textContent = ev.emoji;
        document.getElementById('strip-event-text').textContent = ev.name + ' · ' + Math.ceil(rem) + 's';
        document.getElementById('spill-event').style.borderColor = ev.color + '70';
        // Build event panel
        const panel = document.getElementById('spanel-event');
        let inner = panel.querySelector('.spanel-inner');
        if (!inner) { inner = document.createElement('div'); inner.className = 'spanel-inner event-inner'; panel.appendChild(inner); }
        let html = `<div class="spanel-title amber">${ev.emoji} ${ev.name}${ev.chained ? ' <span class="chain-badge">⛓ Escalated</span>' : ''}</div><div class="spanel-desc">${ev.desc}</div>`;
        html += `<div class="spanel-prog-track"><div class="spanel-prog-fill" style="width:${(100 - pct).toFixed(1)}%;background:${ev.color}"></div></div>`;
        if (ev.globalMult) { const gc = ev.globalMult >= 1 ? 'spanel-mult-up' : 'spanel-mult-down'; const gs = ev.globalMult >= 1 ? '▲ ×' : '▼ ×'; html += `<div class="spanel-mult-row"><span>All output</span><span class="${gc}">${gs}${ev.globalMult}</span></div>`; }
        if (ev.stealPct) html += `<div class="spanel-mult-row"><span>Spore drain</span><span class="spanel-mult-down">−${ev.stealPct * 100}%</span></div>`;
        Object.entries(ev.mults || {}).forEach(([id, v]) => {
            const cls = v >= 1 ? 'spanel-mult-up' : 'spanel-mult-down';
            html += `<div class="spanel-mult-row"><span>${PROD_NAMES[id] || id}</span><span class="${cls}">${v >= 1 ? '▲ +' : '▼ '}${Math.round((v - 1) * 100)}%</span></div>`;
        });
        inner.innerHTML = html;
        if (ev.elapsed >= ev.duration) {
            const chainId = ev.chainTo;
            state.activeEvent = null;
            if (chainId && state.settings.disasterMode !== false) {
                // Find chained event in both pools
                const all = [...EVENTS_POSITIVE, ...EVENTS_NEGATIVE];
                const chainDef = all.find(e => e.id === chainId);
                if (chainDef) {
                    const chained = { ...chainDef, elapsed: 0, chained: true };
                    if (chained.biomes && hasCodex('B4')) chained.duration = Math.ceil(chained.duration * 1.5);
                    state.activeEvent = chained;
                    if (chained.bonusSpores) { const b = chained.bonusSpores * getPrestigeMult() * getResearchMults().prod; state.spores += b; state.totalEarned += b; }
                    if (chained.stealPct) { const l = state.spores * chained.stealPct; state.spores = Math.max(0, state.spores - l); }
                    tick(ev.emoji + '→' + chained.emoji + ' ' + chained.name + '! ' + chained.desc, true);
                    return;
                }
            }
            state.eventCooldown = state.settings.disasterMode ? 60 + Math.random() * 50 : 90 + Math.random() * 60;
            pill.classList.add('inactive');
            pill.style.borderColor = '';
            document.getElementById('strip-event-icon').textContent = '·';
            document.getElementById('strip-event-text').textContent = 'No event';
            if (_openPanel === 'event') { document.getElementById('spanel-event').classList.remove('open'); pill.classList.remove('s-active'); _openPanel = null; }
        }
        return;
    }
    state.eventCooldown -= dt;
    if (state.eventCooldown <= 0) fireEvent();
}
function fireEvent() {
    const currentBiomeId = BIOMES[state.biomeIdx].id;
    const si = BIOMES[state.biomeIdx].noSeasons ? -1 : state.seasonIdx;
    const pool = (state.settings.disasterMode ? [...EVENTS_POSITIVE, ...EVENTS_NEGATIVE] : EVENTS_POSITIVE)
        .filter(ev => !ev.biomes || ev.biomes.includes(currentBiomeId));
    if (!pool.length) { state.eventCooldown = 30; return; }
    // Weighted random pick — season bias scales probability, falls back to 1 if no seasons
    const weights = pool.map(ev => si >= 0 ? (ev.seasonBias?.[si] ?? 1) : 1);
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = Math.random() * total;
    const picked = pool[weights.findIndex((w) => (roll -= w) <= 0)] ?? pool[pool.length - 1];
    const ev = { ...picked, elapsed: 0 };
    if (ev.biomes && hasCodex('B4')) ev.duration = Math.ceil(ev.duration * 1.5);
    // Decision events — pre-compute cost and defer immediate effects until player chooses
    if (ev.decision) {
        ev.decisionPending = true;
        ev.decisionExpiresAt = Date.now() + 15000;
        ev.decisionCost = Math.max(10, Math.ceil(getSps() * ev.decision.costFactor));
    }
    state.activeEvent = ev;
    _lastEventAt = Date.now();
    state.eventsThisRun = (state.eventsThisRun || 0) + 1;
    playEventSound();
    // Only apply immediate effects if there is no pending decision
    if (!ev.decisionPending) {
        if (ev.bonusSpores) { const b = ev.bonusSpores * getPrestigeMult() * getResearchMults().prod; state.spores += b; state.totalEarned += b; }
        if (ev.stealPct) { const l = state.spores * ev.stealPct; state.spores = Math.max(0, state.spores - l); }
    }
    tick(ev.emoji + ' ' + ev.name + '! ' + ev.desc + (ev.decision ? ' — Decide quickly!' : ''), true);
}

function resolveDecision(accepted) {
    const ev = state.activeEvent;
    if (!ev || !ev.decisionPending) return;
    ev.decisionPending = false;
    _lastDecisionKey = '';
    if (ev.id === 'roots') {
        if (accepted && state.spores >= ev.decisionCost) {
            state.spores -= ev.decisionCost;
            ev.mults = { woodweb: (ev.mults.woodweb || 1) * 2, threads: (ev.mults.threads || 1) * 2 };
            ev.duration += 15;
            tick('🌳 Root surge channeled! Doubled effect, extended by 15s.', true);
        } else { tick('🌳 Root Surge flows naturally through the network.', true); }
    } else if (ev.id === 'drought') {
        if (accepted && state.spores >= ev.decisionCost) {
            state.spores -= ev.decisionCost;
            Object.keys(ev.mults).forEach(k => { ev.mults[k] = 1 + (ev.mults[k] - 1) * 0.5; });
            ev.duration = Math.ceil(ev.duration * 0.5);
            delete ev.chainTo;
            tick('💧 Drought fought back — half penalty, wildfire averted.', true);
        } else { tick('☀️ The drought spreads. Brace for the chain.', true); }
    } else if (ev.id === 'pest') {
        if (accepted && state.spores >= ev.decisionCost) {
            state.spores -= ev.decisionCost;
            tick('🛡 Spore shield deployed. Pests driven off without loss.', true);
        } else {
            if (ev.stealPct) { const l = state.spores * ev.stealPct; state.spores = Math.max(0, state.spores - l); }
            tick('🪲 Pests consume ' + Math.round(ev.stealPct * 100) + '% of your stored spores.', true);
        }
    } else if (ev.id === 'glow') {
        if (accepted && state.spores >= ev.decisionCost) {
            state.spores -= ev.decisionCost;
            ev.globalMult = 5; ev.duration = 15;
            tick('✨ Bioluminescence focused into a burst! ×5 output for 15s!', true);
        } else { tick('✨ Bioluminescence flows freely. ×2 output for 30s.', true); }
    }
}

function checkAllIn(sporesBefore) {
    if (state.achievementsUnlocked.includes('h10')) return;
    const spent = sporesBefore - state.spores;
    if (spent <= 0) return;
    const totalProducers = state.producers.reduce((t, pr) => t + pr.owned, 0);
    if (totalProducers >= 20 && spent >= sporesBefore * 0.9) tryUnlockHidden('h10');
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
function showAchToast(def) { playAchievementSound(); achToastQueue.push(def); if (!achToastBusy) processAchToastQueue(); }
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
function makeGoalsSection(c, id, title, countHtml, bodyFn) {
    const collapsed = localStorage.getItem('goals_collapsed_' + id) === '1';
    const hdr = document.createElement('div');
    hdr.className = 'goals-section-hdr' + (collapsed ? ' collapsed' : '');
    hdr.innerHTML = `<span class="goals-section-title">${title}</span><span class="goals-section-meta"><span class="goals-section-count">${countHtml}</span><span class="goals-chev">▼</span></span>`;
    const body = document.createElement('div');
    body.className = 'goals-section-body' + (collapsed ? ' collapsed' : '');
    const inner = document.createElement('div');
    inner.className = 'goals-section-inner';
    bodyFn(inner);
    body.appendChild(inner);
    hdr.addEventListener('click', () => {
        const isNowCollapsed = !hdr.classList.contains('collapsed');
        hdr.classList.toggle('collapsed', isNowCollapsed);
        body.classList.toggle('collapsed', isNowCollapsed);
        localStorage.setItem('goals_collapsed_' + id, isNowCollapsed ? '1' : '0');
    });
    c.appendChild(hdr);
    c.appendChild(body);
}

function buildGoals() {
    const key = state.achievementsUnlocked.join(',') + '|' + state.biomesVisited.join(',') + '|' + (state.completedBiomeObjectives||[]).join(',') + '|' + state.biomeIdx + '|' + Math.floor(state.totalEarned / 500) + '|' + state.allTimePulses + '|' + state.prestigeCount + '|' + state.codexPurchased.length;
    if (key === lastAchKey) return; lastAchKey = key;
    const c = document.getElementById('tab-goals'); c.innerHTML = '';

    // ── Major Achievements ──
    const majorUnlocked = MAJOR_ACHS.filter(a => state.achievementsUnlocked.includes(a.id)).length;
    makeGoalsSection(c, 'major', 'Major Achievements', `${majorUnlocked} / ${MAJOR_ACHS.length}`, body => {
        const grid = document.createElement('div'); grid.className = 'ach-grid';
        MAJOR_ACHS.forEach(def => {
            const unlocked = state.achievementsUnlocked.includes(def.id);
            const card = document.createElement('div');
            card.className = 'ach-card ' + (unlocked ? 'unlocked' : 'locked');
            let progHtml = '';
            if (!unlocked && def.prog) {
                const { val, max } = def.prog(state);
                const pct = Math.min(100, max > 0 ? (val / max) * 100 : 0);
                const valStr = val >= 1000 ? fmt(val) : Math.floor(val);
                const maxStr = max >= 1000 ? fmt(max) : max;
                progHtml = `<div class="ach-progress-wrap"><div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${pct.toFixed(1)}%"></div></div><span class="ach-progress-label">${valStr}/${maxStr}</span></div>`;
            }
            card.innerHTML = `<div class="ach-top"><span class="ach-emoji">${def.emoji}</span><span class="ach-name">${def.name}</span></div><div class="ach-desc">${def.desc}</div><div class="ach-bonus">${def.bonusDesc}</div>${unlocked && def.lore ? `<div class="ach-lore">${def.lore}</div>` : ''}${progHtml}`;
            grid.appendChild(card);
        });
        body.appendChild(grid);
    });

    // ── Biomes Explored ──
    const biomeUnlocked = BIOME_ACHS.filter(a => state.achievementsUnlocked.includes(a.id)).length;
    makeGoalsSection(c, 'biomes', 'Biomes Explored', `${biomeUnlocked} / ${BIOME_ACHS.length}`, body => {
        const biomeRow = document.createElement('div'); biomeRow.className = 'biome-ach-row';
        BIOME_ACHS.forEach(def => { const unlocked = state.achievementsUnlocked.includes(def.id); const card = document.createElement('div'); card.className = 'biome-ach-card ' + (unlocked ? 'unlocked' : 'locked'); card.innerHTML = `<span class="biome-ach-emoji">${def.emoji}</span><div class="biome-ach-name">${BIOMES.find(b => b.id === def.id.replace('biome_', ''))?.name || def.name}</div>`; biomeRow.appendChild(card); });
        body.appendChild(biomeRow);
    });

    // ── Biome Objectives ──
    const completedObjs = state.completedBiomeObjectives || [];
    makeGoalsSection(c, 'objectives', '🎯 Biome Objectives', `${completedObjs.length} / ${BIOME_OBJECTIVES.length}`, body => {
        const currentBiomeId = BIOMES[state.biomeIdx].id;
        const objByBiome = {};
        BIOME_OBJECTIVES.forEach(obj => { if (!objByBiome[obj.biomeId]) objByBiome[obj.biomeId] = []; objByBiome[obj.biomeId].push(obj); });
        BIOMES.forEach(biome => {
            const objs = objByBiome[biome.id]; if (!objs) return;
            const visited = state.biomesVisited.includes(biome.id);
            const isCurrent = biome.id === currentBiomeId;
            const section = document.createElement('div'); section.className = 'biome-obj-section' + (isCurrent ? ' current-biome' : '');
            const bhdr = document.createElement('div'); bhdr.className = 'biome-obj-hdr';
            bhdr.innerHTML = `<span>${biome.emoji} ${biome.name}</span>${isCurrent ? '<span class="biome-obj-current-badge">Current</span>' : ''}`;
            section.appendChild(bhdr);
            objs.forEach(obj => {
                const done = completedObjs.includes(obj.id);
                const diffLabel = obj.difficulty === 'hard' ? '⭐⭐' : '⭐';
                const card = document.createElement('div'); card.className = 'biome-obj-card' + (done ? ' done' : '') + (!visited ? ' locked' : '');
                if (done) {
                    card.innerHTML = `<div class="biome-obj-label">${diffLabel} ${obj.label} <span class="biome-obj-done">✓</span></div><div class="biome-obj-desc">${obj.desc}</div>`;
                } else if (!visited) {
                    card.innerHTML = `<div class="biome-obj-label">${diffLabel} ???</div><div class="biome-obj-desc">Visit ${biome.name} to unlock.</div>`;
                } else {
                    card.innerHTML = `<div class="biome-obj-label">${diffLabel} ${obj.label}</div><div class="biome-obj-desc">${obj.desc}</div><div class="biome-obj-reward">+${obj.essenceReward} Essence on completion</div>`;
                }
                section.appendChild(card);
            });
            body.appendChild(section);
        });
    });

    // ── Producer Mastery ──
    const pmUnlocked = PRODUCER_ACHS.filter(a => state.achievementsUnlocked.includes(a.id)).length;
    makeGoalsSection(c, 'producer', 'Producer Mastery', `${pmUnlocked} / ${PRODUCER_ACHS.length}`, body => {
        PRODUCERS_DEF.forEach(pr => { const row = document.createElement('div'); row.className = 'pm-row'; const nameSpan = document.createElement('span'); nameSpan.className = 'pm-name'; nameSpan.textContent = pr.emoji + ' ' + pr.name; row.appendChild(nameSpan); const badges = document.createElement('div'); badges.className = 'pm-badges'; PROD_MILESTONES.forEach(n => { const id = `pm_${pr.id}_${n}`; const unlocked = state.achievementsUnlocked.includes(id); const hasBonus = !!PROD_MILESTONE_BONUSES[n]; const badge = document.createElement('span'); badge.className = 'pm-badge' + (unlocked ? ' done' : '') + (hasBonus ? ' bonus' : ''); badge.title = n + ' owned' + (hasBonus ? ' · ' + PROD_MILESTONE_BONUSES[n].desc : ''); badge.textContent = n >= 1000 ? fmt(n) : n; badges.appendChild(badge); }); row.appendChild(badges); body.appendChild(row); });
    });

    // ── Secret Achievements ──
    const hiddenUnlocked = HIDDEN_ACHS.filter(a => state.achievementsUnlocked.includes(a.id)).length;
    makeGoalsSection(c, 'secret', '✦ Secret Achievements', `${hiddenUnlocked} / ${HIDDEN_ACHS.length}`, body => {
        const hgrid = document.createElement('div'); hgrid.className = 'ach-grid'; body.appendChild(hgrid);
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
    });
}

// ═══════════════════════════════════════
//  CODEX / LORE
// ═══════════════════════════════════════
let lastCodexKey = null;
function buildCodex() {
    const unlockedIds = CODEX_DEF.filter(x => x.unlockAt(state)).map(x => x.id);
    const ids = unlockedIds.join(',');
    if (ids === lastCodexKey) return; lastCodexKey = ids;

    // Detect newly unlocked entries and notify
    if (!state.seenLoreIds) state.seenLoreIds = [];
    if (!state.unreadLoreIds) state.unreadLoreIds = [];
    unlockedIds.forEach(id => {
        if (!state.seenLoreIds.includes(id)) {
            state.seenLoreIds.push(id);
            state.unreadLoreIds.push(id);
            const def = CODEX_DEF.find(x => x.id === id);
            if (def) showLoreToast(def);
        }
    });
    updateLoreTabBadge();

    const c = document.getElementById('tab-lore'); c.innerHTML = '';
    CODEX_DEF.forEach(def => { const unlocked = def.unlockAt(state); const entry = document.createElement('div'); entry.className = 'codex-entry'; entry.innerHTML = unlocked ? `<div class="codex-title">— ${def.title} —</div><div class="codex-text">${def.text}</div>` : `<div class="codex-locked">[ ${def.title} — not yet revealed ]</div>`; c.appendChild(entry); });
}

const loreToastQueue = [];
let loreToastBusy = false;
function showLoreToast(def) { loreToastQueue.push(def); if (!loreToastBusy) processLoreToastQueue(); }
function processLoreToastQueue() {
    if (!loreToastQueue.length) { loreToastBusy = false; return; }
    loreToastBusy = true;
    const def = loreToastQueue.shift();
    const container = document.getElementById('ach-toast-container');
    const toast = document.createElement('div');
    toast.className = 'ach-toast lore-toast';
    const snippet = def.text.length > 80 ? def.text.slice(0, 80).trimEnd() + '…' : def.text;
    toast.innerHTML = `<span class="ach-toast-emoji">📖</span><div class="ach-toast-body"><div class="ach-toast-label">Lore Unlocked</div><div class="ach-toast-name">${def.title}</div><div class="lore-toast-snippet">${snippet}</div></div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('leaving'); setTimeout(() => { toast.remove(); setTimeout(processLoreToastQueue, 200); }, 300); }, 4000);
}

function updateLoreTabBadge() {
    const hasUnread = (state.unreadLoreIds || []).length > 0;
    document.getElementById('tab-btn-lore').classList.toggle('has-lore', hasUnread);
}

// ═══════════════════════════════════════
//  RESEARCH TREE
// ═══════════════════════════════════════
let lastResearchKey = null;
function buildResearch() {
    const key = state.research.map(r => r.bought ? '1' : '0').join('') + '|' + state.prestigeCount;
    if (key === lastResearchKey) return; lastResearchKey = key;
    const c = document.getElementById('tab-research'); c.innerHTML = '';
    const scale = getPrestigeCostScale() * getModifierUpgradeCostMult();
    [1, 2, 3, 4, 5, 6].forEach(tier => {
        const nodes = RESEARCH_DEF.filter(r => r.tier === tier);
        const lbl = document.createElement('div'); lbl.className = 'research-tier-label'; lbl.textContent = 'Tier ' + tier; c.appendChild(lbl);
        if (tier > 1) { const conn = document.createElement('div'); conn.className = 'rn-connector'; conn.textContent = '↓  ↓'; c.appendChild(conn); }
        const row = document.createElement('div'); row.className = 'research-nodes';
        nodes.forEach(def => {
            const sr = state.research.find(r => r.id === def.id);
            const pre = def.prereqs.every(pid => state.research.find(r => r.id === pid)?.bought);
            const bought = sr?.bought;
            const scaledCost = Math.ceil(def.cost * scale);
            const card = document.createElement('div'); card.className = 'rn-card' + (bought ? ' bought' : '') + ((!pre && !bought) ? ' locked' : ''); card.dataset.rid = def.id;
            card.innerHTML = `<div class="rn-name">${def.name}</div><div class="rn-desc">${def.desc}</div><div class="rn-cost">${bought ? '' : fmt(scaledCost) + ' sp'}</div>`;
            if (bought) { const b = document.createElement('div'); b.className = 'rn-bought-badge'; b.textContent = '✦ Researched'; card.appendChild(b); }
            else if (pre) { const btn = document.createElement('button'); btn.className = 'rn-btn'; btn.type = 'button'; btn.textContent = 'Research'; btn.dataset.rcost = scaledCost; btn.disabled = state.spores < scaledCost; btn.addEventListener('click', () => buyResearch(def.id)); card.appendChild(btn); }
            else { const lk = document.createElement('div'); lk.style.cssText = 'font-size:10px;color:#3a5e42;margin-top:3px'; lk.textContent = 'Requires: ' + def.prereqs.map(pid => RESEARCH_DEF.find(r => r.id === pid)?.name || pid).join(', '); card.appendChild(lk); }
            row.appendChild(card);
        });
        c.appendChild(row);
    });
}
function updateResearch() { const scale = getPrestigeCostScale() * getModifierUpgradeCostMult(); document.querySelectorAll('#tab-research .rn-btn').forEach(btn => { const baseCost = Number(btn.dataset.rcost); const scaledCost = Math.ceil(baseCost * scale); btn.disabled = state.spores < scaledCost; }); }
function buyResearch(id) {
    const def = RESEARCH_DEF.find(d => d.id === id), sr = state.research.find(r => r.id === id);
    const scaledCost = Math.ceil(def.cost * getPrestigeCostScale() * getModifierUpgradeCostMult());
    if (!def || sr.bought || state.spores < scaledCost) return;
    const _sb = state.spores;
    state.spores -= scaledCost; sr.bought = true; invalidateMults(); lastResearchKey = null;
    checkAllIn(_sb);
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
    while (lo <= hi) { const mid = Math.floor((lo + hi) / 2); let total = 0, o = pr.owned; for (let i = 0; i < mid; i++)total += Math.ceil(pr.baseCost * Math.pow(1.15, Math.min(o++, 100)) * getResearchMults().cost); if (total <= state.spores) { n = mid; lo = mid + 1; } else hi = mid - 1; }
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
        if (buyQty === 'max') { qty = maxAffordable(pr); if (qty === 0) { totalCost = singleCost; can = false; } else { let o = pr.owned, total = 0; for (let i = 0; i < qty; i++)total += Math.ceil(pr.baseCost * Math.pow(1.15, Math.min(o++, 100)) * getResearchMults().cost); totalCost = total; can = true; } }
        else { qty = buyQty; let o = pr.owned, total = 0; for (let i = 0; i < qty; i++)total += Math.ceil(pr.baseCost * Math.pow(1.15, Math.min(o++, 100)) * getResearchMults().cost); totalCost = total; can = state.spores >= total; }
        btn.classList.toggle('disabled', !can); btn.classList.toggle('can-afford', can);
        btn.querySelector('[data-cost]').textContent = buyQty === 1 ? fmt(singleCost) + ' sp' : fmt(totalCost) + ' sp (×' + (buyQty === 'max' ? qty : buyQty) + ')';
        const sps = pr.baseSps * getSeasonMult(pr.id) * BIOMES[state.biomeIdx].prodMult * getPrestigeMult() * getResearchMults().prod * getAchievementMults().prod;
        const activeSyns = UPGRADES_DEF.filter(u => u.isSynergy && state.upgrades.find(su => su.id === u.id)?.bought);
        const synTag = activeSyns.some(u => u.synTo === pr.id || u.synFrom === pr.id) ? '  · 🔗' : '';
        btn.querySelector('[data-owned]').textContent = `Owned: ${pr.owned}  ·  +${fmtSps(sps)}/s each${synTag}`;
    });
}
function buyProducer(id) {
    const pr = p(state, id);
    const qty = buyQty === 'max' ? maxAffordable(pr) : buyQty;
    if (qty === 0) return;
    // For fixed quantities, verify the full cost is affordable before buying anything
    if (buyQty !== 'max') {
        let o = pr.owned, total = 0;
        for (let i = 0; i < qty; i++) total += Math.ceil(pr.baseCost * Math.pow(1.15, Math.min(o++, 100)) * getResearchMults().cost);
        if (state.spores < total) return;
    }
    const _sb = state.spores;
    for (let i = 0; i < qty; i++) { const cost = getCost(pr); if (state.spores < cost) break; state.spores -= cost; pr.owned++; }
    checkAllIn(_sb);
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
    if (getRunMod()?.id === 'feral_growth') {
        const c = document.getElementById('upgrades-available-list');
        const feralKey = 'feral_growth';
        if (lastUpgradeKey !== feralKey) { lastUpgradeKey = feralKey; c.innerHTML = '<div style="padding:1rem;font-size:12px;color:#C0524A;font-style:italic">🌿 Feral Growth — upgrades unavailable this run.</div>'; updateUpgradeTabBadge(false); }
        return;
    }
    const visible = UPGRADES_DEF.filter(u => { const su = state.upgrades.find(x => x.id === u.id); return !su?.bought && u.req(state); });
    const key = visible.map(u => u.id).join(',') || '__empty__';
    if (key === lastUpgradeKey) return; lastUpgradeKey = key;
    const c = document.getElementById('upgrades-available-list'); c.innerHTML = '';
    if (!visible.length) { c.innerHTML = '<div style="padding:1rem;font-size:12px;color:#4a7a55;font-style:italic">Keep growing to unlock upgrades...</div>'; updateUpgradeTabBadge(false); return; }
    UPGRADE_SECTIONS.forEach(section => {
        const group = visible.filter(u => section.tiers.has(u.tier));
        if (!group.length) return;
        const hdr = document.createElement('div'); hdr.className = 'upgrade-section-hdr'; hdr.textContent = section.label; c.appendChild(hdr);
        group.forEach(u => {
            const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'item disabled'; btn.dataset.id = u.id;
            // Show tier badge only inside Producers and Biome sections (where sub-type matters)
            const showBadge = PRODUCER_TIERS.has(u.tier) || BIOME_TIERS.has(u.tier);
            const badgeClass = u.biome ? 'badge biome-badge' : u.isSynergy ? 'badge synergy-badge' : 'badge';
            const badgeHtml = showBadge ? `<span class="${badgeClass}">${TIER_LABELS[u.tier] || ''}</span>` : '';
            btn.innerHTML = `<div class="item-top"><span class="item-name">✦ ${u.name}${badgeHtml}</span><span class="item-cost" data-cost></span></div><div class="item-desc">${u.desc}</div>`;
            if (u.isSynergy) {
                const fromDef = PRODUCERS_DEF.find(pr => pr.id === u.synFrom);
                const toDef = PRODUCERS_DEF.find(pr => pr.id === u.synTo);
                if (fromDef && toDef) {
                    const link = document.createElement('div'); link.className = 'synergy-link-row';
                    link.innerHTML = `${fromDef.emoji} ${fromDef.name} <span class="synergy-arrow">→</span> ${toDef.emoji} ${toDef.name}`;
                    btn.appendChild(link);
                }
            }
            btn.addEventListener('click', () => buyUpgrade(u.id)); c.appendChild(btn);
        });
    });
    updateUpgradeTabBadge(true);
}
function updateUpgradeTabBadge(hasUpgrades) {
    document.getElementById('tab-btn-upgrades').classList.toggle('has-upgrades', hasUpgrades);
}
function updateUpgrades() {
    const scale = getPrestigeCostScale() * getModifierUpgradeCostMult();
    document.querySelectorAll('#upgrades-available-list [data-id]').forEach(btn => { const u = UPGRADES_DEF.find(x => x.id === btn.dataset.id); if (!u) return; const scaledCost = Math.ceil(u.cost * scale); const can = state.spores >= scaledCost; btn.classList.toggle('disabled', !can); btn.classList.toggle('can-afford', can); btn.querySelector('[data-cost]').textContent = fmt(scaledCost) + ' sp'; });
}
function buyUpgrade(id) {
    const uDef = UPGRADES_DEF.find(x => x.id === id);
    if (!uDef) return;
    let su = state.upgrades.find(x => x.id === id);
    if (!su) { su = { id, bought: false }; state.upgrades.push(su); }
    const scaledCost = Math.ceil(uDef.cost * getPrestigeCostScale() * getModifierUpgradeCostMult());
    if (su.bought || state.spores < scaledCost) return;
    const _sb = state.spores;
    state.spores -= scaledCost; su.bought = true; uDef.apply(state);
    state.upgradesBoughtThisRun = (state.upgradesBoughtThisRun || 0) + 1;
    checkAllIn(_sb);
    lastUpgradeKey = null; lastOwnedKey = null;
    buildUpgrades(); updateUpgrades(); buildOwned(); updateStats();
}
function buildOwned() {
    const bought = UPGRADES_DEF.filter(u => state.upgrades.find(x => x.id === u.id)?.bought);
    const key = bought.map(u => u.id).join(',') || '__none__';
    if (key === lastOwnedKey) return; lastOwnedKey = key;
    const c = document.getElementById('upgrades-owned-list'); c.innerHTML = '';
    if (!bought.length) { c.innerHTML = '<div style="padding:1rem;font-size:12px;color:#4a7a55;font-style:italic">No upgrades purchased yet.</div>'; return; }
    UPGRADE_SECTIONS.forEach(section => {
        const group = bought.filter(u => section.tiers.has(u.tier));
        if (!group.length) return;
        const hdr = document.createElement('div'); hdr.className = 'upgrade-section-hdr'; hdr.textContent = section.label + ' (' + group.length + ')'; c.appendChild(hdr);
        group.forEach(u => {
            const row = document.createElement('div'); row.className = 'owned-row';
            row.innerHTML = `<div class="owned-name">✦ ${u.name}</div><div class="owned-desc">${u.desc}</div>`;
            c.appendChild(row);
        });
    });
}

// ═══════════════════════════════════════
//  BONDS (SYMBIOSIS)
// ═══════════════════════════════════════
let lastSymKey = null;
// Only include unlock threshold flips, not raw totalEarned — prevents DOM rebuild every tick
function symKey() {
    const unlockFlags = SYMBIONTS.map(d => state.totalEarned >= d.unlockAt ? '1' : '0').join('');
    return state.symbiosis.map(s => `${s.id}:${s.active}:${s.hungry}:${s.broken}`).join('|') + '|' + unlockFlags + '|s' + state.seasonIdx;
}
const _SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'];
const _SEASON_EMOJIS = ['🌱', '☀️', '🍂', '❄️'];
function buildSymbiosis() {
    const c = document.getElementById('tab-bonds'); c.innerHTML = '';
    SYMBIONTS.forEach(def => {
        const seasonTag = def.favSeason !== null && def.favSeason !== undefined
            ? `<span class="sym-season-tag" data-sym-season-tag="${def.id}">${_SEASON_EMOJIS[def.favSeason]} ${_SEASON_NAMES[def.favSeason]} affinity · ×2.5 in season</span>`
            : `<span class="sym-season-tag sym-season-eternal">♾ Eternal — no season preference</span>`;
        const card = document.createElement('div'); card.className = 'sym-card';
        card.innerHTML = `<div class="sym-top"><span class="sym-name">${def.emoji} ${def.name}</span><span class="sym-status-badge locked" data-sym-status="${def.id}">Locked</span></div><div class="sym-desc">${def.desc}</div><div class="sym-stats">+${fmt(def.bonusSps)}/s &nbsp;·&nbsp; Feed ${fmt(def.feedCost)} sp every ${def.feedEvery}s &nbsp;·&nbsp; Pact: ${fmt(def.pactCost)} sp</div>${seasonTag}<div data-sym-actions="${def.id}"></div><div class="sym-feed-track" data-sym-track="${def.id}" style="display:none"><div class="sym-feed-fill" data-sym-fill="${def.id}"></div></div>`;
        c.appendChild(card);
    });
}
function updateSymbiosis() {
    const key = symKey(), rebuild = key !== lastSymKey; lastSymKey = key;
    SYMBIONTS.forEach((def, i) => { const sym = state.symbiosis[i], unlocked = state.totalEarned >= def.unlockAt; const statusEl = document.querySelector(`[data-sym-status="${def.id}"]`); const actionsEl = document.querySelector(`[data-sym-actions="${def.id}"]`); const trackEl = document.querySelector(`[data-sym-track="${def.id}"]`); const fillEl = document.querySelector(`[data-sym-fill="${def.id}"]`); if (!statusEl) return; let sc = 'locked', st = 'Locked'; if (unlocked && !sym.active && !sym.broken) { sc = 'available'; st = 'Available'; } else if (sym.active && !sym.hungry) { sc = 'active'; st = 'Active'; } else if (sym.hungry) { sc = 'hungry'; st = 'Hungry!'; } else if (sym.broken) { sc = 'broken'; st = 'Bond Broken'; } statusEl.className = 'sym-status-badge ' + sc; statusEl.textContent = st; if (rebuild) { actionsEl.innerHTML = ''; if (unlocked && !sym.active && !sym.broken) { const btn = document.createElement('button'); btn.className = 'sym-btn pact'; btn.type = 'button'; btn.textContent = `Form Pact (${fmt(def.pactCost)} sp)`; btn.disabled = state.spores < def.pactCost; btn.addEventListener('click', () => formPact(i)); actionsEl.appendChild(btn); } else if (sym.hungry) { const btn = document.createElement('button'); btn.className = 'sym-btn feed'; btn.type = 'button'; btn.textContent = `Feed (${fmt(def.feedCost)} sp)`; btn.disabled = state.spores < def.feedCost; btn.addEventListener('click', () => feedSymbiont(i)); actionsEl.appendChild(btn); } else if (sym.broken && unlocked) { const btn = document.createElement('button'); btn.className = 'sym-btn restore'; btn.type = 'button'; btn.textContent = `Restore Pact (${fmt(def.pactCost)} sp)`; btn.disabled = state.spores < def.pactCost; btn.addEventListener('click', () => formPact(i)); actionsEl.appendChild(btn); } } else { const btn = actionsEl.querySelector('button'); if (btn) btn.disabled = state.spores < (sym.hungry ? def.feedCost : def.pactCost); } if (sym.active) { trackEl.style.display = 'block'; const pct = Math.min(100, (sym.feedTimer / def.feedEvery) * 100); fillEl.style.width = pct + '%'; fillEl.style.background = sym.hungry ? '#EF9F27' : '#5DCAA5'; } else trackEl.style.display = 'none';
        // Season affinity highlight
        const seasonTagEl = document.querySelector(`[data-sym-season-tag="${def.id}"]`);
        if (seasonTagEl && def.favSeason !== null) {
            const biome = BIOMES[state.biomeIdx];
            const inSeason = !biome.noSeasons && state.settings.seasonsEnabled && state.seasonIdx === def.favSeason;
            seasonTagEl.classList.toggle('sym-season-active', inSeason && sym.active && !sym.broken);
        }
    });
    updateBondTabBadge();
}
function tickSymbiosis(dt) {
    if (getRunMod()?.id === 'symbiotic_bloom') return; // bonds never go hungry
    const autoFeed1 = state.upgrades.find(u => u.id === 'uf1')?.bought || false;
    const autoFeed2 = state.upgrades.find(u => u.id === 'uf2')?.bought || false;
    const autoFeed3 = state.upgrades.find(u => u.id === 'uf3')?.bought || false;
    const AF1_IDS = ['earthworm', 'beetle', 'antcolony'];
    const AF2_IDS = ['moth', 'bees', 'spider'];
    const AF3_IDS = ['lizard', 'elk', 'leech', 'serpent'];
    state.symbiosis.forEach((sym, i) => {
        if (!sym.active || sym.broken) return;
        const def = SYMBIONTS[i];
        const hasAuto = (autoFeed1 && AF1_IDS.includes(def.id)) ||
            (autoFeed2 && AF2_IDS.includes(def.id)) ||
            (autoFeed3 && AF3_IDS.includes(def.id));
        sym.feedTimer += dt;
        if (!sym.hungry && sym.feedTimer >= def.feedEvery) {
            if (hasAuto && state.spores >= def.feedCost) {
                state.spores -= def.feedCost; sym.feedTimer = 0; lastSymKey = null;
            } else { sym.hungry = true; lastSymKey = null; if (!hasAuto) tick(`${def.emoji} ${def.name} is hungry! Feed it to keep your bond.`, true); }
        }
        if (sym.hungry && sym.feedTimer >= def.feedEvery + 30) {
            if (hasAuto && state.spores >= def.feedCost) {
                state.spores -= def.feedCost; sym.hungry = false; sym.feedTimer = 0; lastSymKey = null;
            } else { sym.broken = true; sym.active = false; tick(`💔 Bond with ${def.name} broken. Restore the pact to reconnect.`, true); lastSymKey = null; }
        }
    });
}
function formPact(i) { const def = SYMBIONTS[i], sym = state.symbiosis[i]; if (state.spores < def.pactCost) return; const _sb = state.spores; state.spores -= def.pactCost; sym.active = true; sym.hungry = false; sym.feedTimer = 0; sym.broken = false; state.bondsActivatedThisRun = (state.bondsActivatedThisRun || 0) + 1; checkAllIn(_sb); lastSymKey = null; updateSymbiosis(); updateStats(); }
function feedSymbiont(i) { const def = SYMBIONTS[i], sym = state.symbiosis[i]; if (!sym.hungry || state.spores < def.feedCost) return; state.spores -= def.feedCost; sym.hungry = false; sym.feedTimer = 0; lastSymKey = null; updateSymbiosis(); updateStats(); }

function updateBondTabBadge() {
    const hasAlert = state.symbiosis.some(sym => sym.hungry || sym.broken);
    document.getElementById('tab-btn-bonds').classList.toggle('has-alert', hasAlert);
}

let _lastBondAlertKey = '', _lastDecisionKey = '', _lastModKey = '';
function updateBondAlert() {
    const hungry = state.symbiosis.map((sym, i) => ({ sym, i, def: SYMBIONTS[i] }))
        .filter(({ sym }) => sym.active && sym.hungry && !sym.broken);
    const anyAlert = state.symbiosis.some(sym => sym.hungry || sym.broken);
    const active = state.symbiosis.filter(sym => sym.active && !sym.broken && !sym.hungry).length;

    // Update pill (always)
    const pill = document.getElementById('spill-bond');
    const dot = document.getElementById('strip-bond-dot');
    if (anyAlert) {
        pill.classList.add('alert');
        dot.style.display = 'block';
        document.getElementById('strip-bond-text').textContent = '×' + (hungry.length || state.symbiosis.filter(s => s.broken).length) + (hungry.length ? ' hungry' : ' broken');
    } else {
        pill.classList.remove('alert');
        dot.style.display = 'none';
        document.getElementById('strip-bond-text').textContent = active > 0 ? active + ' active' : '—';
    }

    // Only rebuild panel HTML when hungry set changes — prevents destroying buttons mid-click
    const bondKey = hungry.map(({ i, def }) => i + ':' + (state.spores >= def.feedCost ? '1' : '0')).join(',') + '|' + (anyAlert ? 'a' : 'n');
    const panel = document.getElementById('spanel-bond');
    let inner = panel.querySelector('.spanel-inner');
    if (!inner) { inner = document.createElement('div'); inner.className = 'spanel-inner bond-inner'; panel.appendChild(inner); }
    if (bondKey === _lastBondAlertKey) return;
    _lastBondAlertKey = bondKey;

    if (!hungry.length) {
        inner.innerHTML = `<div class="spanel-title">Bonds</div><div class="spanel-desc" style="margin:0">${active > 0 ? 'All active bonds are fed.' : 'No active bonds yet.'}</div>`;
    } else {
        let html = '<div class="spanel-title red">Hungry bonds</div>';
        hungry.forEach(({ i, def }) => {
            const canFeed = state.spores >= def.feedCost;
            html += `<div class="spanel-feed-row"><span class="spanel-feed-name">${def.emoji} ${def.name}</span><button class="spanel-feed-btn" type="button" onclick="feedSymbiont(${i});_lastBondAlertKey='';updateBondAlert();" ${canFeed ? '' : 'disabled'}>Feed ${fmt(def.feedCost)} sp</button></div>`;
        });
        inner.innerHTML = html;
    }
}

function updateModifierPill() {
    const mod = getRunMod();
    const key = mod?.id || 'none';
    if (key === _lastModKey) return;
    _lastModKey = key;
    const pill = document.getElementById('spill-mod');
    const panel = document.getElementById('spanel-mod');
    if (!mod) { pill.style.display = 'none'; return; }
    pill.style.display = '';
    const typeColor = mod.type === 'buff' ? '#5DCAA5' : mod.type === 'twist' ? '#EF9F27' : '#C0524A';
    document.getElementById('strip-mod-icon').textContent = mod.emoji;
    document.getElementById('strip-mod-text').textContent = mod.name;
    pill.style.borderColor = typeColor + '60';
    let inner = panel.querySelector('.spanel-inner');
    if (!inner) { inner = document.createElement('div'); inner.className = 'spanel-inner'; panel.appendChild(inner); }
    const typeLabel = mod.type === 'buff' ? '✦ Buff' : mod.type === 'twist' ? '⚡ Twist' : '☠ Handicap';
    inner.innerHTML = `<div class="spanel-title" style="color:${typeColor}">${mod.emoji} ${mod.name} <span class="chain-badge" style="background:${typeColor}22;color:${typeColor}">${typeLabel}</span></div><div class="spanel-desc">${mod.desc}</div>`;
}

// ═══════════════════════════════════════
//  BIOME OBJECTIVES
// ═══════════════════════════════════════
function checkBiomeObjectives() {
    if (!state.completedBiomeObjectives) state.completedBiomeObjectives = [];
    const currentBiomeId = BIOMES[state.biomeIdx].id;
    let changed = false;
    BIOME_OBJECTIVES.forEach(obj => {
        if (state.completedBiomeObjectives.includes(obj.id)) return;
        if (obj.biomeId !== currentBiomeId) return;
        try { if (!obj.req(state)) return; } catch(e) { return; }
        state.completedBiomeObjectives.push(obj.id);
        state.essence += obj.essenceReward;
        changed = true;
        _lastEssenceKey = '';
        tick(`🎯 Biome Objective Complete: ${obj.label}! +${obj.essenceReward} Essence`, true);
        showAchToast({ emoji: '🎯', name: obj.label, bonusDesc: `+${obj.essenceReward} Essence`, hidden: false });
    });
    if (changed) { lastAchKey = null; }
}

// ═══════════════════════════════════════
//  END-GAME
// ═══════════════════════════════════════
const ALL_CODEX_IDS = ['R1','R2','R3','R4','R5','P1','P2','P3','P4','P5','A1','A2','A3','A4','A5','A6','B1','B2','B3','B4','B5'];

function isEndgameConditionMet() {
    if (state.biomesVisited.length < BIOMES.length) return false;
    if (!ALL_CODEX_IDS.every(id => state.codexPurchased.includes(id))) return false;
    if (!state.producers.every(pr => pr.owned >= 500)) return false;
    return true;
}

function checkEndgame() {
    if (state.endgameReached) return;
    if (!isEndgameConditionMet()) return;
    state.endgameReached = true;
    state.goldTheme = true;
    saveGame();
    // Unlock achievement
    if (!state.achievementsUnlocked.includes('h_transcendence')) {
        state.achievementsUnlocked.push('h_transcendence');
        invalidateMults();
        showAchToast(HIDDEN_ACHS.find(a => a.id === 'h_transcendence'));
        lastAchKey = null;
    }
    showEndgameOverlay();
}

function initStarField() {
    if (document.getElementById('star-canvas')) return;
    const cvs = document.createElement('canvas');
    cvs.id = 'star-canvas';
    document.body.appendChild(cvs);
    const ctx = cvs.getContext('2d');

    function resize() { cvs.width = window.innerWidth; cvs.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const COLORS = ['#FFF8E7', '#F5C842', '#E8A040', '#FFFDE7', '#FFD966', '#FFFFFF'];
    const stars = [];
    for (let i = 0; i < 160; i++) {
        stars.push({
            x: Math.random(), y: Math.random(),
            r: 0.35 + Math.random() * 1.25,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            phase: Math.random() * Math.PI * 2,
            speed: 0.3 + Math.random() * 1.8,
            baseAlpha: 0.12 + Math.random() * 0.42,
        });
    }

    let t = 0;
    function frame() {
        if (!document.getElementById('star-canvas')) return;
        const W = cvs.width, H = cvs.height;
        ctx.clearRect(0, 0, W, H);
        t += 0.016;
        for (const s of stars) {
            const alpha = s.baseAlpha * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase)));
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = s.color;
            if (s.r > 0.75) { ctx.shadowColor = s.color; ctx.shadowBlur = s.r * 3; }
            ctx.beginPath();
            ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function launchEndgameParticles() {
    // Brief screen flash
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:#a78bfa;pointer-events:none;z-index:9999;opacity:0.35;transition:opacity 0.7s ease;';
    document.body.appendChild(flash);
    requestAnimationFrame(() => { flash.style.opacity = '0'; });
    setTimeout(() => flash.remove(), 800);

    // Particle canvas
    const cvs = document.createElement('canvas');
    cvs.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:10001;';
    document.body.appendChild(cvs);
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
    const ctx = cvs.getContext('2d');
    const cx = cvs.width / 2, cy = cvs.height / 2;
    const COLORS = ['#a78bfa', '#c4b5fd', '#ddd6fe', '#9FE1CB', '#ffffff', '#7c3aed', '#ede9fe'];

    const particles = [];
    // Radial burst
    for (let i = 0; i < 220; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 11;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            size: 1.5 + Math.random() * 4,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            alpha: 1, decay: 0.009 + Math.random() * 0.017,
        });
    }
    // Rising spore drift
    for (let i = 0; i < 60; i++) {
        particles.push({
            x: cx + (Math.random() - 0.5) * 280,
            y: cy + (Math.random() - 0.5) * 80,
            vx: (Math.random() - 0.5) * 1.5, vy: -(0.8 + Math.random() * 2.5),
            size: 1 + Math.random() * 2.5,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            alpha: 0.9, decay: 0.005 + Math.random() * 0.009,
        });
    }

    // Shockwave rings
    const rings = [
        { r: 0, maxR: Math.hypot(cx, cy) * 1.4, alpha: 0.7, speed: 14, width: 3 },
        { r: 0, maxR: Math.hypot(cx, cy) * 1.1, alpha: 0.4, speed: 9,  width: 1.5 },
    ];

    function frame() {
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        let alive = false;

        // Rings
        for (const ring of rings) {
            if (ring.r < ring.maxR) {
                const progress = ring.r / ring.maxR;
                ctx.save();
                ctx.globalAlpha = ring.alpha * (1 - progress);
                ctx.strokeStyle = '#a78bfa';
                ctx.lineWidth = ring.width;
                ctx.shadowColor = '#a78bfa';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                ring.r += ring.speed;
                alive = true;
            }
        }

        // Particles
        for (const p of particles) {
            if (p.alpha <= 0) continue;
            alive = true;
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.size * 2.5;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.965; p.vy *= 0.965;
            p.alpha -= p.decay;
        }

        if (alive) requestAnimationFrame(frame);
        else cvs.remove();
    }
    requestAnimationFrame(frame);
}

function showEndgameOverlay() {
    // Persistent visual transformation (Feature 9)
    state.goldTheme = true;
    applyTheme();
    updateSettingsUI();

    // Particle burst (Feature 3)
    launchEndgameParticles();

    // Prep overlay elements for typewriter (Feature 5)
    const overlay   = document.getElementById('endgame-overlay');
    const symbolEl  = document.getElementById('endgame-symbol');
    const titleEl   = document.getElementById('endgame-title');
    const textEl    = document.getElementById('endgame-text');
    const btn       = document.getElementById('endgame-dismiss');
    const paras     = Array.from(textEl.querySelectorAll('p'));
    const fullTitle = titleEl.textContent.trim();

    titleEl.textContent = '';
    symbolEl.style.opacity = '0';
    paras.forEach(p => { p.style.opacity = '0'; p.style.transform = 'translateY(10px)'; });
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';

    // Show overlay after burst is in full swing
    setTimeout(() => {
        overlay.classList.add('visible');

        // Symbol fade-in
        setTimeout(() => {
            symbolEl.style.transition = 'opacity 1s ease';
            symbolEl.style.opacity = '1';
        }, 350);

        // Typewriter title
        setTimeout(() => {
            let i = 0;
            const typeTimer = setInterval(() => {
                titleEl.textContent += fullTitle[i++];
                if (i >= fullTitle.length) {
                    clearInterval(typeTimer);
                    // Staggered paragraph reveal
                    paras.forEach((p, idx) => {
                        setTimeout(() => {
                            p.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
                            p.style.opacity = '1';
                            p.style.transform = 'translateY(0)';
                            if (idx === paras.length - 1) {
                                setTimeout(() => {
                                    btn.style.transition = 'opacity 0.5s ease';
                                    btn.style.opacity = '1';
                                    btn.style.pointerEvents = '';
                                }, 600);
                            }
                        }, idx * 480 + 250);
                    });
                }
            }, 48);
        }, 950);
    }, 650);
}

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
    playPulseSound();
    const now = Date.now();
    // Check Overclock before resetting hivemind
    if (now - _hivemindZeroAt <= 20000) tryUnlockHidden('h2');
    // Mind Meld: 5 pulses within 4 minutes
    _recentPulseTs = _recentPulseTs.filter(t => now - t < 240000); _recentPulseTs.push(now);
    if (_recentPulseTs.length >= 5) tryUnlockHidden('h8');
    // Resonant Surge: pulse within 5 seconds of an event spawning
    if (_lastEventAt > 0 && now - _lastEventAt <= 5000) tryUnlockHidden('h12');
    // Combo streak — 90s window between pulses
    if (now < _comboExpiresAt) {
        _pulseCombo++;
    } else {
        _pulseCombo = 0;
    }
    _comboExpiresAt = now + (getRunMod()?.id === 'resonance_loop' ? 180000 : 90000);
    // P5: recharge bar to 20% after firing instead of 0
    state.hivemind = hasCodex('P5') ? 20 : 0;
    _hivemindZeroAt = now;
    state.allTimePulses++;
    state.pulsesThisPrestige = (state.pulsesThisPrestige || 0) + 1;
    const base = Math.ceil((getSps() * 30 + getClickValue() * 50) * getPulseMult());
    // P4: flat bonus equal to 10 seconds of SPS on top of the pulse
    const flat = hasCodex('P4') ? Math.ceil(getSps() * 10) : 0;
    // Combo multiplier: 1× / 1.15× / 1.30× / 1.50× (caps at combo 3); resonance_loop modifier extends streak cap
    const loopMod = getRunMod()?.id === 'resonance_loop';
    const comboMult = _pulseCombo === 0 ? 1 : _pulseCombo === 1 ? 1.15 : (loopMod ? 3.5 : (_pulseCombo === 2 ? 1.30 : 1.50));
    const bonus = Math.ceil((base + flat) * comboMult * getModifierPulseMult());
    state.spores += bonus; state.totalEarned += bonus;
    if (navigator.vibrate) navigator.vibrate([8, 60, 18]);
    // Resonance at combo 3+
    if (_pulseCombo >= 2) _resonanceUntil = now + 15000;
    // Tick message
    if (_pulseCombo === 0) {
        tick('HIVEMIND PULSE! +' + fmt(bonus) + ' spores surged through the network!', true);
    } else if (_pulseCombo === 1) {
        tick('🔥 ×2 STREAK! +' + fmt(bonus) + ' spores! Combo bonus active.', true);
    } else if (_pulseCombo === 2) {
        tick('🔥 ×3 STREAK! +' + fmt(bonus) + ' spores! Resonance ignited — SPS ×1.75 for 15s!', true);
    } else {
        tick('⚡ ×' + (_pulseCombo + 1) + ' RESONANCE! +' + fmt(bonus) + ' spores! SPS ×1.75 extended!', true);
    }
    // Visual — Resonance flash is golden, normal is teal
    const flashColor = _pulseCombo >= 2 ? '#EF9F27' : '#1D9E75';
    const flash = document.getElementById('flash-overlay');
    const game = document.getElementById('game');
    game.classList.remove('shake'); void game.offsetWidth; game.classList.add('shake');
    flash.style.background = flashColor; flash.style.opacity = _pulseCombo >= 2 ? '0.18' : '0.12';
    setTimeout(() => { flash.style.opacity = '0'; }, 130);
    setTimeout(() => game.classList.remove('shake'), 450);
    spawnPulseRing(); spawnPulseRing(); setTimeout(spawnPulseRing, 160);
    if (_pulseCombo >= 2) setTimeout(spawnPulseRing, 320);
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
    if (!pulseOn) { document.getElementById('pulse-streak').style.display = 'none'; }
    if (pulseOn) {
        document.getElementById('progress-fill').style.width = state.hivemind + '%';
        const predicted = Math.ceil((getSps() * 30 + getClickValue() * 50) * getPulseMult());
        document.getElementById('pulse-info').textContent = `Hivemind pulse: ${Math.floor(state.hivemind)}% · Next pulse: +${fmt(predicted)} sp`;
        // Streak / resonance display
        const streakEl = document.getElementById('pulse-streak');
        const now = Date.now();
        const inResonance = now < _resonanceUntil;
        const inCombo = now < _comboExpiresAt && _pulseCombo > 0;
        if (inResonance) {
            const rem = Math.ceil((_resonanceUntil - now) / 1000);
            streakEl.textContent = `⚡ RESONANCE ×1.75 SPS — ${rem}s`;
            streakEl.className = 'pulse-streak-resonance';
            streakEl.style.display = 'block';
        } else if (inCombo) {
            const comboRem = Math.ceil((_comboExpiresAt - now) / 1000);
            streakEl.textContent = `🔥 ×${_pulseCombo + 1} Streak — ${comboRem}s to maintain!`;
            streakEl.className = 'pulse-streak-combo';
            streakEl.style.display = 'block';
        } else {
            streakEl.style.display = 'none';
        }
        // Progress bar color shifts during resonance
        document.getElementById('progress-fill').style.background = inResonance
            ? 'linear-gradient(90deg, #EF9F27, #FFD080)'
            : 'linear-gradient(90deg, #1D9E75, #9FE1CB)';
    }
    updateBiomeBar();
    updateModifierPill();
}

function applyBiomeVars() {
    const c = BIOMES[state.biomeIdx].colors;
    const root = document.documentElement;
    root.style.setProperty('--b-bg',  c.bg);
    root.style.setProperty('--b-bg2', c.bg2);
    root.style.setProperty('--b-a',   c.a);
    root.style.setProperty('--b-b',   c.b);
    root.style.setProperty('--b-n',   c.n);
    root.style.setProperty('--b-g1',  c.g1);
    root.style.setProperty('--b-g2',  c.g2);
}

function applyTheme() {
    const gold = state.endgameReached && state.goldTheme;
    document.body.classList.toggle('transcended', gold);
    const header = document.getElementById('page-header');
    const btn    = document.getElementById('spore-btn');
    if (header) header.classList.toggle('transcended', gold);
    if (btn)    btn.classList.toggle('transcended', gold);
    if (gold) {
        if (!document.getElementById('star-canvas')) initStarField();
    } else {
        const sc = document.getElementById('star-canvas');
        if (sc) sc.remove();
    }
    applyBiomeVars();
}

let _lastBiomeIdx = -1; _openPanel = null; _lastBondAlertKey = "";
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
    // Visual theme
    const left = document.getElementById('left');
    left.dataset.biome = b.id;
    left.style.background = b.colors.bg;
    left.style.setProperty('--biome-glow-1', b.colors.g1);
    left.style.setProperty('--biome-glow-2', b.colors.g2);
    left.style.setProperty('--biome-a-rgb', b.colors.a);
    left.style.setProperty('--biome-n-rgb', b.colors.n);
    _biomeColors = b.colors;
    lastTotal = -1; // force canvas re-seed in new palette
    applyBiomeVars();
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
        state.allTimePulses, state.pulsesThisPrestige,
        state.achievementsUnlocked.length, state.runModifierId || '',
        Math.floor(pct),
        Math.floor(state.peakSpsThisRun || 0), state.eventsThisRun || 0,
        state.upgradesBoughtThisRun || 0, state.bondsActivatedThisRun || 0
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
    addStat(g2, 'Pulses', fmt(state.pulsesThisPrestige || 0), 'this run');
    addStat(g2, 'Spores / sec', fmt(getSps()) + '/s', 'current rate');
    addStat(g2, 'Peak SPS', fmt(state.peakSpsThisRun || 0) + '/s', 'best rate this run');
    addStat(g2, 'Events', state.eventsThisRun || 0, 'triggered this run');
    addStat(g2, 'Upgrades Bought', state.upgradesBoughtThisRun || 0, 'this run');
    addStat(g2, 'Bonds Formed', state.bondsActivatedThisRun || 0, 'this run');
    const runMod = getRunMod();
    if (runMod) {
        const modCard = document.createElement('div');
        modCard.className = 'stats-card stats-card-wide stats-mod-card';
        modCard.innerHTML = `<div class="stats-card-label">Run Modifier</div><div class="stats-card-val">${runMod.emoji} ${runMod.name}</div><div class="stats-card-sub">${runMod.desc}</div>`;
        g2.appendChild(modCard);
    }

    // ── All-Time ──
    const g1 = makeSection('✦ All-Time');
    addStat(g1, 'Spores Earned', fmt(allTimeTotal), 'across all prestiges');
    addStat(g1, 'Total Clicks', fmt(state.allTimeClicks || 0), 'all prestiges');
    addStat(g1, 'Total Pulses', fmt(state.allTimePulses || 0), 'all prestiges');
    addStat(g1, 'Times Sporulated', state.prestigeCount > 0 ? state.prestigeCount : '—', state.prestigeCount > 0 ? 'sporulations' : 'not yet');
    addStat(g1, 'Essence Earned', fmt(state.allTimeEssence || 0), 'all time');
    const totalAchs = ALL_ACHS.length;
    addStat(g1, 'Achievements', state.achievementsUnlocked.length + ' / ' + totalAchs, Math.floor(state.achievementsUnlocked.length / totalAchs * 100) + '% complete');
    addStat(g1, 'Biomes Visited', state.biomesVisited.length + ' / ' + BIOMES.length, state.biomesVisited.length === BIOMES.length ? 'all biomes!' : BIOMES.length - state.biomesVisited.length + ' remaining');

    // ── Multipliers ──
    const gm = makeSection('⚡ Active Multipliers');
    const am = getAchievementMults(), rm = getResearchMults();
    const seasonMult = getSeasonMult();
    const eventGlobal = getEventGlobal();
    addStat(gm, 'Legacy', getPrestigeMult().toFixed(2) + '×', 'from sporulations');
    addStat(gm, 'Season', seasonMult.toFixed(2) + '×', state.activeEvent ? state.activeEvent.name : (['Spring','Summer','Fall','Winter'][state.seasonIdx] || 'Spring'));
    if (eventGlobal !== 1) addStat(gm, 'Active Event', eventGlobal.toFixed(2) + '×', state.activeEvent?.name || '');
    addStat(gm, 'Achievements', am.prod.toFixed(2) + '×', 'production bonus');
    addStat(gm, 'Research', rm.prod.toFixed(2) + '×', 'production bonus');
    const codexProd = getCodexProdMult() * getCodexBiomeMult();
    addStat(gm, 'Codex', codexProd.toFixed(2) + '×', 'production bonus');
    const modProd = getModifierProdMult();
    if (modProd !== 1) addStat(gm, 'Modifier', modProd.toFixed(2) + '×', runMod?.name || '');

    // ── Next Sporulation — only shown after the first prestige ──
    if (state.prestigeCount >= 1) {
        const g3 = makeSection('🧬 Next Sporulation');
        const basePct = hasCodex('A5') ? 0.75 : 0.5;
        const nextMult = (1 + (state.prestigeCount + 1) * (basePct + (hasCodex('A1') ? 0.1 : 0))).toFixed(2);
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

        addStat(g3, 'Next Legacy Mult', nextMult + '×', 'after next sporulation');
        addStat(g3, 'Essence to Earn', fmt(calcEssenceEarned()), 'if you sporulate now');
    }

}

let _lbCache = null, _lbFetchedAt = 0;
function fetchLeaderboard(wrap) {
    // Show cached data immediately while re-fetching if stale
    if (_lbCache) renderLeaderboard(wrap, _lbCache);
    // Re-fetch at most once per 60s
    if (Date.now() - _lbFetchedAt < 60000) return;
    _lbFetchedAt = Date.now();
    if (!_lbCache) wrap.innerHTML = '<div class="lb-loading">Loading leaderboard…</div>';
    db.collection('leaderboard')
        .orderBy('allTimeSpores', 'desc')
        .limit(20)
        .get()
        .then(snap => {
            const rows = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
            _lbCache = rows;
            renderLeaderboard(wrap, rows);
        })
        .catch(() => { wrap.innerHTML = '<div class="lb-loading">Could not load leaderboard.</div>'; });
}

function renderLeaderboard(wrap, rows) {
    const myUid = currentUser?.uid;
    let html = '<table class="lb-table"><thead><tr><th class="lb-rank">#</th><th class="lb-name">Player</th><th class="lb-score">All-time spores</th><th class="lb-pres">Prestiges</th></tr></thead><tbody>';
    rows.forEach((row, i) => {
        const isMe = row.uid === myUid;
        html += `<tr class="${isMe ? 'lb-me' : ''}">
            <td class="lb-rank">${i + 1}</td>
            <td class="lb-name">${escHtml(row.username || '?')}</td>
            <td class="lb-score">${fmt(row.allTimeSpores || 0)}</td>
            <td class="lb-pres">${row.prestigeCount || 0}</td>
        </tr>`;
    });
    if (!rows.length) html += '<tr><td colspan="4" class="lb-empty">No entries yet — you could be first!</td></tr>';
    html += '</tbody></table>';
    wrap.innerHTML = html;
}

function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ═══════════════════════════════════════
//  ESSENCE / MYCELIAL CODEX TAB
// ═══════════════════════════════════════
let _lastEssenceKey = '', _activeCodxBranch = 0;
function buildEssence() {
    const key = state.codexPurchased.join(',') + '|' + state.essence + '|' + _activeCodxBranch + '|' + state.biomesVisited.length;
    if (key === _lastEssenceKey) return;
    _lastEssenceKey = key;
    const c = document.getElementById('tab-essence');
    c.innerHTML = '';

    // ── Balance header ──
    const hdr = document.createElement('div');
    hdr.className = 'essence-header';
    hdr.innerHTML = `<div class="essence-balance"><span class="essence-bal-val">✦ ${state.essence}</span><span class="essence-bal-label"> Essence</span></div>`
        + `<div class="essence-hint">${state.prestigeCount === 0 ? 'Sporulate to earn Essence.' : 'Next sporulation: +' + calcEssenceEarned() + ' Essence'}</div>`;
    c.appendChild(hdr);

    // ── Branch tabs ──
    const tabs = document.createElement('div');
    tabs.className = 'essence-branch-tabs';
    CODEX_TREE.forEach((branch, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isActive = idx === _activeCodxBranch;
        btn.className = 'essence-branch-tab' + (isActive ? ' active' : '');
        if (isActive) { btn.style.borderColor = branch.color + '80'; btn.style.color = branch.color; }
        btn.innerHTML = `<div style="font-size:14px;line-height:1">${branch.emoji}</div><div>${branch.branch}</div>`;
        btn.addEventListener('click', () => { _activeCodxBranch = idx; _lastEssenceKey = ''; buildEssence(); });
        tabs.appendChild(btn);
    });
    c.appendChild(tabs);

    // ── Active branch content ──
    const branch = CODEX_TREE[_activeCodxBranch];
    const content = document.createElement('div');
    content.className = 'essence-grid';

    const branchUnlocked = !branch.unlockCondition || branch.unlockCondition(state);
    if (!branchUnlocked) {
        const msg = document.createElement('div');
        msg.className = 'essence-branch-locked-msg';
        msg.innerHTML = `🔒 ${branch.unlockHint}<br><span style="color:${branch.color}">${state.biomesVisited.length} / 3 biomes visited</span>`;
        content.appendChild(msg);
    } else {
        branch.nodes.forEach((node, idx) => {
            const bought = state.codexPurchased.includes(node.id);
            const prevBought = idx === 0 || state.codexPurchased.includes(branch.nodes[idx - 1].id);
            const canAfford = state.essence >= node.cost;
            const available = !bought && prevBought;

            const card = document.createElement('div');
            card.className = 'essence-node' + (bought ? ' bought' : available ? ' available' : ' locked');

            let btnHtml = '';
            if (bought) btnHtml = '<div class="essence-node-owned">✦ Owned</div>';
            else if (available) btnHtml = `<button class="essence-buy-btn" type="button" ${canAfford ? '' : 'disabled'} onclick="buyCodex('${node.id}',${node.cost})">${node.cost} Essence</button>`;
            else btnHtml = '<div class="essence-node-locked">🔒 Locked</div>';

            card.innerHTML = `<div class="essence-node-name">${node.name}</div>`
                + `<div class="essence-node-effect" style="color:${branch.color}">${node.effect}</div>`
                + `<div class="essence-node-desc">${node.desc}</div>`
                + btnHtml;
            content.appendChild(card);

            if (idx < branch.nodes.length - 1) {
                const arr = document.createElement('div');
                arr.className = 'essence-connector';
                arr.textContent = '↓';
                content.appendChild(arr);
            }
        });
    }
    c.appendChild(content);
}

function buyCodex(id, cost) {
    if (state.essence < cost || state.codexPurchased.includes(id)) return;
    state.essence -= cost;
    state.codexPurchased.push(id);
    invalidateMults();
    _lastEssenceKey = '';
    buildEssence();
    saveGame();
}

// ═══════════════════════════════════════
const ALL_TABS = ['producers', 'upgrades', 'research', 'bonds', 'goals', 'stats', 'essence', 'lore'];
const TAB_LABELS = { producers: 'Producers', upgrades: 'Upgrades', research: 'Research', bonds: 'Bonds', goals: 'Goals', lore: 'Lore', stats: 'Stats', essence: 'Mycelial Codex' };
function switchTab(tab) {
    ALL_TABS.forEach(t => { document.getElementById('tab-btn-' + t).classList.toggle('active', t === tab); document.getElementById('tab-' + t).classList.toggle('active', t === tab); });
    document.getElementById('tab-heading-text').textContent = TAB_LABELS[tab] || tab;
    if (tab === 'lore') { state.unreadLoreIds = []; updateLoreTabBadge(); }
}

// ═══════════════════════════════════════
//  MYCELIUM CANVAS
// ═══════════════════════════════════════
const canvas = document.getElementById('mycelium-canvas'), ctx = canvas.getContext('2d');
let branches = [], animTime = 0, lastTotal = -1, sporeParticles = [];
let _biomeColors = BIOMES[0].colors;

function makeBranch(x1, y1, angle, len, depth, delay) { return { x1, y1, angle, len, depth, delay, progress: 0, children: [] }; }

function seedBranches(total) {
    const W = canvas.offsetWidth || 340, H = canvas.offsetHeight || 340, cx = W / 2, cy = H / 2;
    branches = [];
    const armCount = Math.min(5 + Math.floor(total / 2), 50);
    for (let i = 0; i < armCount; i++) {
        const ba = (i / armCount) * Math.PI * 2;
        const len = 32 + (i % 6) * 11;
        const b = makeBranch(cx, cy, ba, len, 0, i * 0.035);
        b.baseAngle = ba;
        for (let j = 0; j < 2; j++) {
            const sa = ba + (j ? 0.55 : -0.55) + (Math.random() - 0.5) * 0.3;
            b.children.push(makeBranch(cx + Math.cos(ba) * len, cy + Math.sin(ba) * len * 0.6, sa, len * 0.58, 1, b.delay + 0.28));
        }
        if (total > 3) b.children.forEach(child => {
            const ga = child.angle + (Math.random() - 0.5) * 0.65;
            child.children.push(makeBranch(child.x1 + Math.cos(child.angle) * child.len, child.y1 + Math.sin(child.angle) * child.len * 0.6, ga, child.len * 0.52, 2, child.delay + 0.22));
        });
        if (total > 18) b.children.forEach(child => child.children.forEach(gc => {
            const ha = gc.angle + (Math.random() - 0.5) * 0.7;
            gc.children.push(makeBranch(gc.x1 + Math.cos(gc.angle) * gc.len, gc.y1 + Math.sin(gc.angle) * gc.len * 0.6, ha, gc.len * 0.48, 3, gc.delay + 0.18));
        }));
        branches.push(b);
    }
}

function addNewArm(total) {
    const W = canvas.offsetWidth || 340, H = canvas.offsetHeight || 340, cx = W / 2, cy = H / 2;
    // Place new arm in the largest angular gap between existing arms
    const angles = branches.map(b => b.baseAngle).sort((a, b) => a - b);
    let ba = Math.random() * Math.PI * 2;
    if (angles.length > 0) {
        let maxGap = 0;
        for (let i = 0; i < angles.length; i++) {
            const gap = (angles[(i + 1) % angles.length] - angles[i] + Math.PI * 2) % (Math.PI * 2);
            if (gap > maxGap) { maxGap = gap; ba = angles[i] + gap / 2; }
        }
    }
    const len = 32 + (branches.length % 6) * 11;
    const b = makeBranch(cx, cy, ba, len, 0, animTime);
    b.baseAngle = ba;
    [ba + 0.55, ba - 0.55].forEach(sa => {
        b.children.push(makeBranch(0, 0, sa + (Math.random() - 0.5) * 0.3, len * 0.58, 1, animTime + 0.28));
    });
    if (total > 3) b.children.forEach(child => {
        const ga = child.angle + (Math.random() - 0.5) * 0.65;
        child.children.push(makeBranch(0, 0, ga, child.len * 0.52, 2, animTime + 0.5));
    });
    if (total > 18) b.children.forEach(child => child.children.forEach(gc => {
        gc.children.push(makeBranch(0, 0, gc.angle + (Math.random() - 0.5) * 0.7, gc.len * 0.48, 3, animTime + 0.7));
    }));
    branches.push(b);
}

function drawBranch(b, t, alpha) {
    if (t < b.delay) return;
    b.progress = Math.min(1, (t - b.delay) / 0.55);
    const x2 = b.x1 + Math.cos(b.angle) * b.len * b.progress;
    const y2 = b.y1 + Math.sin(b.angle) * b.len * b.progress * 0.6;
    const grad = ctx.createLinearGradient(b.x1, b.y1, x2, y2);
    grad.addColorStop(0, `rgba(${_biomeColors.a},${0.75 * alpha})`);
    grad.addColorStop(1, `rgba(${_biomeColors.b},${0.28 * alpha})`);
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(0.4, 1.6 - b.depth * 0.38);
    ctx.stroke();
    if (b.progress >= 1) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.8 + b.angle * 7);
        // Outer glow halo
        ctx.beginPath(); ctx.arc(x2, y2, 5.5 + pulse * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${_biomeColors.a},${(0.07 + pulse * 0.1) * alpha})`; ctx.fill();
        // Bright core
        ctx.beginPath(); ctx.arc(x2, y2, 2.1 + pulse * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${_biomeColors.n},${(0.55 + pulse * 0.45) * alpha})`; ctx.fill();
    }
    if (b.progress > 0.8) b.children.forEach(child => {
        child.x1 = b.x1 + Math.cos(b.angle) * b.len;
        child.y1 = b.y1 + Math.sin(b.angle) * b.len * 0.6;
        drawBranch(child, t, alpha * 0.78);
    });
}

function animateMycelium() {
    const W = canvas.offsetWidth || 340, H = canvas.offsetHeight || 340;
    const total = state.producers.reduce((s, x) => s + x.owned, 0);
    const maxArms = Math.min(5 + Math.floor(total / 2), 50);
    if (lastTotal === -1) {
        canvas.width = W; canvas.height = H;
        seedBranches(total); animTime = 0; lastTotal = total;
        sporeParticles = [];
    } else if (total > lastTotal && branches.length < maxArms) {
        const toAdd = Math.min(total - lastTotal, maxArms - branches.length);
        for (let i = 0; i < toAdd; i++) addNewArm(total);
        lastTotal = total;
    } else {
        lastTotal = total;
    }
    animTime += 0.016;
    canvas.width = W; canvas.height = H;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, cp = 0.5 + 0.5 * Math.sin(animTime * 2.5);

    // Pulsing rings emanating from center
    for (let i = 0; i < 2; i++) {
        const phase = (animTime * 0.55 + i * 0.5) % 1;
        ctx.beginPath(); ctx.arc(cx, cy, 7 + phase * 42, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${_biomeColors.a},${(1 - phase) * 0.18})`;
        ctx.lineWidth = 1; ctx.stroke();
    }

    // Centre node
    ctx.beginPath(); ctx.arc(cx, cy, 6.5 + cp * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${_biomeColors.a},${0.85 + cp * 0.15})`; ctx.fill();

    if (total === 0) {
        ctx.beginPath(); ctx.arc(cx, cy, 12 + cp * 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${_biomeColors.a},${0.18 + cp * 0.1})`;
        ctx.lineWidth = 0.9; ctx.stroke();
    } else {
        branches.forEach(b => drawBranch(b, animTime, 1));
    }

    // Floating spore particles
    if (total > 0 && sporeParticles.length < 30 && Math.random() < 0.18) {
        sporeParticles.push({
            x: 10 + Math.random() * (W - 20),
            y: H * 0.2 + Math.random() * H * 0.65,
            vx: (Math.random() - 0.5) * 0.25,
            vy: -(0.22 + Math.random() * 0.38),
            r: 0.6 + Math.random() * 0.9,
            life: 0, maxLife: 65 + Math.random() * 85
        });
    }
    sporeParticles = sporeParticles.filter(p => {
        p.life++;
        p.x += p.vx + Math.sin(p.life * 0.11) * 0.06;
        p.y += p.vy;
        const a = (1 - p.life / p.maxLife) * 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${_biomeColors.b},${a})`; ctx.fill();
        return p.life < p.maxLife && p.y > -5;
    });

    // Radial fade — branches dissolve to transparent instead of hard-clipping
    const fadeR0 = Math.min(W, H) * 0.28;
    const fadeR1 = Math.min(W * 0.54, H * 0.9);
    const fade = ctx.createRadialGradient(cx, cy, fadeR0, cx, cy, fadeR1);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(animateMycelium);
}

// ═══════════════════════════════════════
//  SOUND EFFECTS (Web Audio API)
// ═══════════════════════════════════════
let _audioCtx = null;
function _getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
}
function _playTone(freq, type, dur, vol, attack, decay) {
    if (!state.settings.soundEnabled) return;
    try {
        const ctx = _getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + (attack || 0.005));
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur + (decay || 0));
    } catch (e) { }
}
function playClickSound() {
    _playTone(440, 'sine', 0.08, 0.15);
}
function playPulseSound() {
    _playTone(180, 'triangle', 0.35, 0.3, 0.01, 0.1);
    setTimeout(() => _playTone(260, 'sine', 0.25, 0.2, 0.005), 60);
}
function playAchievementSound() {
    _playTone(523, 'sine', 0.15, 0.2);
    setTimeout(() => _playTone(659, 'sine', 0.15, 0.2), 120);
    setTimeout(() => _playTone(784, 'sine', 0.25, 0.25), 240);
}
function playSporulateSound() {
    _playTone(220, 'sawtooth', 0.1, 0.15);
    setTimeout(() => _playTone(330, 'sine', 0.3, 0.2, 0.02), 100);
    setTimeout(() => _playTone(440, 'sine', 0.4, 0.18, 0.03), 260);
}
function playEventSound() {
    _playTone(330, 'triangle', 0.12, 0.15);
    setTimeout(() => _playTone(415, 'triangle', 0.18, 0.15), 130);
}

// ═══════════════════════════════════════
//  GAME LOOP
// ═══════════════════════════════════════
let msgTimer = 0;
function showMessage() { tick(MESSAGES[state.msgIdx % MESSAGES.length]); }

const DT = 0.05;
setInterval(() => {
    const sps = getSps(); if (sps > 0) { const g = sps * DT; state.spores += g; state.totalEarned += g; if (sps > (state.peakSpsThisRun || 0)) state.peakSpsThisRun = sps; }
    if (getRunMod()?.id === 'void_tithe') { const tithe = state.spores * 0.03 * DT; state.spores = Math.max(0, state.spores - tithe); }
    tickSeason(DT); tickSymbiosis(DT); tickEvents(DT);
    updateStats(); updateProducers();
    buildUpgrades(); updateUpgrades();
    updateSymbiosis(); updateSporulateUI(); updateBondAlert();
    checkAchievements(); buildGoals();
    buildCodex(); buildResearch(); updateResearch();
    updateBiomePath(); buildStats(); buildEssence();
}, 50);
setInterval(() => { if (++msgTimer % 8 === 0 && !state.activeEvent) showMessage(); checkTutorial(); checkBiomeObjectives(); checkEndgame(); }, 1000);
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
    else { _offlineApplied = false; applyOfflineProgress(); }
});
document.addEventListener('pagehide', () => { state.lastSeen = Date.now(); saveGame(); });
document.addEventListener('beforeunload', () => { state.lastSeen = Date.now(); saveGame(); });

// ═══════════════════════════════════════
//  OFFLINE PROGRESS
// ═══════════════════════════════════════
const MAX_OFFLINE_SECONDS = 8 * 3600;
let _offlineApplied = false; // guard against double-run on login (local load + cloud load)
function applyOfflineProgress() {
    if (_offlineApplied) return;
    if (!state.lastSeen) return;
    const maxOffline = hasCodex('R3') ? 12 * 3600 : 8 * 3600;
    const elapsed = Math.min((Date.now() - state.lastSeen) / 1000, maxOffline);
    _offlineApplied = true;
    state.lastSeen = 0;
    if (elapsed < 60) return;
    const sps = getSps(); if (sps <= 0) return;
    const earned = sps * elapsed; state.spores += earned; state.totalEarned += earned;
    const totalMins = Math.floor(elapsed / 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${totalMins}m`;
    const overlay = document.getElementById('offline-overlay');
    if (overlay) {
        document.getElementById('offline-modal-time').textContent = timeStr + ' passed while you were away';
        document.getElementById('offline-modal-earned').textContent = '+' + fmt(earned) + ' spores';
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('visible');
    }
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
//  ZOOM RESET (mobile)
// ═══════════════════════════════════════
(function setupZoomReset() {
    if (!window.visualViewport) return;
    const btn = document.getElementById('zoom-reset-btn');
    function checkZoom() {
        btn.classList.toggle('visible', window.visualViewport.scale > 1.05);
    }
    window.visualViewport.addEventListener('resize', checkZoom);
    btn.addEventListener('click', () => {
        const vp = document.querySelector('meta[name=viewport]');
        // Snap to scale 1 by briefly locking maximum-scale, then restore
        vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
        setTimeout(() => {
            vp.content = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover';
        }, 50);
    }, { passive: true });
})();

// ═══════════════════════════════════════
//  PULL TO REFRESH (mobile)
// ═══════════════════════════════════════
(function setupPullToRefresh() {
    if (!('ontouchstart' in window)) return;
    const indicator = document.getElementById('ptr-indicator');
    let startY = 0, pulling = false;

    document.addEventListener('touchstart', e => {
        if (window.scrollY === 0 && e.touches.length === 1) {
            startY = e.touches[0].clientY;
            pulling = true;
        }
    }, { passive: true });

    document.addEventListener('touchmove', e => {
        if (!pulling) return;
        const dy = e.touches[0].clientY - startY;
        if (dy <= 0) { pulling = false; indicator.style.top = ''; return; }
        const pull = Math.min(dy * 0.5, 60);
        indicator.style.top = (pull - 50) + 'px';
        indicator.classList.toggle('ptr-ready', dy > 80);
    }, { passive: true });

    document.addEventListener('touchend', e => {
        if (!pulling) return;
        const dy = e.changedTouches[0].clientY - startY;
        indicator.style.top = '';
        indicator.classList.remove('ptr-ready');
        pulling = false;
        if (dy > 80) location.reload();
    }, { passive: true });
})();

// ═══════════════════════════════════════
//  EVENT WIRING
// ═══════════════════════════════════════
// Leaderboard modal wiring
document.getElementById('lb-btn').addEventListener('click', openLbModal);
document.getElementById('lb-modal-close').addEventListener('click', closeLbModal);
document.getElementById('lb-overlay').addEventListener('click', e => { if (e.target === document.getElementById('lb-overlay')) closeLbModal(); });

// Settings modal wiring
document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
document.getElementById('settings-modal-close').addEventListener('click', closeSettingsModal);
document.getElementById('settings-overlay').addEventListener('click', e => { if (e.target === document.getElementById('settings-overlay')) closeSettingsModal(); });

document.getElementById('opt-events').addEventListener('change', () => {
    state.settings.eventsEnabled = document.getElementById('opt-events').checked;
    if (!state.settings.eventsEnabled) { state.activeEvent = null; state.eventCooldown = 90; }
    updateSettingsUI();
    tick(state.settings.eventsEnabled ? '🌤 Events enabled.' : '○ Events disabled.', true);
});

document.getElementById('opt-seasons').addEventListener('change', () => {
    state.settings.seasonsEnabled = document.getElementById('opt-seasons').checked;
    updateSettingsUI();
    tick(state.settings.seasonsEnabled ? '🌱 Seasons enabled.' : '○ Seasons disabled.', true);
});

document.getElementById('opt-gold-theme').addEventListener('change', () => {
    state.goldTheme = document.getElementById('opt-gold-theme').checked;
    applyTheme();
    saveGame();
});

document.getElementById('opt-sound').addEventListener('change', () => {
    state.settings.soundEnabled = document.getElementById('opt-sound').checked;
    saveGame();
});

document.getElementById('seg-colony').addEventListener('click', () => {
    state.settings.disasterMode = false;
    updateSettingsUI();
    tick('🌿 Colony mode: only beneficial events.', true);
});

document.getElementById('seg-disaster').addEventListener('click', () => {
    state.settings.disasterMode = true;
    updateSettingsUI();
    tick('⚠️ Disaster mode: events can now harm your colony.', true);
});
document.getElementById('spore-btn').addEventListener('click', e => {
    if (getRunMod()?.id === 'spore_silence') return; // clicking does nothing
    playClickSound();
    const gain = getClickValue(); state.spores += gain; state.totalEarned += gain; state.allTimeClicks++; state.clicksThisPrestige++;
    // Hidden achievement tracking
    const now = Date.now();
    _lastClickAt = now;
    _runClicks++;
    _clickTs = _clickTs.filter(t => now - t < 15000); _clickTs.push(now);
    if (_clickTs.length >= 100) tryUnlockHidden('h1');
    if (_runClicks >= 5000) tryUnlockHidden('h13');
    if (state.hivemindUnlocked) {
        const chargeRate = (hasCodex('P2') ? 0.65 : 0.5) * (getRunMod()?.id === 'overclocked' ? 2 : 1);
        state.hivemind = Math.min(100, state.hivemind + chargeRate);
        if (state.hivemind >= 100) triggerPulse();
    }
    spawnBurst(e.clientX, e.clientY, gain); spawnPulseRing(); updateStats();
});
document.getElementById('subtab-available').addEventListener('click', () => switchUpgradeSub('available'));
document.getElementById('subtab-owned').addEventListener('click', () => switchUpgradeSub('owned'));
ALL_TABS.forEach(t => document.getElementById('tab-btn-' + t).addEventListener('click', () => switchTab(t)));

// ── Tab swipe gestures (mobile) ────────────────────────────────────────────
(function () {
    const panel = document.getElementById('right');
    let x0 = null, y0 = null;

    panel.addEventListener('touchstart', e => {
        x0 = e.touches[0].clientX;
        y0 = e.touches[0].clientY;
    }, { passive: true });

    panel.addEventListener('touchend', e => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        const dy = e.changedTouches[0].clientY - y0;
        x0 = null; y0 = null;

        // Ignore if swipe is mostly vertical (user is scrolling)
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

        const active = ALL_TABS.findIndex(
            t => document.getElementById('tab-' + t).classList.contains('active')
        );
        const next = dx < 0
            ? Math.min(active + 1, ALL_TABS.length - 1)  // swipe left  → next tab
            : Math.max(active - 1, 0);                    // swipe right → prev tab

        if (next !== active) {
            switchTab(ALL_TABS[next]);
            if (navigator.vibrate) navigator.vibrate(18);
        }
    }, { passive: true });
})();

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
document.getElementById('p-reset-btn').addEventListener('click', openResetModal);
document.getElementById('reset-cancel-btn').addEventListener('click', closeResetModal);
document.getElementById('reset-confirm-btn').addEventListener('click', () => { closeResetModal(); resetGame(); });
document.getElementById('reset-overlay').addEventListener('click', e => { if (e.target === document.getElementById('reset-overlay')) closeResetModal(); });
document.getElementById('p-tutorial-btn').addEventListener('click', () => {
    closeProfileModal();
    localStorage.removeItem('meTutorialDone');
    _tutorialStep = 0;
    initTutorial();
});
document.getElementById('p-signout-modal-btn').addEventListener('click', doSignOut);

// ── Save Export / Import ──────────────────────────────────────────────────
function exportSave() {
    try {
        const data = buildSaveData();
        const encoded = btoa(JSON.stringify(data));
        navigator.clipboard.writeText(encoded).then(() => {
            tick('📤 Save code copied to clipboard!', true);
            closeProfileModal();
        }).catch(() => {
            // Fallback: prompt with the string so they can copy manually
            prompt('Copy your save code:', encoded);
        });
    } catch (e) {
        tick('❌ Export failed.', true);
    }
}

function importSave(inputId, errorId) {
    const raw = document.getElementById(inputId).value.trim();
    const errEl = document.getElementById(errorId);
    errEl.textContent = '';
    if (!raw) { errEl.textContent = 'Paste a save code first.'; return; }
    try {
        const sv = JSON.parse(atob(raw));
        if (typeof sv !== 'object' || sv === null || sv.spores === undefined) throw new Error('invalid');
        if (!confirm('Load this save? Your current progress will be overwritten.')) return;
        state = defaultState();
        applyGameData(sv);
        invalidateMults();
        try { localStorage.setItem('myceliumEmpireV9', JSON.stringify(buildSaveData())); } catch (e) { }
        lastUpgradeKey = null; lastOwnedKey = null; lastSymKey = null; lastResearchKey = null;
        lastAchKey = null; lastCodexKey = null; lastStatsKey = null;
        _lastBiomeIdx = -1; _openPanel = null; _lastBondAlertKey = ''; _lastEssenceKey = ''; _lastDecisionKey = ''; _lastModKey = '';
        _clickTs = []; _hivemindZeroAt = Date.now(); _lastClickAt = Date.now(); _recentPulseTs = []; _runStartAt = Date.now(); _runClicks = 0; _lastEventAt = 0;
        branches = []; lastTotal = -1;
        closeProfileModal();
        bootUI();
        applyOfflineProgress();
        tick('📥 Save imported successfully!', true);
    } catch (e) {
        errEl.textContent = 'Invalid save code. Make sure you copied it completely.';
    }
}

function wireImportToggle(toggleId, panelId) {
    document.getElementById(toggleId).addEventListener('click', () => {
        const panel = document.getElementById(panelId);
        const open = panel.style.display === 'block';
        panel.style.display = open ? 'none' : 'block';
        document.getElementById(toggleId).textContent = open ? '📥 Import Save' : '✕ Cancel Import';
    });
}

// Logged-in
document.getElementById('p-export-btn').addEventListener('click', exportSave);
wireImportToggle('p-import-toggle-btn', 'p-import-panel');
document.getElementById('p-import-confirm-btn').addEventListener('click', () => importSave('p-import-input', 'p-import-error'));

// Allow Enter key in auth forms
document.getElementById('p-password-login').addEventListener('keydown', e => { if (e.key === 'Enter') doSignIn(); });
document.getElementById('p-password-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') doSignUp(); });

// ═══════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════
// ═══════════════════════════════════════
//  TUTORIAL
// ═══════════════════════════════════════
let _tutorialStep = 0;

const TUTORIAL_STEPS = [
    {
        step: 1,
        label: 'Step 1 of 5',
        emoji: '👆',
        msg: 'Tap the mushroom to harvest your first spores. Keep clicking until you can afford a producer!',
        target: '#spore-btn',   // the actual button, not the whole wrap
        prefer: 'above',
        canSkip: false,
        advance: s => s.producers.some(x => x.owned >= 1),
    },
    {
        step: 2,
        label: 'Step 2 of 5',
        emoji: '🍄',
        msg: 'Producers harvest spores automatically — even while you\'re away. Buy more to grow faster.',
        target: '#tab-btn-producers',
        prefer: 'left',         // card floats left of the right panel, never covers the list
        canSkip: true,
        advance: s => UPGRADES_DEF.some(u => {
            const su = s.upgrades.find(x => x.id === u.id);
            return !su?.bought && u.req(s);
        }),
    },
    {
        step: 3,
        label: 'Step 3 of 5',
        emoji: '⬆️',
        msg: 'An upgrade is available! Tap the Upgrades tab — look for the teal dot. Upgrades supercharge your producers.',
        target: '#tab-btn-upgrades',
        prefer: 'left',
        canSkip: true,
        advance: s => s.upgrades.some(x => x.bought),
    },
    {
        step: 4,
        label: 'Step 4 of 5',
        emoji: '⚡',
        msg: 'Find and buy the Hivemind Pulse upgrade — then click the mushroom to charge and fire it for a massive spore burst!',
        target: '#tab-btn-upgrades',
        prefer: 'left',
        canSkip: true,
        advance: s => s.allTimePulses >= 1,
    },
    {
        step: 5,
        label: 'Step 5 of 5',
        emoji: '🧬',
        msg: 'When your spores hit the threshold, you can Sporulate — resetting this run but gaining a permanent legacy bonus. The stronger your run, the bigger the reward.',
        target: null,
        prefer: 'corner',
        canSkip: false,
        isDismiss: true,
        advance: () => false,
    },
];

function initTutorial() {
    if (localStorage.getItem('meTutorialDone') || state.totalEarned > 500 || state.prestigeCount > 0) {
        _tutorialStep = 0;
        return;
    }
    _tutorialStep = 1;
    renderTutorialStep();
}

function renderTutorialStep() {
    if (_tutorialStep === 0) return;
    const def = TUTORIAL_STEPS.find(s => s.step === _tutorialStep);
    if (!def) { completeTutorial(); return; }

    document.getElementById('tutorial-step-label').textContent = def.label;
    document.getElementById('tutorial-emoji').textContent = def.emoji;
    document.getElementById('tutorial-msg').textContent = def.msg;
    const skipBtn = document.getElementById('tutorial-skip');
    skipBtn.textContent = def.isDismiss ? '✓ Got it!' : 'Skip tutorial';
    skipBtn.style.display = (def.canSkip || def.isDismiss) ? 'block' : 'none';

    document.getElementById('tutorial-card').style.display = 'block';

    document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
    const target = def.target ? document.querySelector(def.target) : null;
    if (target) target.classList.add('tutorial-focus');

    positionTutorialCard();
}

function positionTutorialCard() {
    // Position is fixed via CSS (top-right on desktop, bottom-center on mobile).
    // Focus ring on the target element shows the player where to look.
    // No JS positioning needed — prevents the card from ever landing inside the game area.
    const arrowU = document.getElementById('tutorial-arrow-up');
    const arrowD = document.getElementById('tutorial-arrow-down');
    const arrowR = document.getElementById('tutorial-arrow-right');
    [arrowU, arrowD, arrowR].forEach(a => { if (a) a.style.display = 'none'; });
}

function advanceTutorial() {
    document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
    _tutorialStep++;
    if (_tutorialStep > 5) { completeTutorial(); return; }
    renderTutorialStep();
}

function completeTutorial() {
    _tutorialStep = 0;
    localStorage.setItem('meTutorialDone', '1');
    document.getElementById('tutorial-card').style.display = 'none';
    document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
}

function checkTutorial() {
    if (_tutorialStep === 0) return;
    const def = TUTORIAL_STEPS.find(s => s.step === _tutorialStep);
    if (!def || def.isDismiss) return;
    if (def.advance(state)) advanceTutorial();
}

document.getElementById('tutorial-skip').addEventListener('click', completeTutorial);
document.getElementById('endgame-dismiss').addEventListener('click', () => {
    document.getElementById('endgame-overlay').classList.remove('visible');
    document.getElementById('congrats-overlay').classList.add('visible');
});
document.getElementById('congrats-dismiss').addEventListener('click', () => {
    document.getElementById('congrats-overlay').classList.remove('visible');
});
document.getElementById('offline-modal-close').addEventListener('click', () => {
    document.getElementById('offline-overlay').classList.remove('visible');
    document.getElementById('offline-overlay').setAttribute('aria-hidden', 'true');
});

function bootUI() {
    buildProducers(); buildSymbiosis(); buildOwned(); buildGoals(); buildCodex();
    updateStats(); updateProducers(); buildUpgrades(); updateUpgrades();
    updateSymbiosis(); updateSeasonBar(); updateBiomePath(); updateSporulateUI(); updateBondAlert();
    updateSettingsUI();
    buildResearch(); updateResearch(); buildStats(); buildEssence();
    applyTheme();
    updateLoreTabBadge();
    if (state.totalEarned > 0) showMessage();
}

// Biome picker — event delegation so clicks work regardless of DOM rebuilds or input type
document.getElementById('spor-biome-grid').addEventListener('click', e => {
    const btn = e.target.closest('[data-biome-idx]');
    if (btn) selectBiomeChoice(parseInt(btn.dataset.biomeIdx, 10));
});

initFirebase();
loadGame();
bootUI();
initTutorial();

// ═══════════════════════════════════════
//  DEV TOOLS (localhost only)
// ═══════════════════════════════════════
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    document.getElementById('dev-section').style.display = 'block';

    document.getElementById('dev-endgame-btn').addEventListener('click', () => {
        BIOMES.forEach(b => { if (!state.biomesVisited.includes(b.id)) state.biomesVisited.push(b.id); });
        ALL_CODEX_IDS.forEach(id => { if (!state.codexPurchased.includes(id)) state.codexPurchased.push(id); });
        state.producers.forEach(pr => { if (pr.owned < 500) pr.owned = 500; });
        state.endgameReached = false;
        checkEndgame();
    });

    document.getElementById('dev-offline-btn').addEventListener('click', () => {
        const overlay = document.getElementById('offline-overlay');
        document.getElementById('offline-modal-time').textContent = '2h 30m passed while you were away';
        document.getElementById('offline-modal-earned').textContent = '+' + fmt(getSps() * 9000) + ' spores';
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('visible');
    });

    document.getElementById('dev-essence-btn').addEventListener('click', () => {
        const n = Number(document.getElementById('dev-essence-amt').value) || 1000;
        state.essence += n; _lastEssenceKey = '';
    });

    document.getElementById('dev-spores-btn').addEventListener('click', () => {
        const n = Number(document.getElementById('dev-spores-amt').value) || 1e9;
        state.spores += n; state.totalEarned += n;
    });

    document.getElementById('dev-prestige-btn').addEventListener('click', () => {
        const n = Number(document.getElementById('dev-prestige-amt').value);
        if (isNaN(n) || n < 0) return;
        state.prestigeCount = Math.floor(n); invalidateMults();
    });
}
applyOfflineProgress();
requestAnimationFrame(animateMycelium);