const { chromium } = require('playwright');

const URL = 'https://iguanodon.space';

async function debugEmbed() {
  console.log('🔍 Debugging Spotify Embed Loading\n');

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Capture console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Capture errors
  const errors = [];
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  console.log('1. Loading page...');
  await page.goto(URL, { waitUntil: 'networkidle' });
  console.log('   Page loaded');

  console.log('\n2. Clicking Standard genre...');
  await page.click('[data-set="standard"]');
  await page.waitForSelector('#gameArea:not(.hidden)');
  console.log('   Game area visible');

  console.log('\n3. Checking for Draw button...');
  const drawBtn = await page.$('#drawBtn:not(.hidden)');
  console.log(`   Draw button visible: ${!!drawBtn}`);

  if (drawBtn) {
    console.log('\n4. Clicking Draw Card...');
    await drawBtn.click();
    await page.waitForTimeout(2000);
    console.log('   Draw clicked');
  }

  console.log('\n5. Checking embed container...');
  const embedContainer = await page.$('#embedContainer');
  console.log(`   Embed container exists: ${!!embedContainer}`);

  if (embedContainer) {
    const html = await embedContainer.innerHTML();
    console.log(`   Container HTML length: ${html.length}`);
    console.log(`   Container HTML preview: ${html.slice(0, 200)}...`);
  }

  console.log('\n6. Waiting 10 seconds for embed to load...');
  await page.waitForTimeout(10000);

  console.log('\n7. Checking for iframe...');
  const iframe = await page.$('#embedContainer iframe');
  console.log(`   Iframe exists: ${!!iframe}`);

  if (iframe) {
    const src = await iframe.getAttribute('src');
    console.log(`   Iframe src: ${src}`);
  }

  console.log('\n8. Checking IFrameAPI...');
  const hasAPI = await page.evaluate(() => typeof window.IFrameAPI !== 'undefined');
  console.log(`   IFrameAPI available: ${hasAPI}`);

  const hasSpotify = await page.evaluate(() => typeof window.onSpotifyIframeApiReady !== 'undefined');
  console.log(`   onSpotifyIframeApiReady defined: ${hasSpotify}`);

  console.log('\n9. Checking Play button state...');
  const playBtn = await page.$('#playPauseBtn');
  if (playBtn) {
    const text = await playBtn.textContent();
    console.log(`   Play button text: ${text}`);
  } else {
    console.log('   Play button not found');
  }

  console.log('\n10. Console logs:');
  consoleLogs.slice(-10).forEach(l => console.log(`   ${l}`));

  if (errors.length > 0) {
    console.log('\n11. Page errors:');
    errors.forEach(e => console.log(`   ❌ ${e}`));
  }

  console.log('\n12. Waiting 20 more seconds (watch the browser)...');
  await page.waitForTimeout(20000);

  // Final check
  const finalIframe = await page.$('#embedContainer iframe');
  console.log(`\n13. Final iframe check: ${!!finalIframe}`);

  await browser.close();
  console.log('\nDone.');
}

debugEmbed().catch(console.error);
