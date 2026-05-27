  # Easter Eggs System — Kronos

## Context
Add a hidden easter egg system where every egg requires the user to physically find something in the 3D world and click it (or perform a deliberate action). No passive waiting timers. Users earn +1000 credits per egg found and track progress in a new "Eggs" tab on the WalletUI panel — hints visible, no spoilers, found eggs marked "FOUND".

---

## The 14 Easter Eggs — Find It & Click It

| # | Name | What the user does |
|---|------|--------------------|
| 1 | **Seven Glances** | Click the black hole 7 times — but each click must land within 2s of the last. Too slow → counter resets |
| 2 | **The Singularity** | Zoom deep into the black hole and click the tiny hidden invisible sphere at its dead center |
| 3 | **The Old Code** | Type ↑↑↓↓←→←→BA anywhere on the scene |
| 4 | **The Golden Eye** | One eye (index 17) has a gold pupil instead of red. Fly out to 15,000 units, find it, click its glow |
| 5 | **The Pupil** | Click the red glow (iris) of ANY of the 50 eyes — not the white sclera. Requires precision |
| 6 | **Five Sentinels** | Five specific eyes (indices 0, 10, 20, 30, 40) have a faint ring. Click all five (any order) |
| 7 | **The Inscription** | On the +Z cube wall, one word in the tiled warning text glows yellow. Fly there and click it |
| 8 | **You Were Warned** | Physically fly the camera through a cube wall face (any axis > 24,800 units). Enter the void |
| 9 | **Sunspot** | A dark spot slowly orbits the Sun's equator. Click it |
| 10 | **The Grand Tour** | Physically fly the camera within 300 units of each planet in order Mercury → Neptune |
| 11 | **The Lost Probe** | A tiny glowing teal artifact is hidden at a specific coordinate in the outer solar system. Find and click it |
| 12 | **The Anomaly** | Three stars in the starfield glow faint blue instead of white. Click all three |
| 13 | **Echo** | Find the hidden user "echo" via the transfer search bar. Send any amount to them |
| 14 | **The Fibonacci Gate** | Five small golden orbs orbit along Saturn's ring plane. Navigate to Saturn and click all five |

**Hints shown in UI (no spoilers):**
1. "The singularity rewards those who dare stare seven times — without pause"
2. "There is something at the very heart of darkness, beyond what you can see"
3. "Warriors of a forgotten era knew a sacred sequence of directions"
4. "Among fifty watchers, one sees the world in a different light"
5. "Not all parts of an eye are equal. The center holds more than the rest"
6. "Five sentinels guard the outer boundary. Each one must acknowledge you"
7. "Among thousands of warnings to run, one word says something different"
8. "The text says to run. What happens if you don't?"
9. "The star at the center of everything carries a mark that never stays still"
10. "The planets reward those who visit them personally, in the order they were born"
11. "Something was sent into the void long ago and never returned. It is still out there"
12. "Not every star is what it seems. Three shine a different color"
13. "Somewhere in the network there is an account that listens to everything you send"
14. "Saturn's rings hide five points that follow a pattern as old as mathematics"

---

## Backend Changes

### 1. New SQL Tables — `backend/internal/db/schema_enhanced.sql`

```sql
CREATE TABLE IF NOT EXISTS easter_eggs (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    hint TEXT NOT NULL,
    reward_amount DECIMAL(20,8) DEFAULT 1000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_easter_eggs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    egg_id VARCHAR(50) NOT NULL REFERENCES easter_eggs(id),
    found_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, egg_id)
);
CREATE INDEX IF NOT EXISTS idx_user_easter_eggs_user_id ON user_easter_eggs(user_id);

-- Seed all 14 eggs
INSERT INTO easter_eggs (id, name, hint) VALUES
  ('seven_glances',    'Seven Glances',    'The singularity rewards those who dare stare seven times — without pause'),
  ('the_singularity',  'The Singularity',  'There is something at the very heart of darkness, beyond what you can see'),
  ('the_old_code',     'The Old Code',     'Warriors of a forgotten era knew a sacred sequence of directions'),
  ('the_golden_eye',   'The Golden Eye',   'Among fifty watchers, one sees the world in a different light'),
  ('the_pupil',        'The Pupil',        'Not all parts of an eye are equal. The center holds more than the rest'),
  ('five_sentinels',   'Five Sentinels',   'Five sentinels guard the outer boundary. Each one must acknowledge you'),
  ('the_inscription',  'The Inscription',  'Among thousands of warnings to run, one word says something different'),
  ('you_were_warned',  'You Were Warned',  'The text says to run. What happens if you don''t?'),
  ('sunspot',          'Sunspot',          'The star at the center of everything carries a mark that never stays still'),
  ('the_grand_tour',   'The Grand Tour',   'The planets reward those who visit them personally, in the order they were born'),
  ('the_lost_probe',   'The Lost Probe',   'Something was sent into the void long ago and never returned. It is still out there'),
  ('the_anomaly',      'The Anomaly',      'Not every star is what it seems. Three shine a different color'),
  ('echo',             'Echo',             'Somewhere in the network there is an account that listens to everything you send'),
  ('fibonacci_gate',   'The Fibonacci Gate','Saturn''s rings hide five points that follow a pattern as old as mathematics')
ON CONFLICT (id) DO NOTHING;

-- Seed the hidden "echo" user (password: irrelevant, never used to login)
-- Done in Go seed logic, not raw SQL, so bcrypt is handled properly
```

### 2. Stored Procedure — `backend/internal/db/procedures.sql` (same as before)

`sp_award_easter_egg(p_user_id UUID, p_egg_id VARCHAR)` → idempotent, credits highest-balance wallet, logs to `user_activities`. Unchanged from previous plan.

### 3. New Go Model — `backend/internal/models/easter_egg.go` (NEW FILE)

```go
type EasterEgg struct {
    ID           string     `db:"id"            json:"id"`
    Name         string     `db:"name"          json:"name"`
    Hint         string     `db:"hint"          json:"hint"`
    RewardAmount float64    `db:"reward_amount" json:"reward_amount"`
    Found        bool       `json:"found"`
    FoundAt      *time.Time `json:"found_at,omitempty"`
}
```

### 4. New Repository — `backend/internal/repository/easter_egg_repository.go` (NEW FILE)

Same pattern as `transaction_repository.go`:
```go
type EasterEggRepository interface {
    GetAllEggsForUser(ctx context.Context, userID uuid.UUID) ([]models.EasterEgg, error)
    AwardEgg(ctx context.Context, userID uuid.UUID, eggID string) (bool, error)
}
```
- `GetAllEggsForUser`: LEFT JOIN `easter_eggs` with `user_easter_eggs` on user_id → 14 rows always, `found` bool + `found_at`
- `AwardEgg`: `SELECT sp_award_easter_egg($1, $2)`, returns bool

### 5. New Handlers — `backend/internal/transport/easter_egg_handlers.go` (NEW FILE)

**GET /api/user/me/easter-eggs** (protected)
→ `{eggs: [...], found_count: N, total: 14}`

**POST /api/easter-egg/claim** (protected)
→ Request: `{egg_id: "..."}`  
→ `{success: true, reward: 1000}` or `{success: false, message: "Already found"}`

### 6. Server-Side Auto-Award — only "Echo"

In `TransferHandler` (`handlers.go`), after the transfer is initiated:
```go
// Only server-side egg: if sending to "echo", award the egg
if receiver.Username == "echo" {
    go easterEggRepo.AwardEgg(context.Background(), senderID, "echo")
}
```

No other server-side auto-awards — everything else is click-based and claimed via POST /api/easter-egg/claim.

### 7. Seed "Echo" User — `backend/internal/repository/seed.go` (existing file)

Add to the existing seed logic:
```go
// Seed the "echo" hidden user if not exists
echoUser := &models.User{Username: "echo", HomePlanet: "void", PasswordHash: bcrypt("kronos_echo_internal")}
userRepo.CreateUserIfNotExists(ctx, echoUser)
// Give echo a wallet so transfers don't fail
walletRepo.CreateWalletIfNotExists(ctx, echoUserID, "EARTH", 0)
```

### 8. Route Registration — `backend/cmd/api/main.go`

```go
easterEggRepository := repository.NewEasterEggRepository(db)
protected.GET("/user/me/easter-eggs", transport.GetEasterEggsHandler(easterEggRepository))
protected.POST("/easter-egg/claim",   transport.ClaimEasterEggHandler(easterEggRepository))
// TransferHandler gains easterEggRepository param for echo check
```

---

## Frontend Changes

### 9. New Service — `kronos/src/services/EasterEggManager.js` (NEW FILE)

Singleton (same pattern as `WebSocketManager.js`). Manages all click-based egg state:

```js
class EasterEggManager {
  static getInstance() { /* singleton */ }

  // Egg #1 — Seven Glances (timed click streak)
  bhClickCount = 0
  bhLastClickTime = 0
  recordBlackHoleClick() {
    const now = Date.now()
    if (now - this.bhLastClickTime > 2000) this.bhClickCount = 0  // reset if too slow
    this.bhClickCount++
    this.bhLastClickTime = now
    if (this.bhClickCount === 7) {
      this.claimEgg('seven_glances')
      this.bhClickCount = 0
    }
    return this.bhClickCount  // return so BlackHole.jsx can show the count visually
  }

  // Egg #3 — The Old Code (Konami)
  konamiIndex = 0
  KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']
  recordKeypress(key) {
    this.konamiIndex = key === this.KONAMI[this.konamiIndex] ? this.konamiIndex + 1
                     : (key === this.KONAMI[0] ? 1 : 0)
    if (this.konamiIndex === this.KONAMI.length) {
      this.claimEgg('the_old_code')
      this.konamiIndex = 0
    }
  }

  // Egg #6 — Five Sentinels
  clickedSentinels = new Set()
  recordSentinelClick(sentinelId) {
    this.clickedSentinels.add(sentinelId)
    if (this.clickedSentinels.size === 5) this.claimEgg('five_sentinels')
  }

  // Egg #10 — The Grand Tour
  tourIndex = 0
  TOUR_ORDER = ['Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune']
  recordPlanetVisit(planetName) {
    if (planetName === this.TOUR_ORDER[this.tourIndex]) {
      this.tourIndex++
      if (this.tourIndex === 8) {
        this.claimEgg('the_grand_tour')
        this.tourIndex = 0
      }
    } else if (planetName === 'Mercury') {
      this.tourIndex = 1  // restart from Mercury
    }
    // wrong planet resets only if it breaks the sequence
  }

  // Egg #12 — The Anomaly (3 blue stars)
  clickedAnomalies = new Set()
  recordAnomalyClick(starId) {
    this.clickedAnomalies.add(starId)
    if (this.clickedAnomalies.size === 3) this.claimEgg('the_anomaly')
  }

  // Egg #14 — Fibonacci Gate (5 Saturn orbs)
  clickedFibOrbs = new Set()
  recordFibOrbClick(orbId) {
    this.clickedFibOrbs.add(orbId)
    if (this.clickedFibOrbs.size === 5) this.claimEgg('fibonacci_gate')
  }

  // Single claim method — all eggs go through here
  async claimEgg(eggId) {
    const token = localStorage.getItem('authToken')
    if (!token) return
    const res = await fetch('http://localhost:8080/api/easter-egg/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ egg_id: eggId }),
    })
    const data = await res.json()
    if (data.success) this.notifySubscribers({ eggId, reward: data.reward })
  }

  subscribers = []
  subscribe(cb) { this.subscribers.push(cb); return () => { this.subscribers = this.subscribers.filter(s => s !== cb) } }
  notifySubscribers(evt) { this.subscribers.forEach(cb => cb(evt)) }
}
```

### 10. Modified — `kronos/src/components/BlackHole.jsx`

**Egg #1 — Seven Glances (timed streak):**
In `triggerDiskEcho`, also call `EasterEggManager.getInstance().recordBlackHoleClick()`. It returns the current streak count (1–6). Show that count as a small glowing number near the event horizon (a `<Html>` element from drei, or a custom shader uniform `uClickCount` fed into the disk shader to pulse a counter number of rings). Resets visually when count drops to 0.

**Egg #2 — The Singularity:**
Add a tiny invisible clickable sphere (radius = 5 units) at `[0,0,0]` relative to the black hole group (dead center of the event horizon). It sits inside the visible event horizon sphere so it can't be seen. Its `onClick` calls `EasterEggManager.getInstance().claimEgg('the_singularity')`.

```jsx
{/* Dead center — invisible, must be clicked through the BH */}
<mesh position={[0, 0, 0]} onClick={() => EasterEggManager.getInstance().claimEgg('the_singularity')}>
  <sphereGeometry args={[5, 8, 8]} />
  <meshBasicMaterial transparent opacity={0} />
</mesh>
```

Hint in UI: "There is something at the very heart of darkness" — the user must realize they can click INTO the black sphere to find something smaller inside it.

### 11. Modified — `kronos/src/components/StarCreditManager.jsx`

**Egg #4 — The Golden Eye:**
In `createSingleEye`, when `index === 17`, override the pupil and glow materials to gold:
```js
if (index === 17) {
  pupilMaterial.color.set(0xFFD700)
  pupilMaterial.emissive.set(0xFFAA00)
  glowMaterial.color.set(0xFFD700)
  eyeGroup.userData.isGoldenEye = true
}
```

**Egg #5 — The Pupil:**
Raycaster click listener on window, checks against all `eye.glow` meshes. Any hit → `claimEgg('the_pupil')`.

**Egg #6 — Five Sentinels:**
For eyes at indices 0, 10, 20, 30, 40 — add a subtle wireframe ring (TorusGeometry) around the eye group so they're distinguishable. Give each glow mesh `userData.sentinelId = 0..4`. Raycaster click listener checks for `sentinelId` in userData → calls `EasterEggManager.getInstance().recordSentinelClick(id)`.

**Shared raycaster click handler** (one listener on window, covers eggs 4, 5, 6, 11, 14):
```js
window.addEventListener('click', (e) => {
  if (!cameraRef.current) return
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, cameraRef.current)

  // Eyes: glow meshes
  const glowHits = raycaster.intersectObjects(floatingEyesRef.current.map(eye => eye.glow))
  if (glowHits.length > 0) {
    const obj = glowHits[0].object
    if (obj.userData.isGoldenEye) EasterEggManager.getInstance().claimEgg('the_golden_eye')
    else if (obj.userData.sentinelId !== undefined) EasterEggManager.getInstance().recordSentinelClick(obj.userData.sentinelId)
    else EasterEggManager.getInstance().claimEgg('the_pupil')
  }

  // Anomaly: blue stars
  const anomalyHits = raycaster.intersectObjects(anomalyStarsRef.current)
  if (anomalyHits.length > 0) EasterEggManager.getInstance().recordAnomalyClick(anomalyHits[0].object.userData.starId)

  // Lost Probe
  if (lostProbeRef.current) {
    const probeHits = raycaster.intersectObject(lostProbeRef.current)
    if (probeHits.length > 0) EasterEggManager.getInstance().claimEgg('the_lost_probe')
  }
})
```

**Egg #7 — The Inscription:**
In the canvas texture drawing loop (`createStarBackground`), after drawing all tiles, draw ONE instance at a specific (x, y) coordinate in the canvas in bright yellow:
```js
ctx.fillStyle = 'rgba(255, 220, 0, 1.0)'
ctx.fillText("STAY", specificX, specificY)
```
Then add a small invisible clickable plane (PlaneGeometry, size ~400×200) at the world-space coordinates corresponding to that canvas UV on the +Z wall face. Its `onClick` (via the shared raycaster) claims `the_inscription`.
Add this plane to an `inscriptionPlaneRef` so the raycaster can check it.

**Egg #8 — You Were Warned:**
In `useFrame`, after the Neptune distance check:
```js
const maxAxis = Math.max(Math.abs(camera.position.x), Math.abs(camera.position.y), Math.abs(camera.position.z))
if (maxAxis > 24800 && !wallCrossedRef.current) {
  wallCrossedRef.current = true
  EasterEggManager.getInstance().claimEgg('you_were_warned')
}
```

**Egg #11 — The Lost Probe:**
Add a hidden mesh in the scene at `[600, -200, 800]` (asteroid belt zone):
```js
const probeGeometry = new THREE.SphereGeometry(15, 8, 8)
const probeMaterial = new THREE.MeshBasicMaterial({ color: 0x00FFCC })
const probe = new THREE.Mesh(probeGeometry, probeMaterial)
probe.position.set(600, -200, 800)
scene.add(probe)
lostProbeRef.current = probe
// Pulsing glow via PointLight child
const probeLight = new THREE.PointLight(0x00FFCC, 2, 200)
probe.add(probeLight)
```
It's small enough to miss but the glow makes it findable when the camera passes within ~200 units.

**Egg #12 — The Anomaly (3 blue stars):**
Add 3 small sphere meshes (radius 12) at specific positions within the star sphere (e.g., `[3000, 2000, -1500]`, `[-2000, 3500, 1000]`, `[1500, -2500, 3000]`) with blue emissive material:
```js
const anomalyPositions = [ [3000, 2000, -1500], [-2000, 3500, 1000], [1500, -2500, 3000] ]
anomalyStarsRef.current = anomalyPositions.map((pos, i) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x3399FF, transparent: true, opacity: 0.85 })
  )
  mesh.position.set(...pos)
  mesh.userData.starId = i
  scene.add(mesh)
  return mesh
})
```

**Grand Tour detection — `useFrame`:**
Check each planet in `TOUR_ORDER` and see if camera is within 300 units of that planet's stored position:
```js
const TOUR_ORDER = ['Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune']
// Use planetPositionsRef passed via props
const nextPlanet = TOUR_ORDER[tourIndexRef.current]
const nextPos = planetPositions[nextPlanet]
if (nextPos && camera.position.distanceTo(new THREE.Vector3(nextPos.x, nextPos.y, nextPos.z)) < 300) {
  EasterEggManager.getInstance().recordPlanetVisit(nextPlanet)
  tourIndexRef.current++
  if (tourIndexRef.current >= 8) tourIndexRef.current = 0
}
```
`planetPositions` prop is `planetPositionsRef.current` passed down from App.jsx (already wired: `planetPositionsRef` is passed to StarCreditManager via the `TransferModal` props path or added directly).

**Refs needed in StarCreditManager:**
```js
const cameraRef          = useRef(null)
const wallCrossedRef     = useRef(false)
const inscriptionPlaneRef = useRef(null)
const lostProbeRef       = useRef(null)
const anomalyStarsRef    = useRef([])
const tourIndexRef       = useRef(0)
```

### 12. Modified — `kronos/src/components/Sun.jsx`

**Egg #9 — Sunspot:**
Add a small dark sphere that orbits the sun's equator:
```jsx
const [spotAngle, setSpotAngle] = useState(0)
useFrame((_, delta) => {
  setSpotAngle(a => a + delta * 0.15)  // slow orbit
})
const spotX = Math.cos(spotAngle) * 29  // radius 29 (just outside sun surface 28)
const spotZ = Math.sin(spotAngle) * 29

return (
  <>
    {/* existing sun mesh */}
    <mesh position={[spotX, 0, spotZ]}
          onClick={() => EasterEggManager.getInstance().claimEgg('sunspot')}>
      <sphereGeometry args={[4, 8, 8]} />
      <meshBasicMaterial color={0x1a0a00} />
    </mesh>
  </>
)
```

### 13. Modified — `kronos/src/components/Planet.jsx` (Saturn specifically)

**Egg #14 — The Fibonacci Gate:**
For Saturn only, render 5 small golden orb meshes along the ring plane at Fibonacci angular intervals. They orbit with Saturn (same `useFrame` rotation as the planet):

```jsx
const FIB_ANGLES = [0, 1, 3, 6, 11].map(n => (n / 13) * Math.PI * 2)  // Fibonacci-ratio angular steps
const RING_RADIUS = planet.radius * 3.5  // along ring plane

{name === 'Saturn' && FIB_ANGLES.map((angle, i) => (
  <mesh
    key={i}
    position={[Math.cos(angle) * RING_RADIUS, 0, Math.sin(angle) * RING_RADIUS]}
    onClick={() => EasterEggManager.getInstance().recordFibOrbClick(i)}
  >
    <sphereGeometry args={[8, 8, 8]} />
    <meshBasicMaterial color={0xFFD700} />
  </mesh>
))}
```

They rotate with the planet group so they always orbit. Each click is recorded. When all 5 clicked (any order, same session) → "fibonacci_gate" awarded.

### 14. New Component — `kronos/src/components/EasterEggTracker.jsx` (NEW FILE)

Fetches `/api/user/me/easter-eggs` on mount and when a new egg is found (via `EasterEggManager` subscription). Displays:

```
┌─────────────────────────────────────┐
│  🥚 Easter Eggs           4 / 14    │
├─────────────────────────────────────┤
│ ✅  Seven Glances          FOUND    │
│     "The singularity rewards..."    │
│     Found: May 14, 2026            │
│                                     │
│ 🔒  The Singularity                 │
│     "There is something at the..."  │
│ ...                                 │
└─────────────────────────────────────┘
```

### 15. Modified — `kronos/src/components/WalletUI.jsx`

Add "🥚 Eggs" tab button alongside History button. Mutually exclusive toggle:
```jsx
{showHistory && <TransactionHistory />}
{showEggs    && <EasterEggTracker />}
```

### 16. Modified — `kronos/src/App.jsx`

Add Konami key listener in `MainScene` useEffect:
```js
window.addEventListener('keydown', e => EasterEggManager.getInstance().recordKeypress(e.key))
```

Subscribe to `EasterEggManager` for egg-found notifications → push to existing `Notification` component:
```js
EasterEggManager.getInstance().subscribe(({ eggId, reward }) => {
  setNotification({ message: `🥚 Easter Egg Found! +${reward} Credits`, type: 'success' })
})
```

Pass `planetPositionsRef` down to `StarCreditManager` as a new prop `planetPositions` (the ref is already maintained in App.jsx via `handlePlanetPositionUpdate`).

### 17. New CSS — `kronos/src/styles/EasterEggTracker.css` (NEW FILE)

Follows `WalletUI.css` patterns: dark gradient, blue glow border, scrollable list (max-height 320px), `.egg-found` → green left border + badge, `.egg-locked` → dimmed.

---

## Critical Files Summary

**Backend (7 files):**
| File | Change |
|------|--------|
| `backend/internal/db/schema_enhanced.sql` | Add 2 tables + 14-egg seed INSERT |
| `backend/internal/db/procedures.sql` | Add `sp_award_easter_egg` |
| `backend/internal/models/easter_egg.go` | **NEW** — EasterEgg model |
| `backend/internal/repository/easter_egg_repository.go` | **NEW** — Repository |
| `backend/internal/transport/easter_egg_handlers.go` | **NEW** — 2 handlers |
| `backend/internal/transport/handlers.go` | Add Echo check in TransferHandler |
| `backend/internal/repository/seed.go` | Seed "echo" user + wallet |
| `backend/cmd/api/main.go` | Init repo + 2 new routes |

**Frontend (9 files):**
| File | Change |
|------|--------|
| `kronos/src/services/EasterEggManager.js` | **NEW** — Singleton, all egg state |
| `kronos/src/components/EasterEggTracker.jsx` | **NEW** — Profile tab |
| `kronos/src/styles/EasterEggTracker.css` | **NEW** — Styles |
| `kronos/src/components/WalletUI.jsx` | Add 🥚 Eggs tab |
| `kronos/src/components/BlackHole.jsx` | Seven Glances streak + Singularity hidden mesh |
| `kronos/src/components/Sun.jsx` | Sunspot orbiting mesh + onClick |
| `kronos/src/components/Planet.jsx` | Fibonacci Gate orbs on Saturn |
| `kronos/src/components/StarCreditManager.jsx` | Golden Eye + Pupil + Sentinels + Inscription + You Were Warned + Lost Probe + Anomaly stars + Grand Tour |
| `kronos/src/App.jsx` | Konami listener + egg notifications + pass planetPositions to StarCreditManager |

---

## Reused Patterns

- Stored procedure → same as `sp_transfer_funds` in `procedures.sql`
- Repository interface+impl → same as `transaction_repository.go`
- Handler pattern → same as `GetUserTransactionHistoryHandler`
- Singleton service → same as `WebSocketManager.getInstance()`
- Tab toggle state → same as `showHistory`/`setShowHistory` in `WalletUI.jsx`
- Fetch with Bearer token → same as `TransactionHistory.jsx` (lines 32–50)
- Toast notification → existing `Notification.jsx` with `type="success"`
- R3F `useFrame` → same pattern used in all planet/camera components
- Three.js raycaster → standard pattern, camera stored in `cameraRef` on first `useFrame` call

---

## Verification Steps

1. Apply schema migrations → `easter_eggs` has 14 rows, `user_easter_eggs` table exists
2. Seed check: user "echo" exists in users table
3. `GET /api/user/me/easter-eggs` → returns 14 eggs, all `found: false`
4. Click BlackHole 7× within 2s each → `seven_glances` claimed, toast fires
5. Click dead center of BlackHole (innermost sphere) → `the_singularity` claimed
6. Zoom out to ~15,000 units → spot golden-pupiled eye at index 17, click glow → `the_golden_eye`
7. Click the red glow of any eye → `the_pupil`
8. Click all 5 sentinel eyes (wireframe rings) → `five_sentinels`
9. Fly to +Z wall, find yellow "STAY" word, click it → `the_inscription`
10. Fly camera past 24,800 on any axis → `you_were_warned`
11. Click the sunspot as it orbits → `sunspot`
12. Fly within 300 units of Mercury, then Venus, ... Neptune in order → `the_grand_tour`
13. Navigate to `[600, -200, 800]`, find teal probe, click → `the_lost_probe`
14. Find and click 3 blue stars → `the_anomaly`
15. Transfer to "echo" user → `echo` claimed
16. Navigate to Saturn, click all 5 golden orbs → `fibonacci_gate`
17. WalletUI Eggs tab → shows found/locked correctly
18. `POST /api/easter-egg/claim` twice for same egg → second call returns `{success: false}`
