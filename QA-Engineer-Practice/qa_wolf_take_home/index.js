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
const { exec } = require('child_process'); 
const path = require('path');
const os = require('os'); // for os info

// --- 1. configuration constants ---
const CONFIG = {
  TARGET_ARTICLES: 100,          // number of articles to collect
  PAGE_LOAD_TIMEOUT: 200,       // wait time for page content to load
  NAVIGATION_TIMEOUT: 15000,     // max wait time for page navigation
  BROWSER_TIMEOUT: 30000,        // max wait time for browser actions
  HEADLESS: false,               // run browser in headless mode or not
  EXPORT_DATA: true,             // whether to export collected data to a file
  AUTO_OPEN_DASHBOARD: true,     // whether to auto-open dashboard in browser
  RUNS: 3                        // number of times to run validation
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

// function to open url in default browser
function openInBrowser(url) {
  const platform = process.platform;
  let command;
  if (platform === 'darwin') command = `open ${url}`;
  else if (platform === 'win32') command = `start ${url}`;
  else command = `xdg-open ${url}`;
  exec(command, (error) => {
    if (error) {
      console.error(`Failed to open dashboard automatically: ${error.message}`);
      console.log(`Please manually open: ${url}`);
    } else {
      console.log(`Dashboard opened in browser: ${url}`);
    }
  });
}

// helper to log errors professionally
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
  catch (fileError) { console.error('Failed to write to error log file:', fileError.message); }
  console.error(`[ERROR] ${type} at ${step} (page ${page}): ${message}`);
}

// serve styled dashboard page with live updates
app.get('/', (req, res) => {
  const progressPercent = Math.floor((dashboardData.articlesCollected / dashboardData.totalArticles) * 100);
  let validationHtml = '';
  if (dashboardData.errors.length > 0) {
    const errorMessages = dashboardData.errors.map(e => `${e.type}: ${e.message}`).join('<br>');
    validationHtml = `<p class="errors">Errors:<br>${errorMessages}</p>`;
  } else if (dashboardData.articlesCollected === dashboardData.totalArticles) {
    if (dashboardData.validationStatus === 'Passed') {
      validationHtml = `<p>Validation Status: <span class="passed">Passed ✔</span><span class="passed-details"> <br> The most recent ${CONFIG.TARGET_ARTICLES} articles are ordered from newest to oldest.</span></p>`;
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
          .passed-details { color: #333; font-weight: normal; }
        </style>
        <meta http-equiv="refresh" content="2">
      </head>
      <body>
        <div class="dashboard">
          <h1>QA Wolf - Article Date Validator</h1>
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

// api endpoints
app.get('/api/status', (req, res) => { res.json(dashboardData); });
app.post('/api/update', express.json(), (req, res) => { Object.assign(dashboardData, req.body); res.json({ success: true }); });

// start server
app.listen(PORT, () => {
  const dashboardUrl = `http://localhost:${PORT}`;
  console.log(`Dashboard running at ${dashboardUrl}`);
  console.log('The dashboard will auto-refresh every 2 seconds');
  if (CONFIG.AUTO_OPEN_DASHBOARD) setTimeout(() => openInBrowser(dashboardUrl), 1000);
});

// helper to parse time strings to minutes
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

// --- validation function with tolerance ---
const TIME_TOLERANCE = 2; // minutes
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

// --- main scraping and validation function ---
async function sortHackerNewsArticles() {
  const startTime = Date.now();
  let browser = null;
  console.log("Waiting for dashboard to initialize...");
  await new Promise(resolve => setTimeout(resolve, 2000));
  try {
    browser = await chromium.launch({ headless: CONFIG.HEADLESS });
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log("Starting hacker news sorting validation...");
    console.log("Navigating to https://news.ycombinator.com/newest");
    try { await page.goto("https://news.ycombinator.com/newest", { waitUntil: 'networkidle', timeout: CONFIG.BROWSER_TIMEOUT }); console.log("Page loaded successfully"); }
    catch (navError) { logError('NAVIGATION_ERROR', 'initial_page_load', 0, navError.message); throw navError; }

    let allArticles = []; let currentPage = 1;
    while (allArticles.length < CONFIG.TARGET_ARTICLES) {
      dashboardData.articlesCollected = allArticles.length;
      dashboardData.currentPage = currentPage;
      dashboardData.validationStatus = 'In Progress';
      console.log(`Collecting articles from page ${currentPage}...`);
      await page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);

      let articleElements = [];
      try { articleElements = await page.locator('tr .titleline').all(); } 
      catch (locatorError) { logError('ELEMENT_ERROR', 'article_selection', currentPage, `Failed to locate articles: ${locatorError.message}`); }

      if (articleElements.length === 0) { 
        const errMsg = `No articles found on page ${currentPage}`; 
        logError('SCRAPING_ERROR', 'article_collection', currentPage, errMsg); 
        break; 
      }

      for (let i = 0; i < articleElements.length; i++) {
        const articleRow = articleElements[i].locator('xpath=ancestor::tr');
        const nextRow = articleRow.locator('xpath=following-sibling::tr[1]');
        let timeText = 'no timestamp found';
        try { const ageElement = await nextRow.locator('.age').first(); if (await ageElement.count() > 0) timeText = await ageElement.textContent(); } 
        catch (e) { logError('TIMESTAMP_ERROR', 'timestamp_extraction', currentPage, `Failed to extract timestamp for article ${i + 1}: ${e.message}`); }
        allArticles.push({ index: allArticles.length + 1, timestamp: timeText, page: currentPage });
        if (allArticles.length >= CONFIG.TARGET_ARTICLES) break;
      }

      console.log(`Total articles collected so far: ${allArticles.length}`);

      if (allArticles.length < CONFIG.TARGET_ARTICLES) {
        const moreButton = page.locator('a.morelink');
        if (await moreButton.count() > 0) {
          console.log("Clicking more button to go to next page...");
          try { await moreButton.click(); await page.waitForLoadState('networkidle', { timeout: CONFIG.NAVIGATION_TIMEOUT }); currentPage++; } 
          catch (navError) { logError('PAGINATION_ERROR', 'next_page_navigation', currentPage, `Failed to navigate to next page: ${navError.message}`); break; }
        } else { console.log("No more pages available"); break; }
      }
    }

    allArticles = allArticles.slice(0, CONFIG.TARGET_ARTICLES);
    dashboardData.articlesCollected = allArticles.length;
    console.log("Final list of articles:", allArticles);

    console.log("Validating sorting of collected articles...");
    const validationResult = validateSorting(allArticles);

    if (validationResult.isValid) { 
      console.log(`All ${CONFIG.TARGET_ARTICLES} articles are properly sorted newest to oldest`); 
      dashboardData.validationStatus = 'Passed'; 
      dashboardData.violations = []; 
    } else { 
      console.log(`Found ${validationResult.violations.length} sorting violation(s):`);
      validationResult.violations.forEach(v => console.log(`- ${v.issue}`));
      dashboardData.validationStatus = `Failed with ${validationResult.violations.length}`;
      dashboardData.violations = validationResult.violations;
    }

    return {
      timestamp: new Date().toISOString(),
      totalArticles: allArticles.length,
      validationPassed: validationResult.isValid,
      violations: validationResult.violations,
      articles: allArticles,
      runDurationSec: ((Date.now()-startTime)/1000).toFixed(2),
      nodeVersion: process.version,
      platform: `${process.platform} ${process.arch}`,
      headlessMode: CONFIG.HEADLESS
    };

  } catch (error) { 
    logError('CRITICAL_ERROR', 'main_execution', dashboardData.currentPage, error.message); 
    dashboardData.validationStatus = 'Failed due to error';
    return null;
  } finally {
    if (browser) { try { await browser.close(); console.log("Browser closed"); } catch (closeError) { logError('BROWSER_ERROR', 'browser_close', dashboardData.currentPage, `Failed to close browser: ${closeError.message}`); } }
  }
}

// --- run main function 3 times and save single output ---
(async () => {
  const allRuns = [];
  for (let runNumber = 1; runNumber <= CONFIG.RUNS; runNumber++) {
    console.log(`\n=== STARTING RUN ${runNumber} ===\n`);
    const runResult = await sortHackerNewsArticles();
    if (runResult) allRuns.push({ runNumber, ...runResult });
  }

  // Save single JSON with all runs
  const resultsFile = 'validation-results.json';
  fs.writeFileSync(resultsFile, JSON.stringify(allRuns, null, 2));
  console.log(`All ${CONFIG.RUNS} runs saved to ${resultsFile}`);

  // Generate combined report
  generateHTMLReport(allRuns);
})();

// --- updated generateHTMLReport for multiple runs ---
function generateHTMLReport(allRuns) {
  const outputDir = 'test-history';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  // Historical trend (previous reports)
  const jsonFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));
  const trend = [];
  jsonFiles.forEach(f => {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(outputDir,f)));
      r.forEach(run => {
        trend.push({ date: new Date(run.timestamp).toLocaleDateString(), violations: run.violations.length, passed: run.validationPassed });
      });
    } catch(e){}
  });

  // Include current runs
  allRuns.forEach(run => trend.push({ date: new Date(run.timestamp).toLocaleDateString(), violations: run.violations.length, passed: run.validationPassed }));

  const latestRun = allRuns[allRuns.length - 1];

  const dateLabel = new Date(latestRun.timestamp).toLocaleString();
  const browserModeText = latestRun.headlessMode ? 'Headless (background, invisible)' : 'Visible (browser window shown)';
  let platformText = latestRun.platform;
  if (platformText.startsWith('darwin')) platformText = 'macOS';
  else if (platformText.startsWith('win32')) platformText = 'Windows';
  else if (platformText.startsWith('linux')) platformText = 'Linux';
  const osArch = require('os').arch();
  platformText += ` (${osArch})`;

  const fileName = `report-${Date.now()}.html`;
  const outputPath = path.join(outputDir, fileName);

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <title>QA Wolf Validation Report</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f7fa; color:#222; padding:30px; }
        h1 { text-align:center; color:#333; }
        .summary { background:#fff; padding:20px; border-radius:10px; margin-bottom:30px;}
        .summary p { margin:6px 0; font-size:15px; }
        .passed { color:#0a0; font-weight:bold; }
        .failed { color:#c00; font-weight:bold; }
        .violations { background:#fff; padding:20px; border-radius:10px; margin-bottom:30px; }
        .violations ul { list-style:disc; padding-left:20px; }
        .violations li { margin-bottom:4px; }
        table { width:100%; border-collapse: collapse; background:#fff; border-radius:10px; overflow:hidden; }
        th, td { padding:8px 12px; text-align:left; border-bottom:1px solid #ddd; font-size:14px; }
        th { background:#eee; }
        tr:hover { background:#f1f1f1; }
        canvas { margin-top:30px; background:#fff; border-radius:10px; padding:20px;}
      </style>
    </head>
    <body>
      <h1>QA Wolf – Hacker News Validation Report</h1>
      <div class="summary">
        <p><b>Run Date:</b> ${dateLabel}</p>
        <p><b>Number of Runs:</b> ${allRuns.length}</p>
        <p><b>Total Articles per Run:</b> ${latestRun.totalArticles}</p>
      </div>

      ${allRuns.map(run => `
        <div class="summary">
          <p><b>Run #${run.runNumber} Status:</b> ${run.validationPassed ? '<span class="passed">PASSED ✔</span>' : '<span class="failed">FAILED ✖</span>'}</p>
          ${run.violations.length>0?`<p><b>Violations:</b> ${run.violations.length}</p>`:''}
          <p><b>Run Duration (sec):</b> ${run.runDurationSec}</p>
          <p><b>Node.js Version:</b> ${run.nodeVersion}</p>
          <p><b>Browser Mode:</b> ${run.headlessMode ? 'Headless' : 'Visible'}</b></p>
          <p><b>Platform:</b> ${run.platform}</p>
        </div>
      `).join('')}

      <h3>Collected Articles from Last Run</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Timestamp</th>
            <th>Page</th>
          </tr>
        </thead>
        <tbody>
          ${latestRun.articles.map(a => `<tr><td>${a.index}</td><td>${a.timestamp}</td><td>${a.page}</td></tr>`).join('')}
        </tbody>
      </table>

      <canvas id="chartTrend" width="800" height="300"></canvas>

    </body>
  </html>
  `;

  fs.writeFileSync(outputPath, html,'utf-8');
  console.log(`Report generated: ${outputPath}`);
}
