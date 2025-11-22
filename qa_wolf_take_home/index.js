const { chromium } = require("playwright");
const { expect } = require("@playwright/test");

async function sortHackerNewsArticles() {
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  await page.goto("https://news.ycombinator.com/newest");

  // wait for first article to be visible before counting
  // this ensures the page is fully rendered, not just DOM-loaded
  await expect(page.locator("span.age").first()).toBeVisible(); // <- this line has been updated

  const maxArticles = 100; // set max number of articles to validate
  const timestamps = [];  // empty array to hold timestamps or null for failed articles

  // counters for summary report
  let sameMinuteCount = 0;       // number of article pairs in the same minute
  let errorCount = 0;            // number of timestamp extraction errors

  // loop until we have 100 articles
  while (timestamps.length < maxArticles) { 
    
    const ageSpans = page.locator("span.age");              // <- this line has been updated
    const count = await ageSpans.count();                   // <- this line has been updated

    console.log(`Page loaded. Found ${count} timestamps.`);

    // if no timestamps are found, something went wrong (e.g., end of pagination), prevent infinite loop
    if (count === 0) { 
      throw new Error("Unable to load more articles. No timestamps found on page.");
    }

    // Calculate how many more articles we need from THIS page
    const remainingNeeded = maxArticles - timestamps.length;
    const articlesToFetchThisPage = Math.min(count, remainingNeeded);

    console.log(`Extracting ${articlesToFetchThisPage} articles from this page. Total so far: ${timestamps.length}/${maxArticles}`);

    // Batch extraction of title attributes
    // extract title attributes directly from <span class="age">
    const attributes = await ageSpans.evaluateAll(spans =>    // <- this line has been updated
      spans.map(span => span.getAttribute('title') || null)
    );


    // loop through the attributes array
    for (let i = 0; i < attributes.length && timestamps.length < maxArticles; i++) {
      const attribute = attributes[i];

      // debug: log what we actually fetched
      console.log(`Article ${timestamps.length + 1} timestamp:`, attribute);

      // handle missing title edge case
      if (!attribute) {
        console.error(`Article ${timestamps.length + 1} has NO title attribute at all`);
        // no need to evaluate parentSpan in browser anymore since we already fetched attributes
        timestamps.push(null); // still count it toward 100 articles
        errorCount++;
        continue; // move to the next link
      }

      // extract just the Unix epoch number (the second part after the space)
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

    // if we still need more articles, click the "More" button
    if (timestamps.length < maxArticles) {
      try {
        console.log(`\nProcessed ${timestamps.length} articles. Need ${maxArticles - timestamps.length} more. Loading next page...`);
        
        // strict mode requires exact text match to avoid matching article titles like "Shuffle: Making Random Feel More Human"
        const moreButton = page.getByRole("link", { name: "More", exact: true });
        await expect(moreButton).toBeVisible(); 
        
        await moreButton.click();
        
        // wait for new articles to appear after clicking
        await expect(page.getByRole("link", { name: /ago/i }).first()).toBeVisible();
        
      } catch (err) {
        throw new Error(`Failed to load more articles. Only collected ${timestamps.length} out of ${maxArticles} required articles. Error: ${err.message}`);
      }
    }
  }

  // convert all valid timestamps to milliseconds for comparison
  const epochList = timestamps.map(t => (t === null ? null : new Date(t * 1000).getTime()));

  // validate that articles are sorted from newest to oldest
  for (let i = 0; i < epochList.length - 1; i++) {
    const current = epochList[i];
    const next = epochList[i + 1];

    // if either timestamp is invalid, log a warning and skip comparison
    if (current === null || next === null) {
      console.warn(`Article ${i + 1} or ${i + 2} skipped due to missing timestamp`);
      continue;
    }

    if (current < next) { // if the current article is older than the next one, the list is out of order
      console.error(`Articles ${i + 1} and ${i + 2} are out of order`);
      errorCount++;
    } else if (Math.abs(current - next) < 60_000) { // if two articles were posted within 1 minute of each other
      console.log(`Pass: Articles ${i + 1} and ${i + 2} are in correct order but flagged for same minute`);
      sameMinuteCount++;
    } else { // otherwise, they are in correct order
      console.log(`Pass: Articles ${i + 1} and ${i + 2} are in correct order`);
    }
  }

  // final message once all 100 articles are validated
  console.log(`Validation complete. Total same-minute pairs: ${sameMinuteCount}, total errors: ${errorCount}`);
  console.log("First 100 Hacker News articles validated (newest → oldest)");
  await browser.close();
}

(async () => {
  try {
    await sortHackerNewsArticles();
  } catch (err) {
    console.error(err.message); // surface thrown error clearly and exit non-zero for CI
    process.exit(1);
  }
})();








