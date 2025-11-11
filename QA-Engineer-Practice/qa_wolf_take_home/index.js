// --- imports ---
const { chromium } = require("playwright"); // playwright for browser automation
const fs = require('fs'); // filesystem module to save data if needed
const express = require('express'); // express to create dashboard server

// --- 1. configuration constants ---
const CONFIG = {
  TARGET_ARTICLES: 100,          // number of articles to collect
  PAGE_LOAD_TIMEOUT: 2000,       // wait time for page content to load
  NAVIGATION_TIMEOUT: 15000,     // max wait time for page navigation
  BROWSER_TIMEOUT: 30000,        // max wait time for browser actions
  HEADLESS: false,               // run browser in headless mode or not
  EXPORT_DATA: true              // whether to export collected data to a file
};

// --- 2. set up Express dashboard ---
const app = express(); // initialize express app
const PORT = 3000; // port to run dashboard

// object to store live dashboard data
let dashboardData = {
  articlesCollected: 0,          // how many articles collected so far
  totalArticles: CONFIG.TARGET_ARTICLES, // total target articles
  currentPage: 0,                // current page number being scraped
  validationStatus: 'Not yet started', // status of sorting validation
  errors: []                     // array to store any errors encountered
};

// -----> this is new code: serve styled dashboard page
app.get('/', (req, res) => {
  const progressPercent = Math.floor((dashboardData.articlesCollected / dashboardData.totalArticles) * 100);

   // determine error display
  let errorsHtml = '';
  if (dashboardData.errors.length > 0) {
    errorsHtml = `<p class="errors">errors: ${dashboardData.errors.join(', ')}</p>`;
  } else if (dashboardData.articlesCollected === dashboardData.totalArticles) {
    errorsHtml = `<p class="errors" style="color: green;">No Errors</p>`;
  }

  res.send(`
    <html>
      <head>
        <title>Hacker News Scraper Dashboard</title>
        <style>
          body { 
            font-family: arial, sans-serif; 
            background: #f5f5f5; 
            padding: 20px; 
          }
          h1 { color: #333; }
          p { font-size: 16px; margin: 5px 0; }
          .dashboard { 
            background: #fff; 
            padding: 20px; 
            border-radius: 10px;  
      
            width: 600px; 
          }
          .progress-bar-container { 
            background: #eee; 
            border-radius: 5px; 
            width: 100%; 
            height: 20px; 
            margin: 10px 0; 
          }
          .progress-bar { 
            background: #4caf50; 
            height: 100%; 
            width: ${progressPercent}%; 
            border-radius: 5px; 
            text-align: center; 
            color: white; 
            line-height: 20px; 
          }
          .error-container {      /* -----> this is new code */
            min-height: 30px;     /* reserve space so layout doesn't shift */
            margin-top: 10px;
          }
          .errors { 
            color: red; 
            font-weight: bold; 
            margin: 0; 
          }
          .no-errors {            /* -----> this is new code */
            color: green; 
            font-weight: bold; 
            margin: 0; 
          }
        </style>
      </head>
      <body>
        <div class="dashboard">
          <h1>Hacker News Scraper Dashboard</h1>
          <div class="progress-bar-container">
            <div class="progress-bar">${progressPercent}%</div>
          </div>
          <p>Articles Collected: ${dashboardData.articlesCollected} / ${dashboardData.totalArticles}</p>
          <p>Current Page: ${dashboardData.currentPage}</p>
          <p>Validation Status: ${dashboardData.validationStatus}</p>

          <div class="error-container"> 
            ${errorsHtml}
          </div>
        </div>
      </body>
    </html>
  `);
});

// start the dashboard server
app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});

// --- 3. helper functions ---

// convert timestamp string like "5 minutes ago" to total minutes
function parseTimeToMinutes(timeString) {
  if (!timeString) return Infinity; // if timestamp missing, return infinity

  const match = timeString.match(/(\d+)\s+(minute|hour|day)s?\s+ago/); // regex to extract number + unit
  if (!match) return Infinity; // return infinity if format does not match

  const value = parseInt(match[1]); // numeric part
  const unit = match[2]; // unit part (minute/hour/day)

  switch (unit) { // convert all units to minutes
    case 'minute': return value;
    case 'hour': return value * 60;
    case 'day': return value * 60 * 24;
    default: return Infinity;
  }
}

// validate that articles are sorted from newest to oldest
function validateSorting(articles) {
  let isValid = true; // assume valid unless a violation is found
  let violations = []; // store violations

  for (let i = 0; i < articles.length - 1; i++) {
    const current = articles[i];
    const next = articles[i + 1];

    // newer articles should have smaller time value
    if (parseTimeToMinutes(current.timestamp) > parseTimeToMinutes(next.timestamp)) {
      isValid = false;
      violations.push({
        position: i + 1,
        current: current.timestamp,
        next: next.timestamp,
        issue: `Article ${i + 1} (${current.timestamp}) is older than article ${i + 2} (${next.timestamp})`
      });
    }
  }

  return { isValid, violations };
}

// --- 4. main scraping and validation function ---
async function sortHackerNewsArticles() {
  const browser = await chromium.launch({ headless: CONFIG.HEADLESS }); // launch browser

  try {
    const context = await browser.newContext(); // create new browser context
    const page = await context.newPage(); // open a new page

    console.log("Starting hacker news sorting validation...");
    console.log("Navigating to https://news.ycombinator.com/newest");

    // navigate to first page
    await page.goto("https://news.ycombinator.com/newest", { 
      waitUntil: 'networkidle',
      timeout: CONFIG.BROWSER_TIMEOUT 
    });

    console.log("Page loaded successfully");

    let allArticles = []; // array to hold all collected articles
    let currentPage = 1;  // track current page

    // loop until target number of articles collected
    while (allArticles.length < CONFIG.TARGET_ARTICLES) {
      // -----> this is new code: update dashboard live data
      dashboardData.articlesCollected = allArticles.length;
      dashboardData.currentPage = currentPage;

      console.log(`Collecting articles from page ${currentPage}...`);
      await page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);

      // select article title elements on the page
      const articleElements = await page.locator('tr .titleline').all();

      // if no articles found, log error and stop scraping
      if (articleElements.length === 0) {
        const errMsg = `No articles found on page ${currentPage}`;
        console.error(errMsg);
        dashboardData.errors.push(errMsg);
        break;
      }

      // extract timestamp for each article
      for (let i = 0; i < articleElements.length; i++) {
        const articleRow = articleElements[i].locator('xpath=ancestor::tr');
        const nextRow = articleRow.locator('xpath=following-sibling::tr[1]');
        const timeText = await nextRow.locator('text=/\\d+\\s+(minute|hour|day)s?\\s+ago/').first().textContent();

        allArticles.push({
          index: allArticles.length + 1, // index for ordering
          timestamp: timeText || 'no timestamp found', // fallback if timestamp missing
          page: currentPage
        });

        if (allArticles.length >= CONFIG.TARGET_ARTICLES) break;
      }

      console.log(`Total articles collected so far: ${allArticles.length}`);

      // navigate to next page if needed
      if (allArticles.length < CONFIG.TARGET_ARTICLES) {
        const moreButton = page.locator('a.morelink');
        if (await moreButton.count() > 0) {
          console.log("Clicking more button to go to next page...");
          await moreButton.click();
          await page.waitForLoadState('networkidle', { timeout: CONFIG.NAVIGATION_TIMEOUT });
          currentPage++;
        } else {
          console.log("No more pages available");
          break;
        }
      }
    }

    // trim exactly to TARGET_ARTICLES
    allArticles = allArticles.slice(0, CONFIG.TARGET_ARTICLES);
    dashboardData.articlesCollected = allArticles.length;

    console.log("final list of articles:");
    console.log(allArticles);

    // -----> this is new code: validate sorting and update dashboard
    console.log("validating sorting of collected articles...");
    const validationResult = validateSorting(allArticles);

    if (validationResult.isValid) {
      console.log("all articles are properly sorted newest to oldest");
      dashboardData.validationStatus = 'Passed';
    } else {
      console.log(`found ${validationResult.violations.length} sorting violations:`);
      validationResult.violations.forEach(v => console.log(`- ${v.issue}`));
      dashboardData.validationStatus = `Failed with ${validationResult.violations.length} issues`;
    }

  } catch (error) {
    console.error("Script failed:", error.message);
    // -----> this is new code: log error to dashboard
    dashboardData.errors.push(error.message);
    dashboardData.validationStatus = 'Failed due to error';
  } finally {
    await browser.close();
    console.log("Browser closed");
  }
}

// --- 5. run main function ---
(async () => {
  await sortHackerNewsArticles();
})();
