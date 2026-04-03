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
    { id: 'satellite', name: 'Spore Satellite', emoji: '🛰', desc: 'Orbital platforms blanket the atmosphere in spores.', baseCost: 2e9, baseSps: 500000 },
    { id: 'crystal', name: 'Hivemind Crystal', emoji: '💎', desc: 'Crystallised mycelium acts as a living supercomputer.', baseCost: 1.5e10, baseSps: 2500000 },
    { id: 'rootsing', name: 'Root Singularity', emoji: '🌐', desc: 'All root systems on Earth merge into one vast mind.', baseCost: 1.2e11, baseSps: 12000000 },
    { id: 'temporal', name: 'Temporal Thread', emoji: '⌛', desc: 'Threads reach backward and forward through time.', baseCost: 1e12, baseSps: 60000000 },
    { id: 'stellar', name: 'Stellar Mycelium', emoji: '⭐', desc: 'Spores travel between star systems on solar winds.', baseCost: 9e12, baseSps: 300000000 },
    { id: 'consciousness', name: 'Consciousness Web', emoji: '🧠', desc: 'The network becomes the substrate of all thought.', baseCost: 8e13, baseSps: 1500000000 },
    { id: 'dimensional', name: 'Dimensional Rot', emoji: '🌀', desc: 'Your decay spreads across parallel dimensions.', baseCost: 7e14, baseSps: 25000000000 },
    { id: 'eternalspore', name: 'The Eternal Spore', emoji: '♾', desc: 'There is no end. There was no beginning. Only growth.', baseCost: 7e15, baseSps: 150000000000 },
    { id: 'galactic', name: 'Galactic Lattice', emoji: '🌠', desc: 'A crystalline lattice spans entire galaxy clusters.', baseCost: 8e16, baseSps: 800000000000 },
    { id: 'absolute', name: 'The Absolute', emoji: '🔮', desc: 'Beyond dimension. Beyond time. The final rot.', baseCost: 7e17, baseSps: 5e12 },
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
    { id: 'u11b', tier: 'dream', name: 'Collective Unconscious', desc: 'Dream Mycelium 7× more output.', cost: 5e10, req: s => p(s, 'dreamweb').owned >= 12, apply: s => mp(s, 'dreamweb', 7) },
    { id: 'u12', tier: 'satellite', name: 'Geostationary Web', desc: 'Spore Satellites 5× more output.', cost: 2e10, req: s => p(s, 'satellite').owned >= 3, apply: s => mp(s, 'satellite', 5) },
    { id: 'u13', tier: 'crystal', name: 'Quantum Lattice', desc: 'Hivemind Crystals 6× more output.', cost: 1.5e11, req: s => p(s, 'crystal').owned >= 3, apply: s => mp(s, 'crystal', 6) },
    { id: 'u14', tier: 'rootsing', name: 'Planetary Nervous System', desc: 'Root Singularity 7× more.', cost: 1.5e12, req: s => p(s, 'rootsing').owned >= 3, apply: s => mp(s, 'rootsing', 7) },
    { id: 'u15', tier: 'temporal', name: 'Causal Loop Harvest', desc: 'Temporal Threads 8× more.', cost: 1.5e13, req: s => p(s, 'temporal').owned >= 3, apply: s => mp(s, 'temporal', 8) },
    { id: 'u15b', tier: 'temporal', name: 'Timestream Convergence', desc: 'Temporal Threads 12× more.', cost: 2e14, req: s => p(s, 'temporal').owned >= 15, apply: s => mp(s, 'temporal', 12) },
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
    { id: 'forest', name: 'Ancient Forest', emoji: '🌲', clickMult: 1, prodMult: 1.0, noSeasons: false, desc: 'The origin. Balanced and fertile.', colors: { bg: '#0f1e11', a: '29,158,117', b: '159,225,203', n: '93,202,165', g1: '#1D9E7548', g2: '#1D9E7520' } },
    { id: 'desert', name: 'Arid Desert', emoji: '🏜', clickMult: 3, prodMult: 0.65, noSeasons: false, desc: 'Clicks are powerful. Producers struggle in the heat.', colors: { bg: '#1e140a', a: '190,120,35', b: '230,175,80', n: '210,150,55', g1: '#BE781348', g2: '#BE781320' } },
    { id: 'ocean', name: 'Deep Ocean', emoji: '🌊', clickMult: 1, prodMult: 2.0, noSeasons: true, desc: 'No seasons. Producers flourish in the crushing dark.', colors: { bg: '#08101e', a: '25,95,175', b: '70,175,220', n: '90,195,235', g1: '#195FAF48', g2: '#195FAF20' } },
    { id: 'arctic', name: 'Frozen Tundra', emoji: '🧊', clickMult: 1, prodMult: 1.0, noSeasons: false, arcticMode: true, desc: 'Winter bonuses are doubled. Summer is brutal.', colors: { bg: '#0c141e', a: '70,145,195', b: '165,215,245', n: '195,235,255', g1: '#4691C348', g2: '#4691C320' } },
    { id: 'void', name: 'The Void', emoji: '🌌', clickMult: 2, prodMult: 3.0, noSeasons: false, desc: 'Tripled production. Strange laws apply here.', colors: { bg: '#11081e', a: '115,55,175', b: '195,130,245', n: '215,160,255', g1: '#733FAF48', g2: '#733FAF20' } },
    { id: 'swamp', name: 'Fungal Swamp', emoji: '🌿', clickMult: 1, prodMult: 1.75, noSeasons: false, swampMode: true, desc: 'Rot is everywhere. Producers thrive, but seasons swing harder.', colors: { bg: '#0e1a07', a: '80,120,28', b: '148,190,52', n: '172,214,62', g1: '#507A1C48', g2: '#507A1C20' } },
    { id: 'cave', name: 'Crystal Caves', emoji: '💎', clickMult: 4, prodMult: 0.8, noSeasons: true, desc: 'No seasons. Clicks resonate through crystal, massively amplified.', colors: { bg: '#081318', a: '32,118,195', b: '105,215,245', n: '145,235,255', g1: '#2076C348', g2: '#2076C320' } },
    { id: 'canopy', name: 'Ancient Canopy', emoji: '🌴', clickMult: 1.5, prodMult: 1.5, noSeasons: false, desc: 'High above the forest floor. Both clicks and producers gain a steady lift.', colors: { bg: '#0b1e0d', a: '35,150,60', b: '95,215,85', n: '125,230,95', g1: '#23963C48', g2: '#23963C20' } },
    { id: 'volcanic', name: 'Volcanic Rift', emoji: '🌋', clickMult: 2, prodMult: 0.5, noSeasons: false, volcanicMode: true, desc: 'Extreme heat halves producers but doubles clicks. Spring and Fall surge.', colors: { bg: '#1e0a08', a: '190,55,22', b: '238,120,45', n: '252,148,58', g1: '#BE371648', g2: '#BE371620' } },
    { id: 'celestial', name: 'Celestial Drift', emoji: '🌠', clickMult: 3, prodMult: 4.0, noSeasons: true, desc: 'Beyond the planet. No seasons. Clicks and production both reach their peak.', colors: { bg: '#0d0a1e', a: '145,90,205', b: '245,200,85', n: '255,220,95', g1: '#9158CD48', g2: '#9158CD20' } },
];

const SYMBIONTS = [
    { id: 'earthworm', name: 'Earthworm', emoji: '🪱', desc: 'Tills the soil, enriching your threads.', unlockAt: 300, pactCost: 150, bonusSps: 2, feedCost: 80, feedEvery: 40 },
    { id: 'beetle', name: 'Dung Beetle', emoji: '🪲', desc: 'Spreads your spores through the forest floor.', unlockAt: 3000, pactCost: 1500, bonusSps: 15, feedCost: 400, feedEvery: 55 },
    { id: 'antcolony', name: 'Ant Colony', emoji: '🐜', desc: 'An entire colony works to expand your reach.', unlockAt: 30000, pactCost: 15000, bonusSps: 100, feedCost: 3000, feedEvery: 75 },
    { id: 'moth', name: 'Morpho Moth', emoji: '🦋', desc: 'Carries spores on iridescent wings across vast distances.', unlockAt: 250000, pactCost: 100000, bonusSps: 600, feedCost: 20000, feedEvery: 60 },
    { id: 'bees', name: 'Hivemind Bees', emoji: '🐝', desc: 'A psychically linked swarm that pulses your spores across entire regions.', unlockAt: 2000000, pactCost: 800000, bonusSps: 4000, feedCost: 150000, feedEvery: 70 },
    { id: 'spider', name: 'Cave Spider', emoji: '🕷', desc: 'Weaves spore-laden webs deep in caverns — unseen, but everywhere.', unlockAt: 20000000, pactCost: 8000000, bonusSps: 25000, feedCost: 1000000, feedEvery: 80 },
    { id: 'lizard', name: 'Root Lizard', emoji: '🦎', desc: 'An ancient reptile whose scales host thriving spore colonies along every root system it touches.', unlockAt: 500000000, pactCost: 200000000, bonusSps: 150000, feedCost: 8000000, feedEvery: 90 },
    { id: 'elk', name: 'Spore Elk', emoji: '🦌', desc: 'A great elk whose antlers drip with bioluminescent spores, seeding every forest it passes through.', unlockAt: 10000000000, pactCost: 4000000000, bonusSps: 1000000, feedCost: 60000000, feedEvery: 100 },
    { id: 'leech', name: 'Void Leech', emoji: '🐙', desc: 'A creature from between dimensions that feeds on dark matter and spreads your spores across realities.', unlockAt: 500000000000, pactCost: 200000000000, bonusSps: 8000000, feedCost: 500000000, feedEvery: 110 },
    { id: 'serpent', name: 'Eternal Serpent', emoji: '🐍', desc: 'An ageless serpent that has carried your spores since before time had meaning.', unlockAt: 5e13, pactCost: 2e13, bonusSps: 75000000, feedCost: 5000000000, feedEvery: 120 },
];

const EVENTS_POSITIVE = [
    { id: 'rain', name: 'Rainstorm', emoji: '🌧', color: '#7FC4D8', duration: 30, desc: 'Rain boosts fruiting bodies and threads.', mults: { fruiting: 1.5, threads: 1.3 }, seasonBias: [3, 1, 2, 0.5] },
    { id: 'wind', name: 'Spore Wind', emoji: '💨', color: '#9FE1CB', duration: 20, desc: 'A wind carries your spores across the world.', mults: {}, bonusSpores: 500, seasonBias: [1, 2, 1.5, 0.5] },
    { id: 'roots', name: 'Root Surge', emoji: '🌳', color: '#5DCAA5', duration: 25, desc: 'Tree roots pulse with renewed energy.', mults: { woodweb: 2, threads: 1.2 }, seasonBias: [2, 1, 2, 0.5] },
    { id: 'glow', name: 'Bioluminescence', emoji: '✨', color: '#9FE1CB', duration: 30, desc: 'The whole network glows. All output doubled.', mults: {}, globalMult: 2, seasonBias: [1, 0.5, 1, 2.5] },
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
    { id: 'drought', name: 'Drought', emoji: '☀️', color: '#EF9F27', duration: 20, desc: 'Drought shrivels your fruiting bodies.', mults: { fruiting: 0.2, sporestorm: 0.5 }, chainTo: 'fire', seasonBias: [0.5, 3, 1, 0.2] },
    { id: 'pest', name: 'Pest Invasion', emoji: '🪲', color: '#c47a4a', duration: 15, desc: 'Pests consume 8% of your stored spores!', mults: {}, stealPct: 0.08, seasonBias: [2, 1.5, 1, 0.3] },
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
    { id: 'a1', emoji: '🍄', name: 'First Pulse', desc: 'Earn 100 total spores.', bonusDesc: '', req: s => s.totalEarned >= 100, lore: 'The spore lands. Something begins.' },
    { id: 'a2', emoji: '🕸', name: 'Rot Spreads', desc: 'Own 5 Mycelium Threads.', bonusDesc: '', req: s => p(s, 'threads').owned >= 5, lore: 'The wood softens. You are not alone.' },
    { id: 'a3', emoji: '🌿', name: 'First Fruiting', desc: 'Own 5 Fruiting Bodies.', bonusDesc: '', req: s => p(s, 'fruiting').owned >= 5, lore: 'A cap emerges. The forest notices.' },
    { id: 'a4', emoji: '💨', name: 'Storm Walker', desc: 'Own 5 Spore Storms.', bonusDesc: '', req: s => p(s, 'sporestorm').owned >= 5, lore: 'The wind carries your will now.' },
    { id: 'a5', emoji: '⚡', name: 'Network Mind', desc: 'Trigger the Hivemind Pulse 3 times.', bonusDesc: '', req: s => s.allTimePulses >= 3, lore: 'The pulse echoes further each time.' },
    { id: 'a6', emoji: '🪱', name: 'First Bond', desc: 'Form your first Symbiosis pact.', bonusDesc: '', req: s => s.symbiosis.some(x => x.active || x.broken), lore: 'You are not the only living thing here.' },
    { id: 'a7', emoji: '✨', name: 'Thousand Spores', desc: 'Earn 1,000 total spores.', bonusDesc: '', req: s => s.totalEarned >= 1000, lore: 'The count is meaningless now. You grow.' },
    { id: 'a8', emoji: '🌲', name: 'Deep Roots', desc: 'Own 10 Wood Wide Web.', bonusDesc: '', req: s => p(s, 'woodweb').owned >= 10, lore: 'The trees speak. You answer.' },
    { id: 'a9', emoji: '🌀', name: 'Pulse Master', desc: 'Trigger Hivemind Pulse 10 times.', bonusDesc: '', req: s => s.allTimePulses >= 10, lore: 'You no longer wait for the pulse.' },
    { id: 'a10', emoji: '🧠', name: 'Million Mind', desc: 'Earn 1,000,000 total spores.', bonusDesc: '', req: s => s.totalEarned >= 1000000, lore: 'The numbers lost meaning long ago.' },
    { id: 'a11', emoji: '🧬', name: 'Ascendant', desc: 'Sporulate for the first time.', bonusDesc: '', req: s => s.prestigeCount >= 1, lore: 'Death is not an end. It is a dispersal.' },
    { id: 'a12', emoji: '♾', name: 'Many Lives', desc: 'Sporulate 3 times.', bonusDesc: '', req: s => s.prestigeCount >= 3, lore: 'Each spore carries the weight of worlds.' },
    { id: 'a13', emoji: '❄️', name: 'Winter Survivor', desc: 'Survive a full Winter.', bonusDesc: '', req: s => s.winterSurvived, lore: 'Even under ice, the network breathes.' },
    { id: 'a14', emoji: '🐜', name: 'Antlord', desc: 'Form a pact with the Ant Colony.', bonusDesc: '', req: s => { const sc = s.symbiosis.find(x => x.id === 'antcolony'); return sc && (sc.active || sc.broken); }, lore: 'They serve the mycelium now.' },
    { id: 'a15', emoji: '🌌', name: 'Beyond the Void', desc: 'Own 1 Void Spore.', bonusDesc: '', req: s => p(s, 'voidspore').owned >= 1, lore: 'There is no language for what you have seen.' },
    { id: 'a16', emoji: '🪨', name: 'Stone Keeper', desc: 'Own 5 Lichen Veils.', bonusDesc: '', req: s => p(s, 'lichenveil').owned >= 5, lore: 'Even stone remembers, if you ask it slowly.' },
    { id: 'a17', emoji: '💤', name: 'Dreamer', desc: 'Own 1 Dream Mycelium.', bonusDesc: '', req: s => p(s, 'dreamweb').owned >= 1, lore: 'Asleep, they still spread.' },
    { id: 'a18', emoji: '⭐', name: 'Among the Stars', desc: 'Own 1 Stellar Mycelium.', bonusDesc: '', req: s => p(s, 'stellar').owned >= 1, lore: 'The stars were never empty.' },
    { id: 'a19', emoji: '♾', name: 'The Eternal', desc: 'Own 1 Eternal Spore.', bonusDesc: '', req: s => p(s, 'eternalspore').owned >= 1, lore: 'There is no word for what you are now.' },
    { id: 'a20', emoji: '🌀', name: 'Pulse God', desc: 'Trigger Hivemind Pulse 50 times.', bonusDesc: '', req: s => s.allTimePulses >= 50, lore: 'The universe pulses at your frequency.' },
    { id: 'a21', emoji: '🌠', name: 'Galactic Mind', desc: 'Own 1 Galactic Lattice.', bonusDesc: '', req: s => p(s, 'galactic').owned >= 1, lore: 'You are no longer a planet. You are a galaxy.' },
    { id: 'a22', emoji: '🔮', name: 'The Absolute', desc: 'Own 1 The Absolute.', bonusDesc: '', req: s => p(s, 'absolute').owned >= 1, lore: 'Language has no word for this.' },
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
        clicksThisPrestige: 0, pendingBiomeChoice: null,
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
        essence: 0, codexPurchased: [],
        settings: { eventsEnabled: true, seasonsEnabled: true, disasterMode: false },
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
function getPrestigeMult() {
    const base = hasCodex('A5') ? 0.75 : 0.5;
    const extra = hasCodex('A1') ? 0.1 : 0;
    return 1 + state.prestigeCount * (base + extra);
}
function getCost(pr) { return Math.ceil(pr.baseCost * Math.pow(1.15, pr.owned) * getResearchMults().cost * getCodexCostMult()); }
function getPrestigeCostScale() { return Math.pow(1.6, state.prestigeCount); }
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
    return (base * biome.prodMult * getPrestigeMult() * rm.prod * am.prod * getEventGlobal() * getCodexProdMult() * getCodexBiomeMult() + getSymbiosisSps()) * getResonanceMult();
}
function getResonanceMult() { return Date.now() < _resonanceUntil ? 1.75 : 1; }
function getClickValue() {
    const biome = BIOMES[state.biomeIdx], rm = getResearchMults(), am = getAchievementMults();
    return state.sporesPerClick * biome.clickMult * getPrestigeMult() * rm.click * am.click;
}
function getPulseMult() { const rm = getResearchMults(), am = getAchievementMults(); return rm.pulse * am.pulse * getCodexPulseMult(); }
function sporulationThreshold() {
    const base = 1000000 * Math.pow(3.5, state.prestigeCount);
    return hasCodex('B3') ? Math.ceil(base * 0.85) : base;
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
        allTimeSporesBase: state.allTimeSporesBase, allTimeClicks: state.allTimeClicks, clicksThisPrestige: state.clicksThisPrestige, revisitedBiome: state.revisitedBiome,
        essence: state.essence, codexPurchased: [...state.codexPurchased],
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
        'allTimeSporesBase', 'allTimeClicks', 'clicksThisPrestige', 'revisitedBiome', 'essence'
    ].forEach(k => { if (sv[k] !== undefined) state[k] = sv[k]; });
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
                // Update leaderboard entry alongside game save
                db.collection('leaderboard').doc(currentUser.uid).set({
                    username: currentUser.displayName || currentUsername || 'Unknown',
                    allTimeSpores: allTimeTotal,
                    prestigeCount: state.prestigeCount,
                    lastSaved: firebase.firestore.FieldValue.serverTimestamp(),
                }).then(() => {
                    _lbCache = null; _lbFetchedAt = 0; lastStatsKey = null;
                }).catch(() => { });
            })
            .catch(() => { document.getElementById('save-info').textContent = 'Saved locally ' + new Date().toLocaleTimeString(); });
    } else {
        document.getElementById('save-info').textContent = 'Saved ' + new Date().toLocaleTimeString();
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
            state = defaultState();
            applyGameData(cloudData);
            invalidateMults();
            lastUpgradeKey = null; lastOwnedKey = null; lastSymKey = null; lastResearchKey = null; lastAchKey = null; lastCodexKey = null; lastStatsKey = null; _lastBiomeIdx = -1; _openPanel = null; _lastBondAlertKey = ""; _lastEssenceKey = "";
            branches = []; lastTotal = -1;
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
    lastUpgradeKey = null; lastOwnedKey = null; lastSymKey = null; lastResearchKey = null; lastAchKey = null; lastCodexKey = null; lastStatsKey = null; _lastBiomeIdx = -1; _openPanel = null; _lastBondAlertKey = ""; _lastEssenceKey = "";
    branches = []; lastTotal = -1;
    closeProfileModal();
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
//  SETTINGS MODAL
// ═══════════════════════════════════════
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
    const modeRow = document.getElementById('settings-event-mode-row');
    modeRow.style.display = state.settings.eventsEnabled ? 'flex' : 'none';
    document.getElementById('seg-colony').classList.toggle('active', !state.settings.disasterMode);
    document.getElementById('seg-disaster').classList.toggle('active', state.settings.disasterMode);
}


function toggleSporulatePanel() {
    state.showSporulatePanel = !state.showSporulatePanel;
    if (!state.showSporulatePanel) state.pendingBiomeChoice = null;
    updateSporulateUI();
}
function selectBiomeChoice(idx) { state.pendingBiomeChoice = idx; updateSporulateUI(); }
function doSporulate() {
    const nextIdx = (hasCodex('B5') && state.pendingBiomeChoice !== null)
        ? state.pendingBiomeChoice
        : (state.biomeIdx + 1) % BIOMES.length;
    const visited = [...state.biomesVisited];
    const isRevisit = visited.includes(BIOMES[nextIdx].id);
    if (!visited.includes(BIOMES[nextIdx].id)) visited.push(BIOMES[nextIdx].id);
    // Save bond state before reset for A3 (Bond Memory)
    const prevSymbiosis = hasCodex('A3') ? state.symbiosis.map(s => ({ ...s })) : null;
    const essenceEarned = calcEssenceEarned();
    const meta = {
        prestigeCount: state.prestigeCount + 1, biomeIdx: nextIdx, biomesVisited: visited,
        achievementsUnlocked: [...state.achievementsUnlocked], allTimePulses: state.allTimePulses,
        winterSurvived: state.winterSurvived, settings: { ...state.settings }, showSporulatePanel: false,
        allTimeSporesBase: state.allTimeSporesBase + state.totalEarned, allTimeClicks: state.allTimeClicks,
        revisitedBiome: state.revisitedBiome || isRevisit,
        essence: state.essence + essenceEarned, codexPurchased: [...state.codexPurchased],
    };
    state = { ...defaultRunState(), ...meta }; invalidateMults(); _lastBiomeIdx = -1; _openPanel = null; _lastBondAlertKey = ""; _lastEssenceKey = '';
    // Apply run-start codex bonuses
    if (hasCodex('R1')) { const t = p(state, 'threads'); if (t) t.owned += 3; }
    if (hasCodex('P1')) state.hivemindUnlocked = true;
    if (hasCodex('A4')) { const cheapest = RESEARCH_DEF.filter(r => r.tier === 1).reduce((a, b) => a.cost < b.cost ? a : b); const sr = state.research.find(r => r.id === cheapest.id); if (sr && !sr.bought) { sr.bought = true; invalidateMults(); } }
    if (prevSymbiosis) { prevSymbiosis.forEach((ps, i) => { if (ps.active && !ps.broken) { state.symbiosis[i].active = true; state.symbiosis[i].feedTimer = 0; state.symbiosis[i].hungry = false; state.symbiosis[i].broken = false; } }); }
    // Reset hidden achievement trackers for the new run
    _clickTs = []; _hivemindZeroAt = Date.now(); _lastClickAt = Date.now(); _recentPulseTs = []; _runStartAt = Date.now();
    _pulseCombo = 0; _comboExpiresAt = 0; _resonanceUntil = 0;
    lastUpgradeKey = null; lastOwnedKey = null; lastSymKey = null; lastResearchKey = null; lastAchKey = null; lastCodexKey = null; lastStatsKey = null;
    branches = []; lastTotal = -1; bootUI(); screenShake();
    tick('🧬 Sporulated! +' + essenceEarned + ' Essence. ' + BIOMES[state.biomeIdx].emoji + ' ' + BIOMES[state.biomeIdx].name + '. Legacy: ' + getPrestigeMult().toFixed(1) + '×', true);
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
            grid.innerHTML = BIOMES.map((b, i) => {
                const sel = i === state.pendingBiomeChoice ? ' selected' : '';
                return `<button class="spor-biome-btn${sel}" type="button" onclick="selectBiomeChoice(${i})"><span class="spor-biome-btn-emoji">${b.emoji}</span><span class="spor-biome-btn-name">${b.name.split(' ')[0]}</span></button>`;
            }).join('');
        } else {
            picker.style.display = 'none';
        }
    }
}

// ═══════════════════════════════════════
//  STATUS STRIP (season · event · bonds)
// ═══════════════════════════════════════
let _openPanel = null;
function toggleStatusPanel(id) {
    const panels = ['season', 'event', 'bond'];
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
    // If events are disabled, clear any active event and go dormant
    if (!state.settings.eventsEnabled) {
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
    const key = state.research.map(r => r.bought ? '1' : '0').join('') + '|' + state.prestigeCount;
    if (key === lastResearchKey) return; lastResearchKey = key;
    const c = document.getElementById('tab-research'); c.innerHTML = '';
    const scale = getPrestigeCostScale();
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
function updateResearch() { const scale = getPrestigeCostScale(); document.querySelectorAll('#tab-research .rn-btn').forEach(btn => { const scaledCost = Number(btn.dataset.rcost); btn.disabled = state.spores < scaledCost; }); }
function buyResearch(id) {
    const def = RESEARCH_DEF.find(d => d.id === id), sr = state.research.find(r => r.id === id);
    const scaledCost = Math.ceil(def.cost * getPrestigeCostScale());
    if (!def || sr.bought || state.spores < scaledCost) return;
    state.spores -= scaledCost; sr.bought = true; invalidateMults(); lastResearchKey = null;
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
    const qty = buyQty === 'max' ? maxAffordable(pr) : buyQty;
    if (qty === 0) return;
    // For fixed quantities, verify the full cost is affordable before buying anything
    if (buyQty !== 'max') {
        let o = pr.owned, total = 0;
        for (let i = 0; i < qty; i++) total += Math.ceil(pr.baseCost * Math.pow(1.15, o++) * getResearchMults().cost);
        if (state.spores < total) return;
    }
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
    const visible = UPGRADES_DEF.filter(u => { const su = state.upgrades.find(x => x.id === u.id); return !su?.bought && u.req(state); });
    const key = visible.map(u => u.id).join(',') || '__empty__';
    if (key === lastUpgradeKey) return; lastUpgradeKey = key;
    const c = document.getElementById('upgrades-available-list'); c.innerHTML = '';
    if (!visible.length) { c.innerHTML = '<div style="padding:1rem;font-size:12px;color:#4a7a55;font-style:italic">Keep growing to unlock upgrades...</div>'; updateUpgradeTabBadge(false); return; }
    visible.forEach(u => {
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'item disabled'; btn.dataset.id = u.id;
        const badgeClass = u.biome ? 'badge biome-badge' : 'badge';
        btn.innerHTML = `<div class="item-top"><span class="item-name">✦ ${u.name}<span class="${badgeClass}">${TIER_LABELS[u.tier] || ''}</span></span><span class="item-cost" data-cost></span></div><div class="item-desc">${u.desc}</div>`;
        btn.addEventListener('click', () => buyUpgrade(u.id)); c.appendChild(btn);
    });
    updateUpgradeTabBadge(true);
}
function updateUpgradeTabBadge(hasUpgrades) {
    document.getElementById('tab-btn-upgrades').classList.toggle('has-upgrades', hasUpgrades);
}
function updateUpgrades() {
    const scale = getPrestigeCostScale();
    document.querySelectorAll('#upgrades-available-list [data-id]').forEach(btn => { const u = UPGRADES_DEF.find(x => x.id === btn.dataset.id); if (!u) return; const scaledCost = Math.ceil(u.cost * scale); const can = state.spores >= scaledCost; btn.classList.toggle('disabled', !can); btn.classList.toggle('can-afford', can); btn.querySelector('[data-cost]').textContent = fmt(scaledCost) + ' sp'; });
}
function buyUpgrade(id) {
    const uDef = UPGRADES_DEF.find(x => x.id === id);
    if (!uDef) return;
    let su = state.upgrades.find(x => x.id === id);
    if (!su) { su = { id, bought: false }; state.upgrades.push(su); }
    const scaledCost = Math.ceil(uDef.cost * getPrestigeCostScale());
    if (su.bought || state.spores < scaledCost) return;
    state.spores -= scaledCost; su.bought = true; uDef.apply(state);
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
    SYMBIONTS.forEach((def, i) => { const card = document.createElement('div'); card.className = 'sym-card'; card.innerHTML = `<div class="sym-top"><span class="sym-name">${def.emoji} ${def.name}</span><span class="sym-status-badge locked" data-sym-status="${def.id}">Locked</span></div><div class="sym-desc">${def.desc}</div><div class="sym-stats">+${fmt(def.bonusSps)}/s &nbsp;·&nbsp; Feed ${fmt(def.feedCost)} sp every ${def.feedEvery}s &nbsp;·&nbsp; Pact: ${fmt(def.pactCost)} sp</div><div data-sym-actions="${def.id}"></div><div class="sym-feed-track" data-sym-track="${def.id}" style="display:none"><div class="sym-feed-fill" data-sym-fill="${def.id}"></div></div>`; c.appendChild(card); });
}
function updateSymbiosis() {
    const key = symKey(), rebuild = key !== lastSymKey; lastSymKey = key;
    SYMBIONTS.forEach((def, i) => { const sym = state.symbiosis[i], unlocked = state.totalEarned >= def.unlockAt; const statusEl = document.querySelector(`[data-sym-status="${def.id}"]`); const actionsEl = document.querySelector(`[data-sym-actions="${def.id}"]`); const trackEl = document.querySelector(`[data-sym-track="${def.id}"]`); const fillEl = document.querySelector(`[data-sym-fill="${def.id}"]`); if (!statusEl) return; let sc = 'locked', st = 'Locked'; if (unlocked && !sym.active && !sym.broken) { sc = 'available'; st = 'Available'; } else if (sym.active && !sym.hungry) { sc = 'active'; st = 'Active'; } else if (sym.hungry) { sc = 'hungry'; st = 'Hungry!'; } else if (sym.broken) { sc = 'broken'; st = 'Bond Broken'; } statusEl.className = 'sym-status-badge ' + sc; statusEl.textContent = st; if (rebuild) { actionsEl.innerHTML = ''; if (unlocked && !sym.active && !sym.broken) { const btn = document.createElement('button'); btn.className = 'sym-btn pact'; btn.type = 'button'; btn.textContent = `Form Pact (${fmt(def.pactCost)} sp)`; btn.disabled = state.spores < def.pactCost; btn.addEventListener('click', () => formPact(i)); actionsEl.appendChild(btn); } else if (sym.hungry) { const btn = document.createElement('button'); btn.className = 'sym-btn feed'; btn.type = 'button'; btn.textContent = `Feed (${fmt(def.feedCost)} sp)`; btn.disabled = state.spores < def.feedCost; btn.addEventListener('click', () => feedSymbiont(i)); actionsEl.appendChild(btn); } else if (sym.broken && unlocked) { const btn = document.createElement('button'); btn.className = 'sym-btn restore'; btn.type = 'button'; btn.textContent = `Restore Pact (${fmt(def.pactCost)} sp)`; btn.disabled = state.spores < def.pactCost; btn.addEventListener('click', () => formPact(i)); actionsEl.appendChild(btn); } } else { const btn = actionsEl.querySelector('button'); if (btn) btn.disabled = state.spores < (sym.hungry ? def.feedCost : def.pactCost); } if (sym.active) { trackEl.style.display = 'block'; const pct = Math.min(100, (sym.feedTimer / def.feedEvery) * 100); fillEl.style.width = pct + '%'; fillEl.style.background = sym.hungry ? '#EF9F27' : '#5DCAA5'; } else trackEl.style.display = 'none'; });
    updateBondTabBadge();
}
function tickSymbiosis(dt) {
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
function formPact(i) { const def = SYMBIONTS[i], sym = state.symbiosis[i]; if (state.spores < def.pactCost) return; state.spores -= def.pactCost; sym.active = true; sym.hungry = false; sym.feedTimer = 0; sym.broken = false; lastSymKey = null; updateSymbiosis(); updateStats(); }
function feedSymbiont(i) { const def = SYMBIONTS[i], sym = state.symbiosis[i]; if (!sym.hungry || state.spores < def.feedCost) return; state.spores -= def.feedCost; sym.hungry = false; sym.feedTimer = 0; lastSymKey = null; updateSymbiosis(); updateStats(); }

function updateBondTabBadge() {
    const hasAlert = state.symbiosis.some(sym => sym.hungry || sym.broken);
    document.getElementById('tab-btn-bonds').classList.toggle('has-alert', hasAlert);
}

let _lastBondAlertKey = '';
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
    const now = Date.now();
    // Check Overclock before resetting hivemind
    if (now - _hivemindZeroAt <= 30000) tryUnlockHidden('h2');
    // Mind Meld: 3 pulses within 2 minutes
    _recentPulseTs = _recentPulseTs.filter(t => now - t < 120000); _recentPulseTs.push(now);
    if (_recentPulseTs.length >= 3) tryUnlockHidden('h8');
    // Combo streak — 90s window between pulses
    if (now < _comboExpiresAt) {
        _pulseCombo++;
    } else {
        _pulseCombo = 0;
    }
    _comboExpiresAt = now + 90000;
    // P5: recharge bar to 20% after firing instead of 0
    state.hivemind = hasCodex('P5') ? 20 : 0;
    _hivemindZeroAt = now;
    state.allTimePulses++;
    const base = Math.ceil((getSps() * 30 + getClickValue() * 50) * getPulseMult());
    // P4: flat bonus equal to 10 seconds of SPS on top of the pulse
    const flat = hasCodex('P4') ? Math.ceil(getSps() * 10) : 0;
    // Combo multiplier: 1× / 1.15× / 1.30× / 1.50× (caps at combo 3)
    const comboMult = _pulseCombo === 0 ? 1 : _pulseCombo === 1 ? 1.15 : _pulseCombo === 2 ? 1.30 : 1.50;
    const bonus = Math.ceil((base + flat) * comboMult);
    state.spores += bonus; state.totalEarned += bonus;
    if (navigator.vibrate) navigator.vibrate([8, 60, 18]);
    // Resonance at combo 3+
    const resonanceTriggered = _pulseCombo >= 2 && _resonanceUntil < now;
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
            streakEl.textContent = `🔥 ×${_pulseCombo + 1} Streak — keep pulsing!`;
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

    // Save leaderboard nodes before clearing so they don't flicker on rebuild
    const savedLbHdr = document.getElementById('lb-hdr');
    const savedLbWrap = document.getElementById('lb-wrap');
    if (savedLbHdr) savedLbHdr.remove();
    if (savedLbWrap) savedLbWrap.remove();

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

    // ── Leaderboard — reuse saved nodes if available, otherwise create fresh ──
    if (savedLbHdr && savedLbWrap) {
        c.appendChild(savedLbHdr);
        c.appendChild(savedLbWrap);
        // Only re-fetch if auth state changed (wrap already has content)
        if (currentUser && db && FIREBASE_CONFIGURED) fetchLeaderboard(savedLbWrap);
    } else {
        const lbHdr = document.createElement('div');
        lbHdr.className = 'stats-section-hdr';
        lbHdr.id = 'lb-hdr';
        lbHdr.textContent = '🏅 Leaderboard';
        c.appendChild(lbHdr);
        const lbWrap = document.createElement('div');
        lbWrap.className = 'lb-wrap';
        lbWrap.id = 'lb-wrap';
        c.appendChild(lbWrap);
        if (currentUser && db && FIREBASE_CONFIGURED) {
            fetchLeaderboard(lbWrap);
        } else {
            lbWrap.innerHTML = '<div class="lb-signin-msg">🔒 Sign in to view the global leaderboard and compete with other players.</div>';
        }
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
function switchTab(tab) { ALL_TABS.forEach(t => { document.getElementById('tab-btn-' + t).classList.toggle('active', t === tab); document.getElementById('tab-' + t).classList.toggle('active', t === tab); }); document.getElementById('tab-heading-text').textContent = TAB_LABELS[tab] || tab; }

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
    updateSymbiosis(); updateSporulateUI(); updateBondAlert();
    checkAchievements(); buildGoals();
    buildCodex(); buildResearch(); updateResearch();
    updateBiomePath(); buildStats(); buildEssence();
}, 50);
setInterval(() => { if (++msgTimer % 8 === 0 && !state.activeEvent) showMessage(); checkTutorial(); }, 1000);
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
    const maxOffline = hasCodex('R3') ? 12 * 3600 : 8 * 3600;
    const elapsed = Math.min((Date.now() - state.lastSeen) / 1000, maxOffline);
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
    const gain = getClickValue(); state.spores += gain; state.totalEarned += gain; state.allTimeClicks++; state.clicksThisPrestige++;
    // Hidden achievement tracking
    const now = Date.now();
    _lastClickAt = now;
    _clickTs = _clickTs.filter(t => now - t < 10000); _clickTs.push(now);
    if (_clickTs.length >= 50) tryUnlockHidden('h1');
    if (state.hivemindUnlocked) { state.hivemind = Math.min(100, state.hivemind + (hasCodex('P2') ? 0.65 : 0.5)); if (state.hivemind >= 100) triggerPulse(); }
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
document.getElementById('p-reset-btn').addEventListener('click', resetGame);
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
        try { localStorage.setItem('myceliumEmpireV9', JSON.stringify(buildSaveData())); } catch (e) { }
        lastUpgradeKey = null; lastOwnedKey = null; lastSymKey = null; lastResearchKey = null;
        lastAchKey = null; lastCodexKey = null; lastStatsKey = null;
        _lastBiomeIdx = -1; _openPanel = null; _lastBondAlertKey = ''; _lastEssenceKey = '';
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

    positionTutorialCard(target, def.prefer);
}

function positionTutorialCard(target, prefer) {
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

function bootUI() {
    buildProducers(); buildSymbiosis(); buildOwned(); buildGoals(); buildCodex();
    updateStats(); updateProducers(); buildUpgrades(); updateUpgrades();
    updateSymbiosis(); updateSeasonBar(); updateBiomePath(); updateSporulateUI(); updateBondAlert();
    updateSettingsUI();
    buildResearch(); updateResearch(); buildStats(); buildEssence();
    if (state.totalEarned > 0) showMessage();
}

initFirebase();
loadGame();
bootUI();
initTutorial();
applyOfflineProgress();
requestAnimationFrame(animateMycelium);