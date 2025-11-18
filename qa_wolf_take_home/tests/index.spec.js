// @ts-check
import { test } from '@playwright/test';

test('scrape Hacker News articles', async ({ page }) => {
  await page.goto('https://news.ycombinator.com/newest');

  let totalArticles = 0;

  for (let loop = 0; loop < 4; loop++) {
    // Wait for at least one .age element to appear
    await page.locator('.age').first().waitFor();

    const ageLocators = page.locator('.age');
    const count = await ageLocators.count();

    console.log(`Loop ${loop + 1}: Found ${count} articles`);

    for (let i = 0; i < count; i++) {
      if (totalArticles >= 100) break;

      const element = ageLocators.nth(i);
      const title = await element.getAttribute('title');
      if (!title) continue;

      // Split into timestamp + article number
      const [timestamp, articleNumber] = title.split(' ');
      console.log(`${totalArticles + 1}. Article ID: ${articleNumber} - timestamp: ${timestamp}`);
      totalArticles++;
    }

    if (totalArticles >= 100) break;

    // Click the "more" link to load next page
    await page.locator('.morelink').click();
    await page.waitForLoadState('networkidle');
  }
});