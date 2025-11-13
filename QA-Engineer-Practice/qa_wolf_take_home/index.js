/*
QA Wolf Take Home Assignment - Hacker News Article Date Validator

Objective:
- Verify that the 'newest' page of Hacker News is sorted from newest to oldest
- Collect timestamps for the first 100 posts
- Detect any out-of-order posts
- Provide a live dashboard for monitoring progress
- Log errors professionally
- Generate detailed HTML reports for presentation
*/

// --- Imports ---
const { chromium } = require("playwright");
const fs = require('fs');
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');

// --- Configuration Constants ---
const CONFIG = {
  TARGET_ARTICLES: 100,
  PAGE_LOAD_TIMEOUT: 200,
  NAVIGATION_TIMEOUT: 15000,
  BROWSER_TIMEOUT: 30000,
  HEADLESS: false,
  EXPORT_DATA: true,
  AUTO_OPEN_DASHBOARD: true,
  RUNS: 3
};

// --- Dashboard Setup ---
const app = express();
const PORT = 3000;

let dashboardData = {
  articlesCollected: 0,
  totalArticles: CONFIG.TARGET_ARTICLES,
  currentPage: 0,
  validationStatus: 'In Progress',
  errors: [],
  violations: [],
  currentRun: 0
};

// --- Helper Functions ---
function openInBrowser(url) {
  const platform = process.platform;
  let command;
  if (platform === 'darwin') command = `open ${url}`;
  else if (platform === 'win32') command = `start ${url}`;
  else command = `xdg-open ${url}`;

  exec(command, error => {
    if (error) console.error(`Failed to open URL: ${error.message}`);
    else console.log(`Dashboard opened in browser: ${url}`);
  });
}

function logError(type, step, page, message) {
  const errObj = {
    timestamp: new Date().toISOString(),
    type,
    step,
    page,
    message
  };
  dashboardData.errors.push(errObj);
  try { fs.appendFileSync('error-log.json', JSON.stringify(errObj) + '\n'); }
  catch(e) { console.error('Failed to write error log:', e.message); }
  console.error(`[ERROR] ${type} at ${step} (page ${page}): ${message}`);
}

function parseTimeToMinutes(timeText) {
  if (!timeText) return 0;
  const match = timeText.match(/(\d+)\s+(minute|hour|day)s?\s+ago/);
  if (!match) return 0;
  const value = parseInt(match[1]);
  const unit = match[2];
  if (unit === 'minute') return value;
  if (unit === 'hour') return value * 60;
  if (unit === 'day') return value * 24 * 60;
  return 0;
}

const TIME_TOLERANCE = 2;
function validateSorting(allArticles) {
  const violations = [];
  let isValid = true;
  for (let i = 1; i < allArticles.length; i++) {
    const currentMinutes = parseTimeToMinutes(allArticles[i].timestamp);
    const previousMinutes = parseTimeToMinutes(allArticles[i - 1].timestamp);
    if (currentMinutes + TIME_TOLERANCE < previousMinutes) {
      violations.push({
        issue: `Article #${i + 1} (${allArticles[i].timestamp}) is newer than Article #${i} (${allArticles[i - 1].timestamp})`
      });
      isValid = false;
    }
  }
  return { isValid, violations };
}

// --- Dashboard Route ---
app.get('/', (req, res) => {
  const progressPercent = Math.floor((dashboardData.articlesCollected / dashboardData.totalArticles) * 100);
  let validationHtml = '';
  if (dashboardData.errors.length > 0) {
    const errorMessages = dashboardData.errors.map(e => `${e.type}: ${e.message}`).join('<br>');
    validationHtml = `<p class="errors">Errors:<br>${errorMessages}</p>`;
  } else if (dashboardData.articlesCollected === dashboardData.totalArticles) {
    if (dashboardData.validationStatus === 'Passed') {
      validationHtml = `<p>Validation Status: <span class="passed">Passed ✔</span><br>The most recent ${CONFIG.TARGET_ARTICLES} articles are ordered from newest to oldest.</p>`;
    } else {
      validationHtml = `<p>Validation Status: Failed — ${dashboardData.validationStatus.replace('Failed with ', '')} sorting issue(s) detected</p>`;
      if (dashboardData.violations && dashboardData.violations.length > 0) {
        const violationList = dashboardData.violations.map(v => `- ${v.issue}`).join('<br>');
        validationHtml += `<p style="margin-top:5px;">${violationList}</p>`;
      }
    }
  } else {
    validationHtml = `<p>Validation Status: ${dashboardData.validationStatus}</p>`;
  }

  res.send(`
<html>
  <head>
    <title>Date Validator</title>
    <style>
      body { font-family: arial, sans-serif; background: #0D0F24; padding: 20px; }
      h1 { color: #333; text-align: center; }
      p { font-size: 16px; margin: 5px 0; }
      .dashboard { background: #fff; padding: 20px; border-radius: 10px; width: 640px; }
      .progress-container { display: flex; flex-direction: column; gap: 10px; }
      .progress-details { display: flex; justify-content: space-between; align-items: center; }
      .progress-details .article-count, .progress-details .page-count { flex: 1; }
      .article-count { text-align: right; }
      .progress-bar-container { background: #eee; border-radius: 5px; width: 100%; height: 30px; }
      .progress-bar { background: #00F2C8; height: 100%; width: ${progressPercent}%; border-radius: 5px; text-align: center; padding-left: 2px; color: white; line-height: 30px; }
      .error-container { min-height: 45px; margin-top: 10px; }
      .errors { color: red; font-weight: bold; margin: 0; }
      .passed { color: black; font-weight: bold; }
    </style>
    <meta http-equiv="refresh" content="2">
  </head>
  <body>
    <div class="dashboard">
      <h1>QA Wolf - Article Date Validator${dashboardData.currentRun ? ` - Run #${dashboardData.currentRun}` : ''}</h1>
      <div class="progress-container">
        <div class="progress-details">
          <div class="page-count">Current Page: ${dashboardData.currentPage}</div>
          <div class="article-count">Articles Collected: ${dashboardData.articlesCollected} / ${dashboardData.totalArticles}</div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar">${progressPercent}%</div>
        </div>
      </div>
      <div class="error-container">${validationHtml}</div>
    </div>
  </body>
</html>
  `);
});

// API endpoints (optional)
app.get('/api/status', (req, res) => res.json(dashboardData));
app.post('/api/update', express.json(), (req, res) => { Object.assign(dashboardData, req.body); res.json({ success: true }); });

app.listen(PORT, () => {
  const dashboardUrl = `http://localhost:${PORT}`;
  console.log(`Dashboard running at ${dashboardUrl}`);
  if (CONFIG.AUTO_OPEN_DASHBOARD) setTimeout(() => openInBrowser(dashboardUrl), 1000);
});

// --- Main Scraping & Validation ---
async function sortHackerNewsArticles() {
  const startTime = Date.now();
  let browser = null;

  console.log("Waiting for dashboard to initialize...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    browser = await chromium.launch({ headless: CONFIG.HEADLESS });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("https://news.ycombinator.com/newest", { waitUntil: 'networkidle', timeout: CONFIG.BROWSER_TIMEOUT });

    let allArticles = [];
    let currentPage = 1;

    while (allArticles.length < CONFIG.TARGET_ARTICLES) {
      dashboardData.articlesCollected = allArticles.length;
      dashboardData.currentPage = currentPage;
      dashboardData.validationStatus = 'In Progress';

      await page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);

      let articleElements = [];
      try { articleElements = await page.locator('tr .titleline').all(); }
      catch(e) { logError('ELEMENT_ERROR', 'article_selection', currentPage, e.message); }

      if (!articleElements.length) { 
        logError('SCRAPING_ERROR', 'article_collection', currentPage, `No articles found on page ${currentPage}`);
        break; 
      }

      for (let i = 0; i < articleElements.length; i++) {
        const articleRow = articleElements[i].locator('xpath=ancestor::tr');
        const nextRow = articleRow.locator('xpath=following-sibling::tr[1]');
        let timeText = 'no timestamp found';
        try {
          const ageElement = await nextRow.locator('.age').first();
          if (await ageElement.count() > 0) timeText = await ageElement.textContent();
        } catch (e) { logError('TIMESTAMP_ERROR', 'timestamp_extraction', currentPage, `Failed to extract timestamp for article ${i + 1}: ${e.message}`); }

        allArticles.push({ index: allArticles.length + 1, timestamp: timeText, page: currentPage });
        if (allArticles.length >= CONFIG.TARGET_ARTICLES) break;
      }

      if (allArticles.length < CONFIG.TARGET_ARTICLES) {
        const moreButton = page.locator('a.morelink');
        if (await moreButton.count() > 0) {
          await moreButton.click();
          await page.waitForLoadState('networkidle', { timeout: CONFIG.NAVIGATION_TIMEOUT });
          currentPage++;
        } else break;
      }
    }

    allArticles = allArticles.slice(0, CONFIG.TARGET_ARTICLES);
    dashboardData.articlesCollected = allArticles.length;

    const validationResult = validateSorting(allArticles);
    if (validationResult.isValid) {
      dashboardData.validationStatus = 'Passed';
      dashboardData.violations = [];
    } else {
      dashboardData.validationStatus = `Failed with ${validationResult.violations.length}`;
      dashboardData.violations = validationResult.violations;
    }

    return {
      timestamp: new Date().toISOString(),
      totalArticles: allArticles.length,
      validationPassed: validationResult.isValid,
      violations: validationResult.violations,
      articles: allArticles,
      runDurationSec: ((Date.now() - startTime)/1000).toFixed(2),
      nodeVersion: process.version,
      platform: `${process.platform} ${process.arch}`,
      headlessMode: CONFIG.HEADLESS
    };

  } catch (error) {
    logError('CRITICAL_ERROR', 'main_execution', dashboardData.currentPage, error.message);
    dashboardData.validationStatus = 'Failed due to error';
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); }
      catch(e) { logError('BROWSER_ERROR', 'browser_close', dashboardData.currentPage, e.message); }
    }
  }
}

// --- HTML Report Generator ---
function generateHTMLReport(allRuns) {
  const outputDir = 'test-history';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const latestRun = allRuns[allRuns.length - 1];
  const dateLabel = new Date(latestRun.timestamp).toLocaleString();

  const html = `
<html>
  <head>
    <meta charset="UTF-8">
    <title>QA Wolf Validation Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
      body { font-family: Arial, sans-serif; background: #f5f7fa; color:#222; padding:30px; }
      h1 { text-align: left; color:#333; padding-left:14px; }
      .full-report { display: flex; gap: 20px; flex-wrap: wrap; }
      .full-report > div { flex: 1; min-width: 300px; }
      .summary { background: #fff; padding: 20px; border-radius: 10px; margin-bottom: 30px; }
      .individual-run-summary { background: #fff; padding: 15px; margin-top: 3px; border-radius: 10px; }
      .individual-run-summary p { margin: 6px 0; font-size: 15px; }
      .summary p { margin: 6px 0; font-size: 15px; }
      .run-summary-container { display: flex; flex-direction: column; gap: 5px; max-width: 300px; margin-bottom: 30px; }
      .run-summary-container .summary { padding: 12px 15px; margin-bottom: 0; border-radius: 8px; font-size: 14px; }
      .run-summary-container .summary p { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; font-size: 10px; }
      th, td { padding: 2px 2px; text-align: left; border-bottom: 1px solid #ddd; }
      th { background: #f0f0f0; font-weight: bold; }
      tr:hover { background: #f9f9f9; }
      canvas { margin-top: 20px; background: #fff; border-radius: 8px; padding: 16px; }
      .collected-articles h3 { font-size: 16px; margin: 0 0 6px 0; padding: 0; }
      .collected-articles { background: #fff; padding: 10px 15px; border-radius: 8px; margin-bottom: 30px; max-width: 700px; }
      .article-headers { gap: 20px; }
      .article-headers span { padding-right: 34px; font-size: 13px; font-weight: medium; white-space: nowrap; }
      .articles-columns { column-count: 4; column-gap: 40px; }
      .article-row { break-inside: avoid; padding: 4px 0; border-bottom: 1px solid #ddd; font-size: 12px; display: flex; justify-content: space-between; max-width: 180px; }
      .article-row span { display: inline-block; width: 33%; white-space: nowrap; }
      .index { max-width: 18px; }
      .page { max-width: 12px; }
      .passed { color:#0a0; font-weight:bold; }
      .failed { color:#c00; font-weight:bold; }
      .violations { background:#fff; padding:20px; border-radius:10px; margin-bottom:30px; }
      .violations ul { list-style:disc; padding-left:20px; }
      .violations li { margin-bottom:4px; }
    </style>
  </head>
  <body>
    <h1>QA Wolf – Chronological Sorting Report</h1>
    <div class="full-report">
      <div class="run-summary-container">
        <div class="summary">
          <p><b>Run Date:</b> ${dateLabel}</p>
          <p><b>Number of Runs:</b> ${allRuns.length}</p>
          <p><b>Total Articles per Run:</b> ${latestRun.totalArticles}</p>
        </div>
        ${allRuns.map(run => `
          <div class="individual-run-summary">
            <p><b>Run #${run.runNumber}</b></p>
            <p><b>Status:</b> ${run.validationPassed ? '<span class="passed">PASSED ✔</span>' : '<span class="failed">FAILED ✖</span>'}</p>
            ${run.violations.length>0 ? `<p><b>Violations:</b> ${run.violations.length}</p>` : ''}
            <p><b>Run Duration (sec):</b> ${run.runDurationSec}</p>
            <p><b>Node.js Version:</b> ${run.nodeVersion}</p>
            <p><b>Browser Mode:</b> ${run.headlessMode ? 'Headless' : 'Visible'}</p>
            <p><b>Platform:</b> ${run.platform}</p>
          </div>
        `).join('')}
      </div>

      <div class="collected-articles">
        <h3>Collected Articles from Latest Run</h3>
        <div class="article-headers">
          <span class="index">#</span>
          <span class="timestamp">Time</span>
          <span class="page">Page</span>
        </div>
        <div class="articles-columns">
          ${latestRun.articles.map(a => `
            <div class="article-row">
              <span class="index">${a.index}</span>
              <span class="timestamp">${a.timestamp
                  .replace(/\bhours\b/g,'hrs')
                  .replace(/\bhour\b/g,'hr')
                  .replace(/\bminutes\b/g,'min')
                  .replace(/\bminute\b/g,'min')}
              </span>
              <span class="page">${a.page}</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${latestRun.violations.length > 0 ? `
        <div class="violations">
          <h3>Violations</h3>
          <ul>
            ${latestRun.violations.map(v => `<li>${v.issue}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  </body>
</html>
`;

  const fileName = `report-${Date.now()}.html`;
  const outputPath = path.join(outputDir, fileName);
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`Report generated: ${outputPath}`);

  const platform = process.platform;
  let command;
  if (platform === 'darwin') command = `open "${outputPath}"`;
  else if (platform === 'win32') command = `start "" "${outputPath}"`;
  else command = `xdg-open "${outputPath}"`;
  require('child_process').exec(command, (error) => {
    if (error) console.error('Failed to open report automatically:', error.message);
    else console.log('Report opened in browser.');
    process.exit(0);
  });
}
// --- Run Main Function ---
(async () => {
  const allRuns = [];
  for (let runNumber = 1; runNumber <= CONFIG.RUNS; runNumber++) {
    dashboardData.currentRun = runNumber;
    console.log(`\n=== STARTING RUN ${runNumber} ===\n`);
    const runResult = await sortHackerNewsArticles();
    if (runResult) allRuns.push({ runNumber, ...runResult });
  }

  fs.writeFileSync('validation-results.json', JSON.stringify(allRuns, null, 2));
  console.log(`All ${CONFIG.RUNS} runs saved to validation-results.json`);

  generateHTMLReport(allRuns);
})();



// /*
// QA Wolf Take Home Assignment - Hacker News Article Date Validator

// Objective:
// - Verify that the 'newest' page of Hacker News is sorted from newest to oldest
// - Collect timestamps for the first 100 posts
// - Detect any out-of-order posts
// - Provide a live dashboard for monitoring progress
// - Log errors professionally
// - Generate detailed HTML reports for presentation
// */

// // --- Imports ---
// const { chromium } = require("playwright"); // browser automation for scraping
// const fs = require('fs');                   // filesystem for reading/writing logs and reports
// const express = require('express');         // web server for live dashboard
// const { exec } = require('child_process');  // execute system commands (open browser)
// const path = require('path');               // path utilities for file operations
// const os = require('os');                   // OS information

// // --- Configuration Constants ---
// const CONFIG = {
//   TARGET_ARTICLES: 100,          // Number of articles to collect
//   PAGE_LOAD_TIMEOUT: 200,        // Wait time in ms for page content to load
//   NAVIGATION_TIMEOUT: 15000,     // Max wait time for page navigation
//   BROWSER_TIMEOUT: 30000,        // Max wait time for browser actions
//   HEADLESS: false,               // Run browser in headless mode or visible
//   EXPORT_DATA: true,             // Save JSON of results
//   AUTO_OPEN_DASHBOARD: true,     // Automatically open dashboard in browser
//   RUNS: 3                        // Number of times to validate sorting
// };

// // --- Dashboard Setup ---
// const app = express();  // Initialize Express app for live dashboard
// const PORT = 3000;      // Dashboard port

// // Object to store live dashboard data, updated during scraping and validation
// let dashboardData = {
//   articlesCollected: 0,            // Count of articles collected so far
//   totalArticles: CONFIG.TARGET_ARTICLES,
//   currentPage: 0,                  // Current Hacker News page number being scraped
//   validationStatus: 'In Progress', // Status of validation
//   errors: [],                      // Array to store encountered errors
//   violations: []                   // Array to store sorting violations
// };

// // --- Helper Functions ---

// /**
//  * Open a URL in the system default browser.
//  * Supports macOS, Windows, Linux.
//  */
// function openInBrowser(url) {
//   const platform = process.platform;
//   let command;

//   if (platform === 'darwin') command = `open ${url}`;
//   else if (platform === 'win32') command = `start ${url}`;
//   else command = `xdg-open ${url}`;

//   exec(command, error => {
//     if (error) console.error(`Failed to open URL: ${error.message}`);
//     else console.log(`Dashboard opened in browser: ${url}`);
//   });
// }

// /**
//  * Log errors consistently.
//  * Appends errors to dashboardData and persists them to a JSON log file.
//  */
// function logError(type, step, page, message) {
//   const errObj = {
//     timestamp: new Date().toISOString(),
//     type,
//     step,
//     page,
//     message
//   };
//   dashboardData.errors.push(errObj); // Add to in-memory dashboard
//   try {
//     fs.appendFileSync('error-log.json', JSON.stringify(errObj) + '\n'); // Persist to file
//   } catch (fileError) {
//     console.error('Failed to write error log:', fileError.message);
//   }
//   console.error(`[ERROR] ${type} at ${step} (page ${page}): ${message}`);
// }

// /**
//  * Parse Hacker News relative time strings into minutes.
//  * e.g., '5 minutes ago' → 5, '2 hours ago' → 120
//  */
// function parseTimeToMinutes(timeText) {
//   if (!timeText) return 0;
//   const match = timeText.match(/(\d+)\s+(minute|hour|day)s?\s+ago/);
//   if (!match) return 0;

//   const value = parseInt(match[1]);
//   const unit = match[2];

//   if (unit === 'minute') return value;
//   if (unit === 'hour') return value * 60;
//   if (unit === 'day') return value * 24 * 60;

//   return 0;
// }

// /**
//  * Validate chronological order of collected articles.
//  * Allows a small tolerance to account for inconsistencies in timestamps.
//  */
// const TIME_TOLERANCE = 2; // minutes
// function validateSorting(allArticles) {
//   const violations = [];
//   let isValid = true;

//   for (let i = 1; i < allArticles.length; i++) {
//     const currentMinutes = parseTimeToMinutes(allArticles[i].timestamp);
//     const previousMinutes = parseTimeToMinutes(allArticles[i - 1].timestamp);

//     // Detect out-of-order articles
//     if (currentMinutes + TIME_TOLERANCE < previousMinutes) {
//       violations.push({
//         issue: `Article #${i + 1} (${allArticles[i].timestamp}) is newer than Article #${i} (${allArticles[i - 1].timestamp})`
//       });
//       isValid = false;
//     }
//   }

//   return { isValid, violations };
// }

// // --- Dashboard Routes ---

// // Live dashboard HTML page
// app.get('/', (req, res) => {
//   const progressPercent = Math.floor((dashboardData.articlesCollected / dashboardData.totalArticles) * 100);

//   // Prepare validation/error messages
//   let validationHtml = '';
//   if (dashboardData.errors.length > 0) {
//     const errorMessages = dashboardData.errors.map(e => `${e.type}: ${e.message}`).join('<br>');
//     validationHtml = `<p class="errors">Errors:<br>${errorMessages}</p>`;
//   } else if (dashboardData.articlesCollected === dashboardData.totalArticles) {
//     if (dashboardData.validationStatus === 'Passed') {
//       validationHtml = `<p>Validation Status: <span class="passed">Passed ✔</span><br>The most recent ${CONFIG.TARGET_ARTICLES} articles are ordered from newest to oldest.</p>`;
//     } else {
//       validationHtml = `<p>Validation Status: Failed — ${dashboardData.validationStatus.replace('Failed with ', '')} sorting issue(s) detected</p>`;
//       if (dashboardData.violations && dashboardData.violations.length > 0) {
//         const violationList = dashboardData.violations.map(v => `- ${v.issue}`).join('<br>');
//         validationHtml += `<p style="margin-top:5px;">${violationList}</p>`;
//       }
//     }
//   } else {
//     validationHtml = `<p>Validation Status: ${dashboardData.validationStatus}</p>`;
//   }

//   // Send HTML dashboard
//   res.send(`
//     <html>
//       <head>
//         <title>Date Validator</title>
//         <style>
//           body { font-family: arial, sans-serif; background: #0D0F24; padding: 20px; }
//           h1 { color: #333; text-align: center; }
//           p { font-size: 16px; margin: 5px 0; }
//           .dashboard { background: #fff; padding: 20px; border-radius: 10px; width: 640px; }
//           .progress-container { display: flex; flex-direction: column; gap: 10px; }
//           .progress-details { display: flex; justify-content: space-between; align-items: center; }
//           .progress-details .article-count, .progress-details .page-count { flex: 1; }
//           .article-count { text-align: right; }
//           .progress-bar-container { background: #eee; border-radius: 5px; width: 100%; height: 30px; }
//           .progress-bar { background: #00F2C8; height: 100%; width: ${progressPercent}%; border-radius: 5px; text-align: center; padding-left: 2px; color: white; line-height: 30px; }
//           .error-container { min-height: 45px; margin-top: 10px; }
//           .errors { color: red; font-weight: bold; margin: 0; }
//           .passed { color: black; font-weight: bold; }
//         </style>
//         <meta http-equiv="refresh" content="2">
//       </head>
//       <body>
//         <div class="dashboard">
//           <h1>QA Wolf - Article Date Validator${dashboardData.currentRun ? ` - Run #${dashboardData.currentRun}` : ''}</h1>
//           <div class="progress-container">
//             <div class="progress-details">
//               <div class="page-count">Current Page: ${dashboardData.currentPage}</div>
//               <div class="article-count">Articles Collected: ${dashboardData.articlesCollected} / ${dashboardData.totalArticles}</div>
//             </div>
//             <div class="progress-bar-container">
//               <div class="progress-bar">${progressPercent}%</div>
//             </div>
//           </div>
//           <div class="error-container">${validationHtml}</div>
//         </div>
//       </body>
//     </html>
//   `);
// });

// // API endpoints for dashboard updates (optional external integration)
// app.get('/api/status', (req, res) => res.json(dashboardData));
// app.post('/api/update', express.json(), (req, res) => { Object.assign(dashboardData, req.body); res.json({ success: true }); });

// // Start dashboard server
// app.listen(PORT, () => {
//   const dashboardUrl = `http://localhost:${PORT}`;
//   console.log(`Dashboard running at ${dashboardUrl} (auto-refresh every 2s)`);
//   if (CONFIG.AUTO_OPEN_DASHBOARD) setTimeout(() => openInBrowser(dashboardUrl), 1000);
// });

// // --- Main Scraping & Validation Function ---
// async function sortHackerNewsArticles() {
//   const startTime = Date.now();
//   let browser = null;

//   console.log("Waiting for dashboard to initialize...");
//   await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for dashboard to start

//   try {
//     // Launch browser context
//     browser = await chromium.launch({ headless: CONFIG.HEADLESS });
//     const context = await browser.newContext();
//     const page = await context.newPage();

//     // Navigate to Hacker News 'newest' page
//     console.log("Navigating to Hacker News newest page...");
//     await page.goto("https://news.ycombinator.com/newest", { waitUntil: 'networkidle', timeout: CONFIG.BROWSER_TIMEOUT });

//     let allArticles = [];
//     let currentPage = 1;

//     // Collect articles until target number is reached
//     while (allArticles.length < CONFIG.TARGET_ARTICLES) {
//       dashboardData.articlesCollected = allArticles.length;
//       dashboardData.currentPage = currentPage;
//       dashboardData.validationStatus = 'In Progress';

//       await page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);

//       // Select article elements
//       let articleElements = [];
//       try { articleElements = await page.locator('tr .titleline').all(); } 
//       catch (locatorError) { logError('ELEMENT_ERROR', 'article_selection', currentPage, locatorError.message); }

//       if (!articleElements.length) { 
//         logError('SCRAPING_ERROR', 'article_collection', currentPage, `No articles found on page ${currentPage}`);
//         break; 
//       }

//       // Extract timestamp and metadata for each article
//       for (let i = 0; i < articleElements.length; i++) {
//         const articleRow = articleElements[i].locator('xpath=ancestor::tr');
//         const nextRow = articleRow.locator('xpath=following-sibling::tr[1]');
//         let timeText = 'no timestamp found';
//         try {
//           const ageElement = await nextRow.locator('.age').first();
//           if (await ageElement.count() > 0) timeText = await ageElement.textContent();
//         } catch (e) { logError('TIMESTAMP_ERROR', 'timestamp_extraction', currentPage, `Failed to extract timestamp for article ${i + 1}: ${e.message}`); }

//         allArticles.push({ index: allArticles.length + 1, timestamp: timeText, page: currentPage });
//         if (allArticles.length >= CONFIG.TARGET_ARTICLES) break;
//       }

//       // Navigate to next page if more articles are needed
//       if (allArticles.length < CONFIG.TARGET_ARTICLES) {
//         const moreButton = page.locator('a.morelink');
//         if (await moreButton.count() > 0) {
//           await moreButton.click();
//           await page.waitForLoadState('networkidle', { timeout: CONFIG.NAVIGATION_TIMEOUT });
//           currentPage++;
//         } else break;
//       }
//     }

//     allArticles = allArticles.slice(0, CONFIG.TARGET_ARTICLES);
//     dashboardData.articlesCollected = allArticles.length;

//     // Validate chronological sorting
//     const validationResult = validateSorting(allArticles);
//     if (validationResult.isValid) {
//       dashboardData.validationStatus = 'Passed';
//       dashboardData.violations = [];
//     } else {
//       dashboardData.validationStatus = `Failed with ${validationResult.violations.length}`;
//       dashboardData.violations = validationResult.violations;
//     }

//     // Return structured run result
//     return {
//       timestamp: new Date().toISOString(),
//       totalArticles: allArticles.length,
//       validationPassed: validationResult.isValid,
//       violations: validationResult.violations,
//       articles: allArticles,
//       runDurationSec: ((Date.now() - startTime)/1000).toFixed(2),
//       nodeVersion: process.version,
//       platform: `${process.platform} ${process.arch}`,
//       headlessMode: CONFIG.HEADLESS
//     };

//   } catch (error) {
//     logError('CRITICAL_ERROR', 'main_execution', dashboardData.currentPage, error.message);
//     dashboardData.validationStatus = 'Failed due to error';
//     return null;
//   } finally {
//     // Ensure browser is closed properly
//     if (browser) {
//       try { await browser.close(); } 
//       catch (closeError) { logError('BROWSER_ERROR', 'browser_close', dashboardData.currentPage, closeError.message); }
//     }
//   }
// }

// // --- Run Main Function Multiple Times ---
// (async () => {
//   const allRuns = [];
//   for (let runNumber = 1; runNumber <= CONFIG.RUNS; runNumber++) {
//     dashboardData.currentRun = runNumber;
//     console.log(`\n=== STARTING RUN ${runNumber} ===\n`);
//     const runResult = await sortHackerNewsArticles();
//     if (runResult) allRuns.push({ runNumber, ...runResult });
//   }

//   // Save JSON results of all runs
//   fs.writeFileSync('validation-results.json', JSON.stringify(allRuns, null, 2));
//   console.log(`All ${CONFIG.RUNS} runs saved to validation-results.json`);

//   // Generate HTML report (function not shown here)
//   generateHTMLReport(allRuns);
// })();


// // --- Updated generateHTMLReport for multiple runs ---
// function generateHTMLReport(allRuns) {
//   const outputDir = 'test-history';
//   if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

//   // Historical trend (previous reports)
//   const jsonFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));
//   const trend = [];
//   jsonFiles.forEach(f => {
//     try {
//       const r = JSON.parse(fs.readFileSync(path.join(outputDir,f)));
//       r.forEach(run => {
//         trend.push({ date: new Date(run.timestamp).toLocaleDateString(), violations: run.violations.length, passed: run.validationPassed });
//       });
//     } catch(e){}
//   });

//   // Include current runs
//   allRuns.forEach(run => trend.push({ date: new Date(run.timestamp).toLocaleDateString(), violations: run.violations.length, passed: run.validationPassed }));

//   const latestRun = allRuns[allRuns.length - 1];

//   const dateLabel = new Date(latestRun.timestamp).toLocaleString();
//   const browserModeText = latestRun.headlessMode ? 'Headless (background, invisible)' : 'Visible (browser window shown)';
//   let platformText = latestRun.platform;
//   if (platformText.startsWith('darwin')) platformText = 'macOS';
//   else if (platformText.startsWith('win32')) platformText = 'Windows';
//   else if (platformText.startsWith('linux')) platformText = 'Linux';
//   const osArch = require('os').arch();
//   platformText += ` (${osArch})`;

//   const fileName = `report-${Date.now()}.html`;
//   const outputPath = path.join(outputDir, fileName);

//   const html = `
//     <html>
//       <head>
//         <meta charset="UTF-8">
//         <title>QA Wolf Validation Report</title>
//         <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
//         <style>
//           body { font-family: Arial, sans-serif; background: #f5f7fa; color:#222; padding:30px; }
//           h1 { text-align: left; color:#333; padding-left:14px; }
//           .full-report {
//             display: flex;
//             gap: 20px; /* space between columns */
//             flex-wrap: wrap; /* wrap on small screens */
//           }
//           .full-report > div {
//             flex: 1; /* each child takes equal space */
//             min-width: 300px; /* prevent shrinking too small */
//           }
//           .summary { 
//             background: #fff; 
//             padding: 20px; 
//             border-radius: 10px; 
//             margin-bottom: 30px;
//           }
//           .individual-run-summary {
//             background: #fff; 
//             padding: 15px; 
//             margin-top: 3px;
//             border-radius: 10px; 
//           }
//           .individual-run-summary p {
//             margin: 6px 0;      
//             font-size: 15px;     /* optional: slightly smaller text */
//           }
//           .summary p { 
//             margin: 6px 0; 
//             font-size: 15px; 
//           }
//           .run-summary-container {
//             display: flex;
//             flex-direction: column; /* stack vertically */
//             gap: 5px; 
//             max-width: 300px; 
//             margin-bottom: 30px;
//           }
//           .run-summary-container .summary {
//             padding: 12px 15px; 
//             margin-bottom: 0; 
//             border-radius: 8px; 
//             font-size: 14px;
//           }
//           .run-summary-container .summary p {
//             margin: 4px 0; 
//           }
//           table { 
//             width: 100%; 
//             border-collapse: collapse; 
//             background: #fff; 
//             border-radius: 8px; 
//             overflow: hidden; 
//             font-size: 10px; 
//           }
//           th, td { 
//             padding: 2px 2px; 
//             text-align: left; 
//             border-bottom: 1px solid #ddd; 
//           }
//           th { 
//             background: #f0f0f0; 
//             font-weight: bold; 
//           }
//           tr:hover { 
//             background: #f9f9f9; 
//           }
//           canvas { 
//             margin-top: 20px; 
//             background: #fff; 
//             border-radius: 8px; 
//             padding: 16px; 
//           }
//           .collected-articles h3 {
//             font-size: 16px;
//             margin: 0 0 6px 0; 
//             padding: 0;
//           }
//           .collected-articles {
//             background: #fff;
//             padding: 10px 15px;
//             border-radius: 8px;
//             margin-bottom: 30px;
//             max-width: 700px;
//           }
//           .article-headers {
//             gap: 20px;
//           }
//           .article-headers span {
//             padding-right: 34px; 
//             font-size: 13px;
//             font-weight: medium;
//             white-space: nowrap;
//           }
//           .articles-columns {
//             column-count: 4;      /* split articles into 4 vertical columns */
//             column-gap: 40px;     /* spacing between columns */
//           }
//           .article-row {
//             break-inside: avoid;  /* prevent row from splitting across columns */
//             padding: 4px 0;       
//             border-bottom: 1px solid #ddd; 
//             font-size: 12px;      
//             display: flex;        
//             justify-content: space-between; 
//             max-width: 180px;
//           }
//           .article-row span {
//             display: inline-block;
//             width: 33%;           
//             white-space: nowrap;
//           }
//           .index {
//           max-width: 18px;
//           }
//           .page {
//           max-width: 12px;}
//           .passed { color:#0a0; font-weight:bold; }
//           .failed { color:#c00; font-weight:bold; }
//           .violations { background:#fff; padding:20px; border-radius:10px; margin-bottom:30px; }
//           .violations ul { list-style:disc; padding-left:20px; }
//           .violations li { margin-bottom:4px; }
//         </style>
//       </head>
//       <body>
//         <h1>QA Wolf – Chronological Sorting Report</h1>
//         <div class="full-report">
//           <div class="run-summary-container">
//             <div class="summary">
//               <p><b>Run Date:</b> ${dateLabel}</p>
//               <p><b>Number of Runs:</b> ${allRuns.length}</p>
//               <p><b>Total Articles per Run:</b> ${latestRun.totalArticles}</p>
//             </div>
//             ${allRuns.map(run => `
//               <div class="individual-run-summary">
//                 <p><b>Run #${run.runNumber}</b></p>
//                 <p><b>Status:</b> ${run.validationPassed ? '<span class="passed">PASSED ✔</span>' : '<span class="failed">FAILED ✖</span>'}</p>
//                 ${run.violations.length>0?`<p><b>Violations:</b> ${run.violations.length}</p>`:''}
//                 <p><b>Run Duration (sec):</b> ${run.runDurationSec}</p>
//                 <p><b>Node.js Version:</b> ${run.nodeVersion}</p>
//                 <p><b>Browser Mode:</b> ${run.headlessMode ? 'Headless' : 'Visible'}</b></p>
//                 <p><b>Platform:</b> ${run.platform}</p>
//               </div>
//             `).join('')}
//           </div>
//           <div class="collected-articles">
//             <h3>Collected Articles from Lattes Run</h3>
//             <div class="article-headers">
//               <span class="index">#</span>
//               <span class="timestamp">Time</span>
//               <span class="page">Page</span>
//             </div>

//             <div class="articles-columns">
//               ${latestRun.articles.map(a => `
//                 <div class="article-row">
//                   <span class="index">${a.index}</span>
//                   <span class="timestamp">
//                     ${a.timestamp
//                       .replace(/\bhours\b/g,'hrs')
//                       .replace(/\bhour\b/g,'hr')
//                       .replace(/\bminutes\b/g,'min')
//                       .replace(/\bminute\b/g,'min')} 
//                   </span>
//                   <span class="page">${a.page}</span>
//                 </div>
//               `).join('')}
//             </div>
//           </div>
              
//         </div>
//       </body>
//     </html>
//   `;

//   fs.writeFileSync(outputPath, html, 'utf-8');
//   console.log(`Report generated: ${outputPath}`);

//   // --- Open the report automatically ---
//   const platform = process.platform;
//   let command;
//   if (platform === 'darwin') command = `open "${outputPath}"`;        // macOS
//   else if (platform === 'win32') command = `start "" "${outputPath}"`; // Windows
//   else command = `xdg-open "${outputPath}"`;                           // Linux

//   require('child_process').exec(command, (error) => {
//     if (error) console.error('Failed to open report automatically:', error.message);
//     else console.log('Report opened in browser.');
//     process.exit(0); // clean exit from Node
//   });
// }
