const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'https://iguanodon.space';
const RESULTS_DIR = path.join(__dirname, 'results');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR);
}

const results = {
  tests: [],
  screenshots: [],
  observations: []
};

function log(msg) {
  const timestamp = new Date().toISOString().substr(11, 8);
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  results.observations.push(line);
}

async function screenshot(page, name) {
  const filename = `${name}-${Date.now()}.png`;
  const filepath = path.join(RESULTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push(filename);
  log(`📸 Screenshot: ${filename}`);
}

async function getPlayerState(page) {
  const playBtnText = await page.$eval('#playPauseBtn', el => el.textContent).catch(() => null);
  return {
    text: playBtnText,
    isPlaying: playBtnText?.includes('Pause'),
    isPaused: playBtnText?.includes('Play')
  };
}

async function runTests() {
  log('🎵 Spotify Player Tests (RECORDED)');
  log('=' .repeat(50));

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: RESULTS_DIR, size: { width: 1280, height: 800 } }
  });

  const page = await context.newPage();

  // Test 1: Basic Flow
  log('\n--- TEST 1: Basic Play/Pause ---');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await screenshot(page, '01-home');

  await page.click('[data-set="standard"]');
  await page.waitForSelector('#gameArea:not(.hidden)');
  await screenshot(page, '02-genre-selected');

  await page.click('#drawBtn');
  log('Clicked Draw Card, waiting for embed...');
  await page.waitForTimeout(5000);
  await screenshot(page, '03-card-drawn');

  // Wait for embed to fully load
  log('Waiting 10 seconds for Spotify embed...');
  await page.waitForTimeout(10000);
  await screenshot(page, '04-embed-loaded');

  let state1 = await getPlayerState(page);
  log(`Initial state: ${state1.text}`);
  results.tests.push({ name: 'Initial state', result: state1.text });

  // Click play
  log('Clicking play button...');
  await page.click('#playPauseBtn');
  await page.waitForTimeout(3000);
  await screenshot(page, '05-after-play-click');

  let state2 = await getPlayerState(page);
  log(`After play click: ${state2.text}`);
  results.tests.push({ name: 'After play', result: state2.text });

  // Click pause
  log('Clicking pause button...');
  await page.click('#playPauseBtn');
  await page.waitForTimeout(2000);
  await screenshot(page, '06-after-pause-click');

  let state3 = await getPlayerState(page);
  log(`After pause click: ${state3.text}`);
  results.tests.push({ name: 'After pause', result: state3.text });

  // Test 2: 30-second loop
  log('\n--- TEST 2: 30-Second Preview Loop ---');
  log('Starting playback and monitoring for 40 seconds...');

  await page.click('#playPauseBtn'); // Start playing
  await page.waitForTimeout(2000);

  const loopStates = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(5000);
    const state = await getPlayerState(page);
    const elapsed = (i + 1) * 5;
    loopStates.push({ elapsed, state: state.text });
    log(`  ${elapsed}s: ${state.text}`);

    if (i === 5) { // At 30 seconds
      await screenshot(page, '07-at-30-seconds');
    }
  }
  await screenshot(page, '08-after-40-seconds');
  results.tests.push({ name: '30s loop states', result: loopStates.map(s => s.state).join(' → ') });

  // Test 3: Mini player
  log('\n--- TEST 3: Mini Player ---');
  await page.click('#backBtn');
  await page.waitForSelector('#setSelection:not(.hidden)');
  await page.waitForTimeout(1000);
  await screenshot(page, '09-home-with-miniplayer');

  const miniVisible = await page.$eval('#miniPlayer', el => !el.classList.contains('hidden')).catch(() => false);
  log(`Mini player visible: ${miniVisible}`);
  results.tests.push({ name: 'Mini player visible', result: miniVisible });

  if (miniVisible) {
    log('Clicking mini player toggle...');
    await page.click('#miniPlayerToggle');
    await page.waitForTimeout(2000);
    await screenshot(page, '10-after-mini-toggle');

    const miniState = await page.$eval('#miniPlayIcon', el => el.classList.contains('hidden')).catch(() => null);
    log(`Mini play icon hidden (playing): ${miniState}`);
    results.tests.push({ name: 'Mini player toggle', result: miniState ? 'playing' : 'paused' });
  }

  // Test 4: Return to music view
  log('\n--- TEST 4: Return to Music View ---');
  await page.click('[data-set="standard"]');
  await page.waitForSelector('#gameArea:not(.hidden)');
  await page.waitForTimeout(1000);
  await screenshot(page, '11-returned-to-music');

  let finalState = await getPlayerState(page);
  log(`Final music view state: ${finalState.text}`);
  results.tests.push({ name: 'Final state', result: finalState.text });

  // Close and save results
  await context.close();
  await browser.close();

  // Save results to JSON
  const resultsFile = path.join(RESULTS_DIR, 'test-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  log(`\n📄 Results saved to: ${resultsFile}`);

  // Print summary
  log('\n' + '=' .repeat(50));
  log('📊 SUMMARY');
  log('=' .repeat(50));
  results.tests.forEach(t => {
    log(`  ${t.name}: ${t.result}`);
  });
  log(`\n📸 Screenshots saved: ${results.screenshots.length}`);
  log(`🎬 Video saved in: ${RESULTS_DIR}`);
}

runTests().catch(console.error);
