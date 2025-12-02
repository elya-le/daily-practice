// @ts-check
const { test, expect } = require('@playwright/test');

test('validate Hacker News articles are sorted newest to oldest', async ({ page }) => {
  await page.goto('https://news.ycombinator.com/newest');

  // Wait for first article to be visible before starting
  await expect(page.locator('span.age').first()).toBeVisible();

  const maxArticles = 100;
  const timestamps = [];
  let sameMinuteCount = 0;
  let errorCount = 0;

  // Loop until we have 100 articles
  while (timestamps.length < maxArticles) {
    const ageSpans = page.locator('span.age');
    const count = await ageSpans.count();

    console.log(`Page loaded. Found ${count} timestamps.`);

    if (count === 0) {
      throw new Error('Unable to load more articles. No timestamps found on page.');
    }

    // Calculate how many more articles we need from this page
    const remainingNeeded = maxArticles - timestamps.length;
    const articlesToFetchThisPage = Math.min(count, remainingNeeded);

    console.log(`Extracting ${articlesToFetchThisPage} articles from this page. Total so far: ${timestamps.length}/${maxArticles}`);

    // Batch extraction of title attributes
    const attributes = await ageSpans.evaluateAll(spans =>
      spans.map(span => span.getAttribute('title') || null)
    );

    // Loop through the attributes array
    for (let i = 0; i < attributes.length && timestamps.length < maxArticles; i++) {
      const attribute = attributes[i];

      console.log(`Article ${timestamps.length + 1} timestamp:`, attribute);

      if (!attribute) {
        console.error(`Article ${timestamps.length + 1} has NO title attribute at all`);
        timestamps.push(null);
        errorCount++;
        continue;
      }

      // Extract Unix epoch number (the second part after the space)
      const epochMatch = attribute.match(/(\d+)$/);
      if (!epochMatch) {
        console.error(`Article ${timestamps.length + 1} title exists but regex didn't match: "${attribute}"`);
        timestamps.push(null);
        errorCount++;
        continue;
      }

      const epoch = parseInt(epochMatch[1], 10);
      timestamps.push(epoch);
    }

    // If we still need more articles, click the "More" button
    if (timestamps.length < maxArticles) {
      try {
        console.log(`\nProcessed ${timestamps.length} articles. Need ${maxArticles - timestamps.length} more. Loading next page...`);

        const moreButton = page.getByRole('link', { name: 'More', exact: true });
        await expect(moreButton).toBeVisible();

        await moreButton.click();

        // Wait for new articles to appear after clicking
        await expect(page.getByRole('link', { name: /ago/i }).first()).toBeVisible();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to load more articles. Only collected ${timestamps.length} out of ${maxArticles} required articles. Error: ${errorMessage}`);
      }
    }
  }

  // Convert all valid timestamps to milliseconds for comparison
  const epochList = timestamps.map(t => (t === null ? null : new Date(t * 1000).getTime()));

  // Validate that articles are sorted from newest to oldest
  for (let i = 0; i < epochList.length - 1; i++) {
    const current = epochList[i];
    const next = epochList[i + 1];

    // If either timestamp is invalid, log a warning and skip comparison
    if (current === null || next === null) {
      console.warn(`Article ${i + 1} or ${i + 2} skipped due to missing timestamp`);
      continue;
    }

    if (current < next) {
      console.error(`Articles ${i + 1} and ${i + 2} are out of order`);
      errorCount++;
      expect(current).toBeGreaterThanOrEqual(next);
    } else if (Math.abs(current - next) < 60_000) {
      console.log(`Pass: Articles ${i + 1} and ${i + 2} are in correct order but flagged for same minute`);
      sameMinuteCount++;
    } else {
      console.log(`Pass: Articles ${i + 1} and ${i + 2} are in correct order`);
    }
  }

  // Final validation
  console.log(`Validation complete. Total same-minute pairs: ${sameMinuteCount}, total errors: ${errorCount}`);
  console.log('First 100 Hacker News articles validated (newest → oldest)');

  expect(errorCount).toBe(0);
});



