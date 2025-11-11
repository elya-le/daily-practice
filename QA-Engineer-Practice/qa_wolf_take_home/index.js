// edit this file to complete assignment question 1
const { chromium } = require("playwright");
const fs = require('fs');

// --- 1. configuration constants ---
const CONFIG = {
  TARGET_ARTICLES: 100,          // number of articles to collect
  PAGE_LOAD_TIMEOUT: 2000,       // wait time for page content to load
  NAVIGATION_TIMEOUT: 15000,     // max time to wait for page navigation
  BROWSER_TIMEOUT: 30000,        // max time to wait for browser actions
  HEADLESS: false,               // run browser in headless mode or not
  EXPORT_DATA: true              // whether to export collected data to a file
};

// --- helper functions ---

// convert timestamp text to minutes for comparison
function parseTimeToMinutes(timeString) {
  if (!timeString) return Infinity;

  const match = timeString.match(/(\d+)\s+(minute|hour|day)s?\s+ago/);
  if (!match) return Infinity;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'minute': return value;
    case 'hour': return value * 60;
    case 'day': return value * 60 * 24;
    default: return Infinity;
  }
}

// validate articles are sorted newest to oldest
function validateSorting(articles) {
  let isValid = true;
  let violations = [];

  for (let i = 0; i < articles.length - 1; i++) {
    const current = articles[i];
    const next = articles[i + 1];

    if (parseTimeToMinutes(current.timestamp) > parseTimeToMinutes(next.timestamp)) {
      isValid = false;
      violations.push({
        position: i + 1,
        current: current.timestamp,
        next: next.timestamp,
        issue: `article ${i + 1} (${current.timestamp}) is older than article ${i + 2} (${next.timestamp})`
      });
    }
  }

  return { isValid, violations };
}

// --- 2. main function to scrape and validate hacker news articles ---
async function sortHackerNewsArticles() {
  const browser = await chromium.launch({ headless: CONFIG.HEADLESS });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("starting hacker news sorting validation...");
    console.log("navigating to https://news.ycombinator.com/newest");

    // navigate to first page
    await page.goto("https://news.ycombinator.com/newest", { 
      waitUntil: 'networkidle',
      timeout: CONFIG.BROWSER_TIMEOUT 
    });

    console.log("page loaded successfully");

    // --- 2a. initialize array to hold articles ---
    let allArticles = [];
    let currentPage = 1;

    // --- 2b. loop until we reach TARGET_ARTICLES ---
    while (allArticles.length < CONFIG.TARGET_ARTICLES) {
      console.log(`collecting articles from page ${currentPage}...`);

      // wait for content to load
      await page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);

      // select all article title elements on the page
      const articleElements = await page.locator('tr .titleline').all();

      // extract timestamp for each article
      for (let i = 0; i < articleElements.length; i++) {
        const articleRow = articleElements[i].locator('xpath=ancestor::tr');
        const nextRow = articleRow.locator('xpath=following-sibling::tr[1]');
        const timeText = await nextRow.locator('text=/\\d+\\s+(minute|hour|day)s?\\s+ago/').first().textContent();

        allArticles.push({
          index: allArticles.length + 1,
          timestamp: timeText || 'no timestamp found',
          page: currentPage
        });

        if (allArticles.length >= CONFIG.TARGET_ARTICLES) {
          break;
        }
      }

      console.log(`total articles collected so far: ${allArticles.length}`);

      // --- 2c. navigate to next page if needed ---
      if (allArticles.length < CONFIG.TARGET_ARTICLES) {
        const moreButton = page.locator('a.morelink');

        if (await moreButton.count() > 0) {
          console.log("clicking more button to go to next page...");
          await moreButton.click();
          await page.waitForLoadState('networkidle', { timeout: CONFIG.NAVIGATION_TIMEOUT });
          currentPage++;
        } else {
          console.log("no more pages available");
          break;
        }
      }
    }

    // --- 2d. trim to exactly TARGET_ARTICLES ---
    allArticles = allArticles.slice(0, CONFIG.TARGET_ARTICLES);

    console.log("final list of articles:");
    console.log(allArticles);

    // --- 2e. validate sorting ---
    console.log("validating sorting of collected articles...");
    const validationResult = validateSorting(allArticles);

    if (validationResult.isValid) {
      console.log("all articles are properly sorted newest to oldest");
    } else {
      console.log(`found ${validationResult.violations.length} sorting violations:`);
      validationResult.violations.forEach(v => console.log(`- ${v.issue}`));
    }

  } catch (error) {
    console.error("script failed:", error.message);
  } finally {
    await browser.close();
    console.log("browser closed");
  }
}

// run the main function
(async () => {
  await sortHackerNewsArticles();
})();
