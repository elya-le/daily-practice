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
  await expect(page.locator("span.age").first()).toBeVisible(); 

  const maxArticles = 100; // set max number of articles to validate
  const timestamps = [];  // empty array to hold timestamps or null for failed articles
  let pageNumber = 1;    // track which page we're on for summary logging

  // other counters for summary report
  let sameMinuteCount = 0;       // number of article pairs in the same minute
  let errorCount = 0;            // number of timestamp extraction errors

  // loop until we have 100 articles
  while (timestamps.length < maxArticles) { 
    
    const ageSpans = page.locator("span.age");  // get all timestamp age elements from the page            
    const count = await ageSpans.count();  // count how many timestamp elements on the page
    console.log(`${count} timestamps loaded on page ${pageNumber}`);

    // if no timestamps are found, something went wrong (e.g., end of pagination), prevent infinite loop
    if (count === 0) { 
      throw new Error("Unable to load more articles. No timestamps found on page.");
    }

    // calculate how many more articles we need from THIS page
    const remainingNeeded = maxArticles - timestamps.length;
    const articlesToFetchThisPage = Math.min(count, remainingNeeded);

    const totalLog = timestamps.length + articlesToFetchThisPage < maxArticles ? '' : ` (${timestamps.length + articlesToFetchThisPage}/${maxArticles} total)`;
    console.log(`Extracting ${articlesToFetchThisPage} articles from page ${pageNumber}${totalLog}`);

    // Batch extraction of title attributes
    // extract title attributes directly from <span class="age">
    const attributes = await ageSpans.evaluateAll(spans =>    
      spans.map(span => span.getAttribute('title') || null)
    );


    // loop through the attributes array
    for (let i = 0; i < attributes.length && timestamps.length < maxArticles; i++) {
      const attribute = attributes[i];
      const articleNumber = timestamps.length + 1;

      // handle missing title edge case
      if (!attribute) {
        console.error(`[validation] Article #${articleNumber}: missing title attribute`);
        timestamps.push(null);
        errorCount++;
        continue;
      }

      // extract just the Unix epoch number (the second part after the space)
      const epochMatch = attribute.match(/(\d+)$/);
      if (!epochMatch) {
        console.error(`[validation] Article #${articleNumber}: regex failed on "${attribute}"`);
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
        console.log(`Loading next page...`);
        
        // strict mode requires exact text match to avoid matching article titles like "Shuffle: Making Random Feel More Human"
        const moreButton = page.getByRole("link", { name: "More", exact: true });
        await expect(moreButton).toBeVisible(); 
        
        await moreButton.click();
        
        // wait for new articles to appear after clicking
        await expect(page.getByRole("link", { name: /ago/i }).first()).toBeVisible();
        
        pageNumber++;
        
      } catch (err) {
        throw new Error(`Failed to load more articles. Collected ${timestamps.length}/${maxArticles}. ${err.message}`);
      }
    }
  }

  console.log(`\nValidating sort order on ${timestamps.length} articles...\n`);

  // validate that articles are sorted from newest to oldest
  for (let i = 0; i < timestamps.length - 1; i++) {
    const current = timestamps[i];
    const next = timestamps[i + 1];
  
    // if either timestamp is invalid, log a warning and skip comparison
    if (current === null || next === null) {
      console.warn(`  Article #${i + 1} or #${i + 2}: skipped (missing timestamp)`);
      continue;
    }
  
    if (current < next) { // if the current article is older than the next one, the list is out of order
      console.error(`  ✗ Article #${i + 1} (${current}s) > Article #${i + 2} (${next}s): OUT OF ORDER`);
      errorCount++;
    } else if (Math.abs(current - next) < 60) { // if two articles were posted within 1 minute of each other
      sameMinuteCount++;
    }
  }

  // final message once all 100 articles are validated
  console.log(`\n════════════════════════════════════════`);
  console.log(`Validation Results`);
  console.log(`════════════════════════════════════════`);
  console.log(`Articles validated: ${timestamps.length}`);
  console.log(`Same-minute pairs: ${sameMinuteCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Status: ${errorCount === 0 ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`════════════════════════════════════════\n`);
  
  await browser.close();
}

(async () => {
  try {
    await sortHackerNewsArticles();
  } catch (err) {
    console.error(`\nTest failed: ${err.message}\n`);
    process.exit(1);
  }
})();