/**
 * 내친소 목업 스크린샷 캡처 스크립트
 *
 * 사용법:
 *   npm install playwright (최초 1회)
 *   node take_screenshots.js
 *
 * 출력:
 *   - all_features_mockup.png   (전체 페이지)
 *   - feature_1.png ~ feature_16.png  (개별 기능)
 */

const { chromium } = require('playwright');
const path = require('path');

const MOCKUP_PATH = path.join(__dirname, 'all_mockups.html');
const OUTPUT_DIR = __dirname;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  await page.goto(`file://${MOCKUP_PATH}`);
  await page.waitForLoadState('networkidle');

  // Full-page screenshot
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'all_features_mockup.png'),
    fullPage: true,
  });
  console.log('Saved: all_features_mockup.png');

  // Individual feature screenshots (Phase 1 at minimum)
  const featureIds = [1, 4, 15, 16, 3, 5, 6, 12, 13, 2, 7, 8, 9, 10, 11, 14];

  for (const id of featureIds) {
    const el = await page.$(`#feature-${id}`);
    if (el) {
      await el.screenshot({
        path: path.join(OUTPUT_DIR, `feature_${id}.png`),
      });
      console.log(`Saved: feature_${id}.png`);
    } else {
      console.warn(`Feature #${id} element not found`);
    }
  }

  await browser.close();
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
