const { chromium, devices } = require('playwright');

const URL = 'https://iguanodon.space';

// Test results
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

async function waitForSpotifyEmbed(page, timeout = 30000) {
  log('Waiting for Spotify embed to load...');
  try {
    // Wait for the embed container to have an iframe
    await page.waitForSelector('#embedContainer iframe', { timeout });
    log('Spotify iframe detected', 'pass');
    return true;
  } catch (e) {
    log('Spotify embed did not load in time', 'warn');
    return false;
  }
}

async function getPlayerState(page) {
  // Check the play/pause button state
  const playBtnText = await page.$eval('#playPauseBtn', el => el.textContent).catch(() => null);
  const miniPlayHidden = await page.$eval('#miniPlayIcon', el => el.classList.contains('hidden')).catch(() => null);
  const miniPauseHidden = await page.$eval('#miniPauseIcon', el => el.classList.contains('hidden')).catch(() => null);

  return {
    mainButtonText: playBtnText,
    isPlaying: playBtnText?.includes('Pause') || (miniPlayHidden === true && miniPauseHidden === false),
    isPaused: playBtnText?.includes('Play') || (miniPlayHidden === false && miniPauseHidden === true)
  };
}

async function testPlayPauseBasic(page, deviceName) {
  const testName = `[${deviceName}] Play/Pause basic functionality`;
  log(`\n--- ${testName} ---`);

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Start music game
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');

    // Draw card
    await page.click('#drawBtn');
    await page.waitForTimeout(1000);

    // Wait for Spotify embed
    const embedLoaded = await waitForSpotifyEmbed(page);
    if (!embedLoaded) {
      results.observations.push(`${testName}: Spotify embed slow to load`);
    }

    // Give embed time to initialize
    await page.waitForTimeout(3000);

    // Check initial state
    let state = await getPlayerState(page);
    log(`Initial state: ${JSON.stringify(state)}`);
    results.observations.push(`${testName} - Initial state: ${state.mainButtonText}`);

    // Click play/pause button
    const playPauseBtn = await page.$('#playPauseBtn');
    if (playPauseBtn) {
      log('Clicking play/pause button...');
      await playPauseBtn.click();
      await page.waitForTimeout(2000);

      let newState = await getPlayerState(page);
      log(`After click: ${JSON.stringify(newState)}`);

      // Click again to toggle
      await playPauseBtn.click();
      await page.waitForTimeout(2000);

      let finalState = await getPlayerState(page);
      log(`After second click: ${JSON.stringify(finalState)}`);

      // Verify state changed
      if (state.mainButtonText !== newState.mainButtonText || newState.mainButtonText !== finalState.mainButtonText) {
        log(`${testName} - Button state toggles correctly`, 'pass');
        results.passed.push(testName);
      } else {
        log(`${testName} - Button state did not change`, 'warn');
        results.observations.push(`${testName}: Button may not be responding to clicks`);
      }
    } else {
      log(`${testName} - Play button not found`, 'fail');
      results.failed.push(testName);
    }

    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function test30SecondPreviewLoop(page, deviceName) {
  const testName = `[${deviceName}] 30-second preview loop (non-premium)`;
  log(`\n--- ${testName} ---`);
  log('This test takes ~35 seconds to verify preview looping...');

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Start music game
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');
    await page.click('#drawBtn');

    const embedLoaded = await waitForSpotifyEmbed(page);
    if (!embedLoaded) {
      log(`${testName} - Embed not loaded, skipping`, 'warn');
      results.observations.push(`${testName}: Skipped - embed not loaded`);
      return false;
    }

    // Try to start playback
    await page.waitForTimeout(2000);
    const playBtn = await page.$('#playPauseBtn');
    if (playBtn) {
      await playBtn.click();
    }

    log('Waiting 35 seconds to observe preview behavior...');

    // Monitor for 35 seconds, checking state every 5 seconds
    const states = [];
    for (let i = 0; i < 7; i++) {
      await page.waitForTimeout(5000);
      const state = await getPlayerState(page);
      const elapsed = (i + 1) * 5;
      states.push({ elapsed, ...state });
      log(`  ${elapsed}s: ${state.mainButtonText || 'unknown'}`);
    }

    results.observations.push(`${testName} - States over 35s: ${states.map(s => s.mainButtonText).join(' → ')}`);

    // Check if song is still playing or restarted
    const finalState = states[states.length - 1];
    if (finalState.isPlaying) {
      log(`${testName} - Song still playing after 35s (may have looped or full track)`, 'obs');
      results.observations.push(`${testName}: Song active at 35s - likely looped or premium user`);
    } else {
      log(`${testName} - Song paused/stopped at 35s`, 'obs');
      results.observations.push(`${testName}: Song stopped at 35s - preview ended without loop`);
    }

    results.passed.push(`${testName} - Completed observation`);
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testSlowNetworkPlayback(page, deviceName, client) {
  const testName = `[${deviceName}] Slow network playback`;
  log(`\n--- ${testName} ---`);

  try {
    // First load page normally
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');
    await page.click('#drawBtn');

    const embedLoaded = await waitForSpotifyEmbed(page);
    if (!embedLoaded) {
      log(`${testName} - Embed not loaded, skipping`, 'warn');
      results.observations.push(`${testName}: Skipped - embed not loaded`);
      return false;
    }

    await page.waitForTimeout(2000);

    // Start playback
    const playBtn = await page.$('#playPauseBtn');
    if (playBtn) {
      await playBtn.click();
      await page.waitForTimeout(2000);
    }

    let stateBeforeThrottle = await getPlayerState(page);
    log(`State before throttle: ${JSON.stringify(stateBeforeThrottle)}`);

    // Now throttle to very slow 3G
    log('Enabling slow 3G network throttling...');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50 * 1024 / 8,  // 50 Kbps - very slow
      uploadThroughput: 20 * 1024 / 8,
      latency: 2000  // 2 second latency
    });

    // Monitor for 15 seconds
    log('Monitoring player state under slow network for 15s...');
    const states = [];
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(5000);
      const state = await getPlayerState(page);
      states.push(state);
      log(`  ${(i + 1) * 5}s: ${state.mainButtonText || 'unknown'}`);
    }

    // Disable throttling
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });
    log('Network throttling disabled');

    // Check final state after returning to normal
    await page.waitForTimeout(3000);
    let stateAfterRestore = await getPlayerState(page);
    log(`State after network restored: ${JSON.stringify(stateAfterRestore)}`);

    results.observations.push(`${testName} - Before: ${stateBeforeThrottle.mainButtonText}, During slow: ${states.map(s => s.mainButtonText).join('→')}, After: ${stateAfterRestore.mainButtonText}`);
    results.passed.push(`${testName} - Completed observation`);

    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testOfflineRecovery(page, deviceName, client) {
  const testName = `[${deviceName}] Offline and recovery`;
  log(`\n--- ${testName} ---`);

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');
    await page.click('#drawBtn');

    const embedLoaded = await waitForSpotifyEmbed(page);
    if (!embedLoaded) {
      results.observations.push(`${testName}: Skipped - embed not loaded`);
      return false;
    }

    await page.waitForTimeout(2000);

    // Start playback
    const playBtn = await page.$('#playPauseBtn');
    if (playBtn) {
      await playBtn.click();
      await page.waitForTimeout(2000);
    }

    let stateOnline = await getPlayerState(page);
    log(`State while online: ${JSON.stringify(stateOnline)}`);

    // Go offline
    log('Going offline...');
    await client.send('Network.emulateNetworkConditions', {
      offline: true,
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0
    });

    // Wait and check state
    await page.waitForTimeout(5000);
    let stateOffline = await getPlayerState(page);
    log(`State while offline: ${JSON.stringify(stateOffline)}`);

    // Try clicking play/pause while offline
    if (playBtn) {
      log('Attempting play/pause while offline...');
      await playBtn.click().catch(() => log('Click failed while offline', 'warn'));
      await page.waitForTimeout(2000);
      let stateAfterClick = await getPlayerState(page);
      log(`State after offline click: ${JSON.stringify(stateAfterClick)}`);
    }

    // Come back online
    log('Coming back online...');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });

    await page.waitForTimeout(5000);
    let stateRecovered = await getPlayerState(page);
    log(`State after recovery: ${JSON.stringify(stateRecovered)}`);

    results.observations.push(`${testName} - Online: ${stateOnline.mainButtonText}, Offline: ${stateOffline.mainButtonText}, Recovered: ${stateRecovered.mainButtonText}`);
    results.passed.push(`${testName} - Completed observation`);

    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testMiniPlayerSync(page, deviceName) {
  const testName = `[${deviceName}] Mini player state sync`;
  log(`\n--- ${testName} ---`);

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');
    await page.click('#drawBtn');

    const embedLoaded = await waitForSpotifyEmbed(page);
    if (!embedLoaded) {
      results.observations.push(`${testName}: Skipped - embed not loaded`);
      return false;
    }

    await page.waitForTimeout(3000);

    // Get main button state
    let mainState = await getPlayerState(page);
    log(`Main player state: ${JSON.stringify(mainState)}`);

    // Go to home to see mini player
    await page.click('#backBtn');
    await page.waitForSelector('#setSelection:not(.hidden)');
    await page.waitForTimeout(1000);

    // Check if mini player is visible
    const miniPlayerVisible = await page.$('#miniPlayer:not(.hidden)');
    if (!miniPlayerVisible) {
      log(`${testName} - Mini player not visible on home`, 'obs');
      results.observations.push(`${testName}: Mini player not shown on home screen`);
      return true;
    }

    log('Mini player is visible');

    // Check mini player state
    let miniState = await getPlayerState(page);
    log(`Mini player state: ${JSON.stringify(miniState)}`);

    // Click mini player toggle
    const miniToggle = await page.$('#miniPlayerToggle');
    if (miniToggle) {
      log('Clicking mini player toggle...');
      await miniToggle.click();
      await page.waitForTimeout(2000);

      let afterToggle = await getPlayerState(page);
      log(`After mini toggle: ${JSON.stringify(afterToggle)}`);

      // Return to music view
      await page.click('[data-set="standard"]');
      await page.waitForSelector('#gameArea:not(.hidden)');
      await page.waitForTimeout(1000);

      let backInMusic = await getPlayerState(page);
      log(`Back in music view: ${JSON.stringify(backInMusic)}`);

      // Check sync
      if (afterToggle.isPlaying === backInMusic.isPlaying) {
        log(`${testName} - States are in sync`, 'pass');
        results.passed.push(testName);
      } else {
        log(`${testName} - States may be out of sync`, 'warn');
        results.observations.push(`${testName}: Potential state sync issue`);
      }
    }

    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function runPlayerTests() {
  console.log('🎵 Spotify Player Test Suite\n');
  console.log('=' .repeat(60));
  console.log('Testing: Play/Pause, 30s Preview Loop, Network Issues\n');

  const browser = await chromium.launch({ headless: true });

  // Test on desktop
  console.log('\n📱 Testing on Desktop Chrome...\n');
  const desktopContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const desktopPage = await desktopContext.newPage();
  const desktopClient = await desktopContext.newCDPSession(desktopPage);

  await testPlayPauseBasic(desktopPage, 'Desktop Chrome');
  await testMiniPlayerSync(desktopPage, 'Desktop Chrome');

  // Clear state for next test
  await desktopContext.clearCookies();
  await desktopPage.evaluate(() => sessionStorage.clear());

  await test30SecondPreviewLoop(desktopPage, 'Desktop Chrome');

  // Clear state
  await desktopContext.clearCookies();
  await desktopPage.evaluate(() => sessionStorage.clear());

  await testSlowNetworkPlayback(desktopPage, 'Desktop Chrome', desktopClient);

  // Clear state
  await desktopContext.clearCookies();
  await desktopPage.evaluate(() => sessionStorage.clear());

  await testOfflineRecovery(desktopPage, 'Desktop Chrome', desktopClient);

  await desktopContext.close();

  // Test on mobile (Pixel 7 - Android)
  console.log('\n📱 Testing on Pixel 7 (Android)...\n');
  const mobileContext = await browser.newContext({ ...devices['Pixel 7'] });
  const mobilePage = await mobileContext.newPage();
  const mobileClient = await mobileContext.newCDPSession(mobilePage);

  await testPlayPauseBasic(mobilePage, 'Pixel 7');
  await testMiniPlayerSync(mobilePage, 'Pixel 7');

  await mobileContext.close();

  // Test on iPhone
  console.log('\n📱 Testing on iPhone 14...\n');
  const { webkit } = require('playwright');
  const iphoneBrowser = await webkit.launch({ headless: true });
  const iphoneContext = await iphoneBrowser.newContext({ ...devices['iPhone 14'] });
  const iphonePage = await iphoneContext.newPage();

  await testPlayPauseBasic(iphonePage, 'iPhone 14');
  await testMiniPlayerSync(iphonePage, 'iPhone 14');

  await iphoneBrowser.close();
  await browser.close();

  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 PLAYER TEST SUMMARY\n');
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

runPlayerTests().catch(console.error);
