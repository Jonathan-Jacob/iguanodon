# Test Requirements for iguanodon.space

## Game Concept
This is a party game played in the same physical room:
- **Player 1 (Host)**: Controls music playback on their device (speakers/TV)
- **All Players**: Listen to the same song and guess on their own bingo cards
- Everyone plays the same genre/category simultaneously

---

## Test Scenario: 3 Players, Same Category (Standard)

### Player 1 (Host): Music Controller + Bingo
- Selects "Standard" genre
- Draws cards, reveals answers, advances to next song
- Also plays bingo on their own device
- Switches between music view and bingo view

### Player 2: Bingo Only
- Opens bingo directly (doesn't control music)
- Listens to Player 1's audio
- Guesses on their own bingo card

### Player 3: Bingo Only
- Opens bingo directly (doesn't control music)
- Listens to Player 1's audio
- Guesses on their own bingo card

---

## Device/OS/Browser Matrix

### Desktop Browsers
| Browser | OS | Priority |
|---------|-----|----------|
| Chrome (latest) | macOS | High |
| Chrome (latest) | Windows | High |
| Safari (latest) | macOS | High |
| Firefox (latest) | macOS | Medium |
| Firefox (latest) | Windows | Medium |
| Edge (latest) | Windows | Medium |

### Mobile Browsers
| Browser | OS | Priority |
|---------|-----|----------|
| Safari | iOS 16+ | High |
| Chrome | iOS 16+ | High |
| Chrome | Android 12+ | High |
| Samsung Internet | Android | Low |

### Device Viewports
| Device | Width x Height |
|--------|----------------|
| iPhone SE | 375 x 667 |
| iPhone 14 | 390 x 844 |
| iPhone 14 Pro Max | 430 x 932 |
| iPad | 768 x 1024 |
| Android Phone | 360 x 800 |
| Desktop | 1920 x 1080 |
| Laptop | 1440 x 900 |

---

## Network Conditions

### Scenarios to Test
| Condition | Download | Upload | Latency | Test Focus |
|-----------|----------|--------|---------|------------|
| Fast WiFi | 50 Mbps | 20 Mbps | 20ms | Baseline |
| Slow 3G | 750 Kbps | 250 Kbps | 400ms | Spotify embed loading |
| Regular 4G | 4 Mbps | 3 Mbps | 100ms | Typical mobile |
| Offline | 0 | 0 | - | Graceful degradation |
| Intermittent | Varies | Varies | Varies | Connection drops |

### Network-Related Test Cases
- [ ] Spotify embed loads successfully on slow connection
- [ ] UI remains responsive while embed loads
- [ ] State saves before connection drops
- [ ] App recovers gracefully when connection returns
- [ ] sessionStorage works offline for bingo state
- [ ] Error states shown when Spotify unreachable
- [ ] No data loss on intermittent connection

---

## Test Cases

### 1. Player 1 - Music Host Flow
- [ ] Select "Standard" genre → game area visible
- [ ] Draw card → shows guessing state (song plays)
- [ ] Wait for guesses from all players...
- [ ] Reveal → shows song info for verification
- [ ] Next song → new song plays, new guessing state
- [ ] Repeat cycle

### 2. Player 1 - Combined Music + Bingo
- [ ] While music is playing, toggle to bingo (🎯)
- [ ] Mini player appears at top/corner
- [ ] Can play bingo while controlling music via mini player
- [ ] Toggle back to music view (🎵) to reveal/advance
- [ ] Music state preserved when switching views

### 3. Player 2 & 3 - Bingo Only Flow
- [ ] Open app → select "Bingo Card"
- [ ] New bingo card generates (5x5, 5 colors each)
- [ ] Listen to song from Player 1's device
- [ ] Pick a color category for guess
- [ ] Enter answer (artist, title, year, etc.)
- [ ] Submit answer
- [ ] Wait for Player 1 to reveal...
- [ ] Mark correct or wrong based on reveal
- [ ] If correct, tap cell to fill
- [ ] Repeat for next song

### 4. State Persistence - Player 1
- [ ] Go home mid-game → music state saved
- [ ] Return to Standard → same song, same reveal state
- [ ] Toggle to bingo → music continues
- [ ] Mini player controls work
- [ ] Bingo progress preserved across toggles

### 5. State Persistence - Player 2 & 3
- [ ] Go home mid-bingo → bingo state saved
- [ ] Return to bingo → resume dialog appears
- [ ] Resume → grid, filled cells, history restored
- [ ] Pending answer (color + text) persists
- [ ] Phase 2 (awaiting correct/wrong) persists

### 6. Bingo Card Independence
- [ ] Each player has DIFFERENT randomly generated card
- [ ] Same answer can be correct for one player, wrong for another (different color cells)
- [ ] Each player's filled cells are independent

### 7. Edge Cases
- [ ] Player fills all cells of a color → "No cells left" dialog
- [ ] Player achieves bingo (5 in a row) → win screen
- [ ] Player 1 ends music session → can start new game
- [ ] Players 2 & 3 can continue bingo independently

### 8. Sync Points (Manual, Same Room)
- [ ] Player 1 plays song → All players hear it
- [ ] All players submit guesses → Player 1 reveals
- [ ] All players verify their answers → Mark correct/wrong
- [ ] Player 1 advances → Next round

### 9. Responsive Design
- [ ] Layout adapts to mobile viewport
- [ ] Touch targets are >= 44px on mobile
- [ ] Mini player is usable on all screen sizes
- [ ] Bingo grid cells are tappable on small screens
- [ ] No horizontal scroll on any device

### 10. Accessibility
- [ ] Color contrast meets WCAG AA
- [ ] Buttons have visible focus states
- [ ] Screen reader can navigate bingo grid
- [ ] Touch targets are adequately sized

---

## Technical Setup

### Tools
- **Puppeteer**: Headless Chrome automation
- **Playwright**: Cross-browser testing (Chrome, Firefox, Safari)
- **BrowserStack/Sauce Labs**: Real device testing (optional)

### Network Throttling
- Puppeteer: `page.emulateNetworkConditions()`
- Chrome DevTools Protocol for precise control

### Simulation Approach
1. Launch 3 browser contexts (Player 1, 2, 3)
2. Player 1: Music mode → draw → wait
3. Players 2 & 3: Bingo mode → submit answers
4. Player 1: Reveal
5. All players: Mark correct/wrong
6. Player 1: Next song
7. Repeat with network throttling variations

### Metrics to Capture
- Time to interactive
- Spotify embed load time
- State save/restore latency
- UI responsiveness during network issues
