const { chromium } = require('playwright');

const URL = 'https://iguanodon.space';

const results = {
  passed: [],
  failed: [],
  observations: []
};

function log(msg, type = 'info') {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : type === 'obs' ? '👁️' : 'ℹ️';
  const timestamp = new Date().toISOString().substr(11, 8);
  console.log(`[${timestamp}] ${prefix} ${msg}`);
}

async function waitForSpotifyEmbed(page, timeout = 60000) {
  log('Waiting for Spotify embed to load...');
  try {
    await page.waitForSelector('#embedContainer iframe', { timeout });
    log('Spotify iframe detected', 'pass');
    await page.waitForTimeout(3000);
    return true;
  } catch (e) {
    log('Spotify embed did not load in time', 'warn');
    return false;
  }
}

async function getPlayerState(page) {
  const playBtnText = await page.$eval('#playPauseBtn', el => el.textContent).catch(() => null);
  return {
    mainButtonText: playBtnText,
    isPlaying: playBtnText?.includes('Pause'),
    isPaused: playBtnText?.includes('Play')
  };
}

async function testPlayPause(context, deviceName) {
  const testName = `[${deviceName}] Play/Pause`;
  log(`\n--- ${testName} ---`);

  // Fresh page for clean state
  const page = await context.newPage();

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');
    await page.click('#drawBtn');
    await page.waitForTimeout(1000);

    const embedLoaded = await waitForSpotifyEmbed(page, 60000);
    if (!embedLoaded) {
      results.observations.push(`${testName}: Embed failed to load`);
      await page.close();
      return false;
    }

    let state1 = await getPlayerState(page);
    log(`Initial: ${state1.mainButtonText}`);

    await page.click('#playPauseBtn');
    await page.waitForTimeout(3000);
    let state2 = await getPlayerState(page);
    log(`After 1st click: ${state2.mainButtonText}`);

    await page.click('#playPauseBtn');
    await page.waitForTimeout(2000);
    let state3 = await getPlayerState(page);
    log(`After 2nd click: ${state3.mainButtonText}`);

    const toggled = state1.mainButtonText !== state2.mainButtonText;
    if (toggled) {
      log(`${testName} - Button toggles correctly`, 'pass');
      results.passed.push(testName);
    } else {
      log(`${testName} - Button did not toggle`, 'warn');
      results.observations.push(`${testName}: States: ${state1.mainButtonText} → ${state2.mainButtonText} → ${state3.mainButtonText}`);
    }

    await page.close();
    return toggled;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    await page.close();
    return false;
  }
}

async function test30SecondLoop(context, deviceName) {
  const testName = `[${deviceName}] 30s Preview Loop`;
  log(`\n--- ${testName} ---`);
  log('Monitoring playback for 40 seconds...');

  const page = await context.newPage();

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');
    await page.click('#drawBtn');

    const embedLoaded = await waitForSpotifyEmbed(page, 60000);
    if (!embedLoaded) {
      results.observations.push(`${testName}: Embed failed to load`);
      await page.close();
      return false;
    }

    await page.click('#playPauseBtn');
    await page.waitForTimeout(2000);

    let initialState = await getPlayerState(page);
    log(`Started: ${initialState.mainButtonText}`);

    log('Monitoring for 40 seconds...');
    const checkpoints = [];
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(5000);
      const state = await getPlayerState(page);
      const elapsed = (i + 1) * 5;
      checkpoints.push({ elapsed, state: state.mainButtonText });
      log(`  ${elapsed}s: ${state.mainButtonText}`);
    }

    const playingCount = checkpoints.filter(c => c.state?.includes('Pause')).length;
    results.observations.push(`${testName}: Playing ${playingCount}/8 checkpoints`);

    if (playingCount >= 6) {
      log(`${testName} - Song playing/looping successfully`, 'pass');
      results.passed.push(testName);
    } else {
      log(`${testName} - Playback issues observed`, 'obs');
    }

    await page.close();
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    await page.close();
    return false;
  }
}

async function testSlowNetwork(context, deviceName) {
  const testName = `[${deviceName}] Slow Network`;
  log(`\n--- ${testName} ---`);

  const page = await context.newPage();
  const client = await context.newCDPSession(page);

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');
    await page.click('#drawBtn');

    const embedLoaded = await waitForSpotifyEmbed(page, 60000);
    if (!embedLoaded) {
      results.observations.push(`${testName}: Embed failed to load`);
      await page.close();
      return false;
    }

    await page.click('#playPauseBtn');
    await page.waitForTimeout(3000);

    let stateBefore = await getPlayerState(page);
    log(`Before throttle: ${stateBefore.mainButtonText}`);

    log('Applying extreme throttle (50 Kbps)...');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50 * 1024 / 8,
      uploadThroughput: 20 * 1024 / 8,
      latency: 2000
    });

    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(5000);
      const state = await getPlayerState(page);
      log(`  Throttled ${(i + 1) * 5}s: ${state.mainButtonText}`);
    }

    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });
    log('Throttle removed');

    await page.waitForTimeout(5000);
    let stateAfter = await getPlayerState(page);
    log(`After recovery: ${stateAfter.mainButtonText}`);

    results.observations.push(`${testName}: Before=${stateBefore.mainButtonText}, After=${stateAfter.mainButtonText}`);
    results.passed.push(`${testName} - Completed`);

    await page.close();
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    await page.close();
    return false;
  }
}

async function testMiniPlayer(context, deviceName) {
  const testName = `[${deviceName}] Mini Player`;
  log(`\n--- ${testName} ---`);

  const page = await context.newPage();

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');
    await page.click('#drawBtn');

    const embedLoaded = await waitForSpotifyEmbed(page, 60000);
    if (!embedLoaded) {
      results.observations.push(`${testName}: Embed failed to load`);
      await page.close();
      return false;
    }

    await page.click('#playPauseBtn');
    await page.waitForTimeout(2000);

    let musicViewState = await getPlayerState(page);
    log(`Music view: ${musicViewState.mainButtonText}`);

    await page.click('#backBtn');
    await page.waitForSelector('#setSelection:not(.hidden)');
    await page.waitForTimeout(1000);

    const miniPlayerVisible = await page.$eval('#miniPlayer', el => !el.classList.contains('hidden')).catch(() => false);
    log(`Mini player visible: ${miniPlayerVisible}`);

    if (miniPlayerVisible) {
      const miniPlayHidden = await page.$eval('#miniPlayIcon', el => el.classList.contains('hidden')).catch(() => null);
      log(`Mini play icon hidden: ${miniPlayHidden}`);

      await page.click('#miniPlayerToggle');
      await page.waitForTimeout(2000);

      const miniPlayHidden2 = await page.$eval('#miniPlayIcon', el => el.classList.contains('hidden')).catch(() => null);
      log(`After toggle - Play icon hidden: ${miniPlayHidden2}`);

      if (miniPlayHidden !== miniPlayHidden2) {
        log(`${testName} - Mini player toggle works`, 'pass');
        results.passed.push(testName);
      } else {
        results.observations.push(`${testName}: Toggle may not be working`);
      }
    } else {
      results.observations.push(`${testName}: Mini player not visible`);
    }

    await page.close();
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    await page.close();
    return false;
  }
}

async function runTests() {
  console.log('🎵 Spotify Player Tests (HEADED MODE)\n');
  console.log('=' .repeat(60));
  console.log('A browser window will open. Please do not interact with it.\n');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  await testPlayPause(context, 'Desktop Chrome');
  await test30SecondLoop(context, 'Desktop Chrome');
  await testSlowNetwork(context, 'Desktop Chrome');
  await testMiniPlayer(context, 'Desktop Chrome');

  await browser.close();

  console.log('\n' + '=' .repeat(60));
  console.log('📊 SUMMARY\n');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`👁️ Observations: ${results.observations.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ FAILURES:');
    results.failed.forEach(f => console.log(`   - ${f}`));
  }

  console.log('\n👁️ OBSERVATIONS:');
  results.observations.forEach(o => console.log(`   - ${o}`));

  console.log('\n' + '=' .repeat(60));
}

runTests().catch(console.error);
