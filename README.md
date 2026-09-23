# SkillType — Type Fast. Aim Higher.

> A premium space-arcade browser typing shooter inspired by [ZType](https://zty.pe/).
> Built with **React**, **TypeScript**, **Vite**, **HTML5 Canvas**, and the **Web Audio API**.

---

## 🚀 Overview

**SkillType** transforms typing practice into a high-stakes, neon-lit space arcade dogfight. Enemy starships descend from the cosmos with words attached to their hulls. The player's ship sits near the bottom center, locking its targeting cannons and firing precision plasma bolts with every correct keystroke to annihilate enemies before they breach the planetary defense line.

- **Tagline**: *Type Fast. Aim Higher.*
- **Credit**: *A typing experience by Skillence Academy*
- **Favicon**: Original high-contrast vector starfighter SVG.
- **100% Self-Contained**: Zero external API dependencies, tracking scripts, or remotely hosted assets.

---

## 🛠️ Technology Stack & Architecture

```
d:/typing game/
├── src/
│   ├── audio/
│   │   └── SoundEngine.ts         # Procedural Web Audio API synthesizer
│   ├── components/
│   │   ├── Header.tsx             # Brand logo, audio mute, pause controls
│   │   ├── Footer.tsx             # Skillence Academy footer credit
│   │   ├── MainMenu.tsx           # Play Arcade, Practice, Records, Difficulty selector
│   │   ├── GameplayHUD.tsx        # Real-time score, wave, shields, combo meter, WPM, pulses
│   │   ├── HowToPlayModal.tsx     # Combat demonstration and enemy classifications
│   │   ├── PauseOverlay.tsx       # Pause menu with 3-second animated resume countdown
│   │   ├── ResultsModal.tsx       # Debrief screen, personal bests, mistyped keys chart
│   │   ├── PracticeSetupModal.tsx # Vocabulary categories, custom words paste & validation
│   │   ├── RecordsModal.tsx       # Saved personal bests & recent 50 sessions table
│   │   ├── SettingsModal.tsx      # SFX volume, music volume, mute, reduced-motion toggle
│   │   ├── ConfirmationModal.tsx  # Safety dialog for restarts and clearing records
│   │   └── MobileInputHelper.tsx  # Accessible virtual typing sync for mobile touchscreens
│   ├── data/
│   │   └── wordLists.ts           # Dictionaries (Common, Tech, HTML/CSS, Business, Custom)
│   ├── game/
│   │   ├── types.ts               # Core data models and game state interfaces
│   │   ├── TargetingSystem.ts     # Target lock, closest-enemy distance resolver, typing engine
│   │   ├── EnemyManager.ts        # Scout, Fighter, Heavy vector graphics, sway, bounds
│   │   ├── WaveManager.ts         # Wave progression, enemy scheduling, victory transitions
│   │   ├── ParticleSystem.ts      # Pooled sparks, debris, shockwaves, EMP pulse
│   │   ├── Starfield.ts           # 3-layer parallax starfield & perspective horizon grid
│   │   └── GameEngine.ts          # Master requestAnimationFrame loop with delta-time physics
│   ├── utils/
│   │   └── storage.ts             # Safe localStorage persistence with corruption recovery
│   ├── __tests__/
│   │   ├── targeting.test.ts      # Duplicate first letter resolution & targeting lifecycle
│   │   ├── scoring.test.ts        # Multipliers (x1-x4), accuracy %, and live WPM formulas
│   │   └── storageAndWords.test.ts# Custom word normalization & corrupted storage recovery
│   ├── App.tsx                    # Top-level React orchestration
│   ├── main.tsx                   # DOM mount
│   └── index.css                  # Retro-futuristic cyberpunk space styling
```

---

## 🎮 Gameplay & Mechanics

### 1. Targeting & Typing
- **Target Lock**: Typing the first letter of an enemy locks your spaceship onto that target.
- **Duplicate Letter Resolution**: When multiple descending enemies share the same starting letter, the engine automatically selects the one closest to the player ship (`min Euclidean distance`).
- **Zero-Latency Scoring**: Keystrokes instantly register points and advance the word, accompanied by immediate plasma laser bolts.
- **Mistype Feedback**: Incorrect keystrokes do not advance the word, reset the combo multiplier, emit an error sound, and log the expected key for post-game analytics.
- **Word Completion**: Disintegrates the enemy in a blast of sparks, awarding points and bonus multiplier progression.

### 2. Fleet Classifications
1. **Scout Drone**:
   - Short words (3–4 letters).
   - Fast, straight descent.
   - Low durability, sleek cyan dart design.
2. **Winged Fighter**:
   - Medium words (5–7 letters).
   - Sinusoidal lateral swaying flight path.
   - Introduced in Wave 2+ with purple accents.
3. **Heavy Dreadnought**:
   - Long words (8+ letters).
   - Slower descent, massive hexagonal armor, and rotating energy shield ring.
   - High score value, introduced in Wave 4+.

### 3. Shields & Emergency Pulse
- **3 Planetary Shields**: Every enemy that crosses the bottom red danger line costs 1 shield and triggers an emergency alarm. Losing all 3 shields ends the mission.
- **3 Emergency Pulses (EMP)**: Press **[SPACE]** or tap the pulse button to unleash an expanding cyan EMP shockwave that vaporizes all active enemies. Awards 0 typing points and resets the combo.

### 4. Combo Multiplier Progression
- **x1**: Initial state (0–4 consecutive clean words).
- **x2**: 5 clean words without errors.
- **x3**: 10 clean words.
- **x4**: 20+ clean words.
- Multiplier resets to x1 upon any mistyped letter, lost shield, or emergency pulse.

---

## 🔊 Procedural Web Audio Synthesis

All sound effects and ambient atmospheric drones are synthesized in real-time via the **Web Audio API** (`SoundEngine.ts`):
- **Keystroke Hit**: 1.1kHz triangle click blip with rapid exponential decay.
- **Laser Fire**: Sweeping FM pitch envelope (950Hz → 220Hz in 70ms).
- **Incorrect Key**: Low 120Hz sawtooth buzzer with resonant low-pass filter.
- **Enemy Explosion**: Band-pass filtered white noise burst + 35Hz sub-bass thump.
- **Wave Fanfare**: Ascending 4-note arpeggio chord (C5 - E5 - G5 - C6).
- **Shield Breach**: Dissonant dual-tone alarm klaxon.
- **Emergency Pulse**: Resonant low-frequency sweep (180Hz → 25Hz) + expansive noise whoosh.
- **Ambient Drone**: Atmospheric dual-oscillator space hum with subtle LFO modulation.

---

## 🏃 Getting Started

### Prerequisites
- Node.js (v18+ or v20+ LTS recommended)
- npm (v9+)

### Installation
```bash
# Clone or navigate to the workspace directory
cd "d:/typing game"

# Install dependencies
npm install
```

### Development Server
```bash
# Start local development server with hot module replacement (HMR)
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

### Automated Testing
```bash
# Run Vitest unit test suite (Targeting, Scoring, WPM, Storage Recovery)
npm test
```

### Production Build
```bash
# Typecheck and build optimized static assets
npm run build

# Preview production build locally
npm run preview
```

---

## 📱 Mobile & Accessibility Support
- **Responsive Layout**: Fluidly scales from ultra-wide monitors down to compact mobile screens.
- **Tap-to-Type**: Integrated virtual input field enables mobile software keyboards without ghost double-typing events.
- **Auto-Pause**: Automatically pauses gameplay if the browser tab loses visibility or the window blurs.
- **Reduced Motion**: Setting disables canvas screen shake, reduces particle density, and calms starfield parallax.
