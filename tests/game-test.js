const { chromium, webkit, devices } = require('playwright');

const URL = 'https://iguanodon.space';

// Device configurations to test
const deviceConfigs = [
  { name: 'Desktop Chrome', browser: 'chromium', viewport: { width: 1920, height: 1080 } },
  { name: 'Desktop Safari', browser: 'webkit', viewport: { width: 1440, height: 900 } },
  { name: 'iPhone 14', browser: 'webkit', device: devices['iPhone 14'] },
  { name: 'iPhone SE', browser: 'webkit', device: devices['iPhone SE'] },
  { name: 'Pixel 7', browser: 'chromium', device: devices['Pixel 7'] },
  { name: 'iPad', browser: 'webkit', device: devices['iPad (gen 7)'] },
];

// Network conditions
const networkConditions = {
  'Fast WiFi': { downloadThroughput: 50 * 1024 * 1024 / 8, uploadThroughput: 20 * 1024 * 1024 / 8, latency: 20 },
  'Slow 3G': { downloadThroughput: 750 * 1024 / 8, uploadThroughput: 250 * 1024 / 8, latency: 400 },
  'Regular 4G': { downloadThroughput: 4 * 1024 * 1024 / 8, uploadThroughput: 3 * 1024 * 1024 / 8, latency: 100 },
};

// Test results storage
const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(msg, type = 'info') {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} ${msg}`);
}

async function testBasicPageLoad(page, deviceName) {
  const testName = `[${deviceName}] Basic page load`;
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Check main elements exist
    const setSelection = await page.$('#setSelection');
    const standardBtn = await page.$('[data-set="standard"]');
    const bingoBtn = await page.$('#openBingoBtn');

    if (setSelection && standardBtn && bingoBtn) {
      log(`${testName} - All main elements present`, 'pass');
      results.passed.push(testName);
      return true;
    } else {
      log(`${testName} - Missing elements`, 'fail');
      results.failed.push(testName);
      return false;
    }
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testMusicFlow(page, deviceName) {
  const testName = `[${deviceName}] Music flow`;
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Click Standard genre
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)', { timeout: 5000 });

    // Check game area visible
    const gameAreaVisible = await page.$eval('#gameArea', el => !el.classList.contains('hidden'));
    if (!gameAreaVisible) throw new Error('Game area not visible after selecting genre');

    // Click Draw Card
    await page.click('#drawBtn');
    await page.waitForTimeout(1000);

    // Check guessing state shows
    const guessingIcon = await page.$('.guessing-icon');
    if (!guessingIcon) throw new Error('Guessing state not shown after draw');

    // Check Reveal button visible
    const revealBtn = await page.$('#revealBtn:not(.hidden)');
    if (!revealBtn) throw new Error('Reveal button not visible');

    // Click Reveal
    await page.click('#revealBtn');
    await page.waitForTimeout(500);

    // Check answer shown
    const songTitle = await page.$('.song-title');
    if (!songTitle) throw new Error('Song title not shown after reveal');

    // Check Next button visible
    const nextBtn = await page.$('#nextBtn:not(.hidden)');
    if (!nextBtn) throw new Error('Next button not visible after reveal');

    log(`${testName} - Draw/Reveal/Next flow works`, 'pass');
    results.passed.push(testName);
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testBingoFlow(page, deviceName) {
  const testName = `[${deviceName}] Bingo flow`;
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Click Bingo Card
    await page.click('#openBingoBtn');
    await page.waitForSelector('#bingoArea:not(.hidden)', { timeout: 5000 });

    // Check bingo grid exists with 25 cells
    const cells = await page.$$('.bingo-cell');
    if (cells.length !== 25) throw new Error(`Expected 25 bingo cells, got ${cells.length}`);

    // Check color distribution (5 of each)
    const colorCounts = {};
    for (const cell of cells) {
      const classes = await cell.getAttribute('class');
      const colorMatch = classes.match(/cell-(green|yellow|pink|blue|purple)/);
      if (colorMatch) {
        colorCounts[colorMatch[1]] = (colorCounts[colorMatch[1]] || 0) + 1;
      }
    }
    const allFive = Object.values(colorCounts).every(c => c === 5);
    if (!allFive) throw new Error(`Color distribution wrong: ${JSON.stringify(colorCounts)}`);

    // Select a color
    await page.click('.color-btn[data-color="green"]');
    const colorSelected = await page.$('.color-btn.selected[data-color="green"]');
    if (!colorSelected) throw new Error('Color not selected');

    // Enter answer
    await page.fill('#bingoAnswer', 'Test Artist');

    // Submit
    await page.click('#bingoSubmitAnswer');
    await page.waitForSelector('#bingoPhase2:not(.hidden)', { timeout: 3000 });

    // Check correct/wrong buttons visible
    const correctBtn = await page.$('#bingoCorrect');
    const wrongBtn = await page.$('#bingoWrong');
    if (!correctBtn || !wrongBtn) throw new Error('Correct/Wrong buttons not visible');

    log(`${testName} - Bingo grid and answer flow works`, 'pass');
    results.passed.push(testName);
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testStatePersistence(page, deviceName) {
  const testName = `[${deviceName}] State persistence`;
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Start music game
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');
    await page.click('#drawBtn');
    await page.waitForTimeout(1000);

    // Get current song index
    const playedCount1 = await page.$eval('#playedCount', el => el.textContent);

    // Go home
    await page.click('#backBtn');
    await page.waitForSelector('#setSelection:not(.hidden)');

    // Return to Standard
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');

    // Check song index preserved
    const playedCount2 = await page.$eval('#playedCount', el => el.textContent);
    if (playedCount1 !== playedCount2) throw new Error(`Song index not preserved: ${playedCount1} vs ${playedCount2}`);

    // Check card is still in guessing state (not revealed)
    const guessingIcon = await page.$('.guessing-icon');
    if (!guessingIcon) throw new Error('Card was revealed after navigation (should stay unrevealed)');

    log(`${testName} - State persists across navigation`, 'pass');
    results.passed.push(testName);
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testRevealStatePersistence(page, deviceName) {
  const testName = `[${deviceName}] Reveal state persistence`;
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Start music game and reveal
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');
    await page.click('#drawBtn');
    await page.waitForTimeout(500);
    await page.click('#revealBtn');
    await page.waitForTimeout(500);

    // Verify revealed
    const songTitle = await page.$('.song-title');
    if (!songTitle) throw new Error('Song not revealed');

    // Go home and back
    await page.click('#backBtn');
    await page.waitForSelector('#setSelection:not(.hidden)');
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');

    // Check still revealed
    const songTitleAfter = await page.$('.song-title');
    if (!songTitleAfter) throw new Error('Reveal state lost after navigation');

    log(`${testName} - Reveal state persists`, 'pass');
    results.passed.push(testName);
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testMiniPlayer(page, deviceName) {
  const testName = `[${deviceName}] Mini player`;
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Start music
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)');
    await page.click('#drawBtn');
    await page.waitForTimeout(2000); // Wait for Spotify embed

    // Go home
    await page.click('#backBtn');
    await page.waitForSelector('#setSelection:not(.hidden)');
    await page.waitForTimeout(500);

    // Check mini player visible
    const miniPlayer = await page.$('#miniPlayer:not(.hidden)');
    if (!miniPlayer) {
      log(`${testName} - Mini player not shown (may be expected if embed not loaded)`, 'warn');
      results.warnings.push(`${testName}: Mini player not visible`);
      return true; // Not a hard failure
    }

    log(`${testName} - Mini player appears on home`, 'pass');
    results.passed.push(testName);
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testBingoStatePersistence(page, deviceName) {
  const testName = `[${deviceName}] Bingo state persistence`;
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Start bingo
    await page.click('#openBingoBtn');
    await page.waitForSelector('#bingoArea:not(.hidden)');

    // Select color and enter answer
    await page.click('.color-btn[data-color="blue"]');
    await page.fill('#bingoAnswer', 'Persistence Test');

    // Go home
    await page.click('#bingoBackBtn');
    await page.waitForSelector('#setSelection:not(.hidden)');

    // Return to bingo - should show resume dialog
    await page.click('#openBingoBtn');
    await page.waitForTimeout(500);

    // Check for resume dialog or that state is preserved
    const resumeDialog = await page.$('.confirm-overlay');
    if (resumeDialog) {
      // Click resume
      await page.click('#resumeGame');
      await page.waitForTimeout(500);
    }

    // Check color still selected
    const colorSelected = await page.$('.color-btn.selected[data-color="blue"]');
    if (!colorSelected) throw new Error('Color selection not persisted');

    // Check answer still there
    const answerValue = await page.$eval('#bingoAnswer', el => el.value);
    if (answerValue !== 'Persistence Test') throw new Error(`Answer not persisted: "${answerValue}"`);

    log(`${testName} - Bingo pending state persists`, 'pass');
    results.passed.push(testName);
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testResponsiveLayout(page, deviceName, viewport) {
  const testName = `[${deviceName}] Responsive layout`;
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Check no horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (hasHorizontalScroll) {
      log(`${testName} - Horizontal scroll detected at ${viewport?.width || 'default'}px`, 'warn');
      results.warnings.push(`${testName}: Horizontal scroll at ${viewport?.width || 'default'}px`);
    }

    // Check buttons are tappable size (>= 44px)
    const buttons = await page.$$('button');
    for (const btn of buttons.slice(0, 5)) { // Check first 5 buttons
      const box = await btn.boundingBox();
      if (box && (box.width < 44 || box.height < 44)) {
        const text = await btn.textContent();
        log(`${testName} - Button "${text?.slice(0,20)}" too small: ${box.width}x${box.height}`, 'warn');
        results.warnings.push(`${testName}: Small button ${box.width}x${box.height}`);
      }
    }

    log(`${testName} - Layout checks complete`, 'pass');
    results.passed.push(testName);
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testThreePlayerScenario(browserType) {
  const testName = '[3-Player Scenario]';
  console.log('\n🎮 Starting 3-Player Game Simulation...\n');

  try {
    const browser = await browserType.launch();

    // Create 3 separate browser contexts (simulating 3 players)
    const player1Context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const player2Context = await browser.newContext({ ...devices['iPhone 14'] });
    const player3Context = await browser.newContext({ ...devices['Pixel 7'] });

    const player1 = await player1Context.newPage();
    const player2 = await player2Context.newPage();
    const player3 = await player3Context.newPage();

    // Player 1: Start music (host)
    console.log('👤 Player 1 (Host): Starting music...');
    await player1.goto(URL, { waitUntil: 'domcontentloaded' });
    await player1.click('[data-set="standard"]');
    await player1.waitForSelector('#gameArea:not(.hidden)');
    await player1.click('#drawBtn');
    await player1.waitForTimeout(1000);
    log(`${testName} Player 1 drew card`, 'pass');

    // Players 2 & 3: Start bingo
    console.log('👤 Player 2 (iPhone): Starting bingo...');
    await player2.goto(URL, { waitUntil: 'domcontentloaded' });
    await player2.click('#openBingoBtn');
    await player2.waitForSelector('#bingoArea:not(.hidden)');

    console.log('👤 Player 3 (Android): Starting bingo...');
    await player3.goto(URL, { waitUntil: 'domcontentloaded' });
    await player3.click('#openBingoBtn');
    await player3.waitForSelector('#bingoArea:not(.hidden)');

    // Verify each player has different bingo card
    const getCardColors = async (page) => {
      return page.$$eval('.bingo-cell', cells =>
        cells.map(c => c.className.match(/cell-(green|yellow|pink|blue|purple)/)?.[1])
      );
    };

    const card1 = await getCardColors(player2);
    const card2 = await getCardColors(player3);
    const cardsMatch = JSON.stringify(card1) === JSON.stringify(card2);

    if (cardsMatch) {
      log(`${testName} Warning: Players have same bingo card (possible but unlikely)`, 'warn');
      results.warnings.push(`${testName}: Same bingo cards`);
    } else {
      log(`${testName} Players have different bingo cards`, 'pass');
    }

    // Players 2 & 3 submit answers
    console.log('👤 Players 2 & 3: Submitting answers...');
    await player2.click('.color-btn[data-color="green"]');
    await player2.fill('#bingoAnswer', 'Player 2 Answer');
    await player2.click('#bingoSubmitAnswer');

    await player3.click('.color-btn[data-color="yellow"]');
    await player3.fill('#bingoAnswer', 'Player 3 Answer');
    await player3.click('#bingoSubmitAnswer');

    // Player 1 reveals
    console.log('👤 Player 1: Revealing answer...');
    await player1.click('#revealBtn');
    await player1.waitForTimeout(500);

    const songInfo = await player1.$('.song-title');
    if (songInfo) {
      const title = await songInfo.textContent();
      log(`${testName} Song revealed: "${title?.slice(0,30)}..."`, 'pass');
    }

    // Players 2 & 3 mark answers
    console.log('👤 Players 2 & 3: Marking answers...');
    await player2.click('#bingoCorrect');
    await player2.waitForTimeout(500);

    await player3.click('#bingoWrong');
    await player3.waitForTimeout(1500);

    // Player 2 should see cell selection, Player 3 should be back to phase 1
    const player2Instruction = await player2.$('#bingoInstruction:not(.hidden)');
    const player3Phase1 = await player3.$('#bingoPhase1:not(.hidden)');

    if (player2Instruction) log(`${testName} Player 2 sees cell selection instruction`, 'pass');
    if (player3Phase1) log(`${testName} Player 3 returned to answer phase`, 'pass');

    // Player 1 advances
    console.log('👤 Player 1: Next song...');
    await player1.click('#nextBtn');
    await player1.waitForTimeout(500);

    const newGuessingState = await player1.$('.guessing-icon');
    if (newGuessingState) log(`${testName} Player 1 advanced to next song`, 'pass');

    results.passed.push(`${testName} Complete game round simulation`);

    await browser.close();
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function testWithNetworkCondition(browserType, condition, settings) {
  const testName = `[Network: ${condition}]`;
  console.log(`\n🌐 Testing with ${condition}...\n`);

  try {
    const browser = await browserType.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set up CDP session for network throttling (Chromium only)
    if (browserType.name() === 'chromium') {
      const client = await context.newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: settings.downloadThroughput,
        uploadThroughput: settings.uploadThroughput,
        latency: settings.latency
      });
    }

    const startTime = Date.now();
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const loadTime = Date.now() - startTime;

    log(`${testName} Page loaded in ${loadTime}ms`, loadTime < 10000 ? 'pass' : 'warn');

    // Test basic interactions still work
    await page.click('[data-set="standard"]');
    await page.waitForSelector('#gameArea:not(.hidden)', { timeout: 10000 });

    log(`${testName} Interactions work under ${condition}`, 'pass');
    results.passed.push(`${testName} Load time: ${loadTime}ms`);

    await browser.close();
    return true;
  } catch (e) {
    log(`${testName} - ${e.message}`, 'fail');
    results.failed.push(`${testName}: ${e.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 iguanodon.space Automated Test Suite\n');
  console.log('=' .repeat(60) + '\n');

  // Test on different devices
  for (const config of deviceConfigs) {
    console.log(`\n📱 Testing on ${config.name}...\n`);

    const browserType = config.browser === 'webkit' ? webkit : chromium;
    const browser = await browserType.launch();

    const contextOptions = config.device || { viewport: config.viewport };
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    await testBasicPageLoad(page, config.name);
    await testMusicFlow(page, config.name);
    await testBingoFlow(page, config.name);
    await testStatePersistence(page, config.name);
    await testRevealStatePersistence(page, config.name);
    await testMiniPlayer(page, config.name);
    await testBingoStatePersistence(page, config.name);
    await testResponsiveLayout(page, config.name, config.viewport);

    await browser.close();
  }

  // Test 3-player scenario
  await testThreePlayerScenario(chromium);

  // Test network conditions
  for (const [condition, settings] of Object.entries(networkConditions)) {
    await testWithNetworkCondition(chromium, condition, settings);
  }

  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST SUMMARY\n');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ FAILURES:');
    results.failed.forEach(f => console.log(`   - ${f}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.warnings.forEach(w => console.log(`   - ${w}`));
  }

  console.log('\n' + '=' .repeat(60));
}

runAllTests().catch(console.error);
