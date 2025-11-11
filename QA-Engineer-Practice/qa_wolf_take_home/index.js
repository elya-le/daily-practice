/*
qa objective:
- verify the 'newest' page of hacker news is sorted from newest to oldest
- collect timestamps for first 100 posts
- detect any out-of-order posts
- report progress live in a dashboard
- log and visualize results for client presentation
*/

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

// --- 2. set up express dashboard ---
const app = express(); // initialize express app
const PORT = 3000; // port to run dashboard

// object to store live dashboard data
let dashboardData = {
  articlesCollected: 0,          // how many articles collected so far
  totalArticles: CONFIG.TARGET_ARTICLES, // total target articles
  currentPage: 0,                // current page number being scraped
  validationStatus: 'In Progress', // status of sorting validation
  errors: [],                     // array to store any errors encountered
  violations: []                  // store sorting violations
};

// serve styled dashboard page with live updates
app.get('/', (req, res) => {
  const progressPercent = Math.floor((dashboardData.articlesCollected / dashboardData.totalArticles) * 100);

  // check if there are any errors collected in the dashboard
  let validationHtml = '';
  if (dashboardData.errors.length > 0) {
    // if there are errors, display them in red
    validationHtml = `<p class="errors">Errors: ${dashboardData.errors.join(', ')}</p>`;
  } else if (dashboardData.articlesCollected === dashboardData.totalArticles) {
    // if all target articles have been collected
    if (dashboardData.validationStatus === 'Passed') {
      // if validation passed, display 'Passed' and details in black
      validationHtml = `<p>Validation Status: <span class="passed">Passed</span><span class="passed-details"> - The most recent 100 articles are ordered from newest to oldest.</span></p>`;
    } else {
      // if validation failed, extract the number of issues and display in readable format
      validationHtml = `<p>Validation Status: Failed — ${dashboardData.validationStatus.replace('Failed with ', '')} sorting issue(s) detected</p>`;

      // display each violation like terminal
      if (dashboardData.violations && dashboardData.violations.length > 0) {
        const violationList = dashboardData.violations.map(v => `- ${v.issue}`).join('<br>');
        validationHtml += `<p style="margin-top:5px;">${violationList}</p>`;
      }
    }
  } else {
    // if articles are still being collected or validation not complete, display current status
    validationHtml = `<p>Validation Status: ${dashboardData.validationStatus}</p>`;
  }

  // dashboard html with complete styling
  res.send(`
    <html>
      <head>
        <title>Hacker News Sorting Validation Dashboard</title>
        <style>
          body { 
            font-family: arial, sans-serif; 
            background: #0D0F24; 
            padding: 20px; 
          }
          h1 { 
            color: #333; 
            text-align: center;     
          }
          p { font-size: 16px; margin: 5px 0; }
          .dashboard { 
            background: #fff; 
            padding: 20px; 
            border-radius: 10px;  
            width: 640px; 
          }
          .progress-bar-container { 
            background: #eee; 
            border-radius: 5px; 
            width: 100%; 
            height: 30px; 
            margin: 10px 0; 
          }
          .progress-bar { 
            background: #00F2C8; 
            height: 100%; 
            width: ${progressPercent}%; 
            border-radius: 5px; 
            text-align: center;
            padding-left: 2px;
            color: white; 
            line-height: 30px; 
          }
          .error-container { 
            min-height: 45px;     
            margin-top: 10px;
          }
          .errors { 
            color: red; 
            font-weight: bold; 
            margin: 0; 
          }
          .passed {
            color: black;
            font-weight: bold;
          }
          .passed-details {
            color: #333;
            font-weight: normal;
          }
        </style>
        <meta http-equiv="refresh" content="2">
      </head>
      <body>
        <div class="dashboard">
          <h1>QA Wolf - Hacker News Sorting Validation</h1>
          <div class="progress-bar-container">
            <div class="progress-bar">${progressPercent}%</div>
          </div>
          <p>Articles Collected: ${dashboardData.articlesCollected} / ${dashboardData.totalArticles}</p>
          <p>Current Page: ${dashboardData.currentPage}</p>
          <div class="error-container">
            ${validationHtml}
          </div>
        </div>
      </body>
    </html>
  `);
});

// api endpoint to get dashboard data as json
app.get('/api/status', (req, res) => {
  res.json(dashboardData);
});

// api endpoint to update dashboard data
app.post('/api/update', express.json(), (req, res) => {
  // update dashboard data with incoming data
  Object.assign(dashboardData, req.body);
  res.json({ success: true });
});

// start the dashboard server
app.listen(PORT, () => {
  console.log(`dashboard running at http://localhost:${PORT}`);
  console.log('the dashboard will auto-refresh every 2 seconds');
});

// helper function to parse time strings to minutes
function parseTimeToMinutes(timeText) {
  // convert "5 minutes ago", "2 hours ago", "1 day ago" to total minutes
  if (!timeText) return 0;
  
  const match = timeText.match(/(\d+)\s+(minute|hour|day)s?\s+ago/);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  // convert to minutes based on unit
  if (unit === 'minute') return value;
  if (unit === 'hour') return value * 60;
  if (unit === 'day') return value * 24 * 60;
  
  return 0;
}

// this is new code: validation function to check if articles are sorted
function validateSorting(allArticles) {
  const violations = [];
  let isValid = true;
  
  // check each article against the previous one
  for (let i = 1; i < allArticles.length; i++) {
    const currentMinutes = parseTimeToMinutes(allArticles[i].timestamp);
    const previousMinutes = parseTimeToMinutes(allArticles[i - 1].timestamp);
    
    // if current article is older than previous one, it's valid (newest first)
    // if current has more minutes than previous, it's older
    if (currentMinutes < previousMinutes) {
      violations.push({
        issue: `Article #${i + 1} (${allArticles[i].timestamp}) is newer than Article #${i} (${allArticles[i - 1].timestamp})`
      });
      isValid = false;
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
      // update dashboard live data
      dashboardData.articlesCollected = allArticles.length;
      dashboardData.currentPage = currentPage;
      dashboardData.validationStatus = 'In Progress';

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
        
        // fixed the regex pattern
        let timeText = 'no timestamp found';
        try {
          const ageElement = await nextRow.locator('.age').first();
          if (await ageElement.count() > 0) {
            timeText = await ageElement.textContent();
          }
        } catch (e) {
          // fallback if timestamp not found
        }

        allArticles.push({
          index: allArticles.length + 1, // index for ordering
          timestamp: timeText, // store the timestamp
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

    console.log("Final list of articles:");
    console.log(allArticles);

    // validate sorting and store violations for dashboard
    console.log("Validating sorting of collected articles...");
    const validationResult = validateSorting(allArticles);

    if (validationResult.isValid) {
      console.log("All 100 articles are properly sorted newest to oldest");
      dashboardData.validationStatus = 'Passed';
      dashboardData.violations = []; // clear violations if any
    } else {
      console.log(`Found ${validationResult.violations.length} sorting violation(s):`);
      validationResult.violations.forEach(v => console.log(`- ${v.issue}`));
      dashboardData.validationStatus = `Failed with ${validationResult.violations.length}`;
      dashboardData.violations = validationResult.violations;
    }

    // export results to json file if configured
    if (CONFIG.EXPORT_DATA) {
      const exportData = {
        timestamp: new Date().toISOString(),
        totalArticles: allArticles.length,
        validationPassed: validationResult.isValid,
        violations: validationResult.violations,
        articles: allArticles
      };
      
      fs.writeFileSync('validation-results.json', JSON.stringify(exportData, null, 2));
      console.log('Results exported to validation-results.json');
    }

  } catch (error) {
    console.error("Script failed:", error.message);
    // log error to dashboard
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