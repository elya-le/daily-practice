/*
- Verify that the 'newest' page of Hacker News is sorted from newest to oldest
- Collect timestamps for the first 100 posts
- Detect any out-of-order posts
- Provide a live dashboard for monitoring progress
- Log errors professionally
- Generate detailed HTML reports for presentation
*/

// Imports
const { chromium } = require("playwright");
const fs = require('fs');
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');

// Configuration Constants 
const CONFIG = {
  TARGET_ARTICLES: 100,
  PAGE_LOAD_TIMEOUT: 200,
  NAVIGATION_TIMEOUT: 15000,
  BROWSER_TIMEOUT: 30000,
  HEADLESS: false,
  AUTO_OPEN_DASHBOARD: true,
  RUNS: 3,
  MAX_SCRAPE_RETRIES: 3,
  RETRY_DELAY: 1000
};

// Dashboard Setup 
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

// Helper Functions 
/**
 * Open a URL in the system default browser. Supports macOS, Windows, Linux.
 */
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
/**
 * Log errors with structured format. Appends to dashboard and persists to JSON file.
 * @param {string} type - Error category
 * @param {string} step - Step where error occurred
 * @param {number} page - Page number
 * @param {string} message - Error description
 */
function logError(type, step, page, message) {
  const errObj = {
    timestamp: new Date().toISOString(),
    type,
    step,
    page,
    message
  };
  dashboardData.errors.push(errObj);
  try {
    fs.appendFileSync('error-log.json', JSON.stringify(errObj) + '\n');
  } catch (fileError) {
    console.error('Failed to write error log:', fileError.message);
  }
  console.error(`[ERROR] ${type} at ${step} (page ${page}): ${message}`);
}

/**
 * Parse Hacker News relative time strings into minutes.
 * Returns null if format is unrecognized or invalid.
 */
function parseTimeToMinutes(timeText) {
  if (!timeText || typeof timeText !== 'string') {
    logError('PARSE_ERROR', 'timestamp_parsing', 0, 'Empty or invalid timestamp');
    return null;
  }

  const match = timeText.match(/(\d+)\s+(minute|hour|day)s?\s+ago/i);
  if (!match) {
    logError('PARSE_ERROR', 'timestamp_parsing', 0, `Could not parse: "${timeText}"`);
    return null;
  }

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === 'minute') return value;
  if (unit === 'hour') return value * 60;
  if (unit === 'day') return value * 24 * 60;

  return null;
}

/**
 * Validate chronological order of articles (newest to oldest).
 * Checks for null timestamps and sorting violations.
 */
const TIME_TOLERANCE = 2;
function validateSorting(allArticles) {
  const violations = [];
  let isValid = true;

  if (!Array.isArray(allArticles) || allArticles.length === 0) {
    return { isValid: false, violations: [{ issue: 'No articles to validate' }] };
  }

  for (let i = 1; i < allArticles.length; i++) {
    const currentMinutes = parseTimeToMinutes(allArticles[i].timestamp);
    const previousMinutes = parseTimeToMinutes(allArticles[i - 1].timestamp);

    if (currentMinutes === null || previousMinutes === null) {
      violations.push({
        issue: `Article #${i} or #${i + 1} has unparseable timestamp`,
        articleIndex: i
      });
      isValid = false;
      continue;
    }

    if (previousMinutes > currentMinutes + TIME_TOLERANCE) {
      violations.push({
        issue: `Article #${i + 1} (${allArticles[i].timestamp}) is newer than Article #${i} (${allArticles[i - 1].timestamp})`
      });
      isValid = false;
    }
  }

  return { isValid, violations };
}

// Dashboard Routes 
app.get('/', (req, res) => {
  const progressPercent = Math.floor((dashboardData.articlesCollected / dashboardData.totalArticles) * 100);
  let validationHtml = '';
  if (dashboardData.errors.length > 0) {
    const errorMessages = dashboardData.errors.slice(-3).map(e => `${e.type}: ${e.message}`).join('<br>');
    validationHtml = `<p class="errors">Recent Errors:<br>${errorMessages}</p>`;
  } else if (dashboardData.articlesCollected === dashboardData.totalArticles) {
    if (dashboardData.validationStatus === 'Passed') {
      validationHtml = `<p>Validation Status: <span class="passed">Passed (checkmark)</span><br>The most recent ${CONFIG.TARGET_ARTICLES} articles are ordered from newest to oldest.</p>`;
    } else {
      const violationCount = dashboardData.validationStatus.replace('Failed with ', '').split(' ')[0];
      validationHtml = `<p>Validation Status: <span class="failed">Failed (X)</span> - ${violationCount} sorting violation(s) detected</p>`;
    }
  } else {
    validationHtml = `<p>Validation Status: ${dashboardData.validationStatus}</p>`;
  }

  res.send(`
    <html>
      <head>
        <title>QA Wolf - Date Validator Dashboard</title>
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
          .failed { color: red; font-weight: bold; }
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

app.get('/api/status', (req, res) => res.json(dashboardData));
app.post('/api/update', express.json(), (req, res) => { Object.assign(dashboardData, req.body); res.json({ success: true }); });

app.listen(PORT, () => {
  const dashboardUrl = `http://localhost:${PORT}`;
  console.log(`Dashboard running at ${dashboardUrl} (auto-refresh every 2s)`);
  if (CONFIG.AUTO_OPEN_DASHBOARD) setTimeout(() => openInBrowser(dashboardUrl), 1000);
});

// Scraping with Retry Logic ---
async function scrapeArticlesWithRetry(page, maxAttempts = CONFIG.MAX_SCRAPE_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const articleElements = await page.locator('tr .titleline').all();
      if (articleElements.length > 0) {
        return articleElements;
      }
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        console.log(`Retry attempt ${attempt}/${maxAttempts}...`);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(CONFIG.RETRY_DELAY);
      }
    }
  }

  throw new Error(`Failed to scrape articles after ${maxAttempts} attempts: ${lastError.message}`);
}

// Main Scraping & Validation Function 
async function sortHackerNewsArticles() {
  const startTime = Date.now();
  let browser = null;

  console.log("Waiting for dashboard to initialize...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    browser = await chromium.launch({ headless: CONFIG.HEADLESS });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("Navigating to Hacker News newest page...");
    await page.goto("https://news.ycombinator.com/newest", { waitUntil: 'networkidle', timeout: CONFIG.BROWSER_TIMEOUT });

    let allArticles = [];
    let currentPage = 1;

    while (allArticles.length < CONFIG.TARGET_ARTICLES) {
      dashboardData.articlesCollected = allArticles.length;
      dashboardData.currentPage = currentPage;
      dashboardData.validationStatus = 'In Progress';

      await page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);

      let articleElements = [];
      try {
        articleElements = await scrapeArticlesWithRetry(page);
      } catch (error) {
        logError('ELEMENT_ERROR', 'article_selection', currentPage, error.message);
        break;
      }

      if (!articleElements.length) {
        logError('SCRAPING_ERROR', 'article_collection', currentPage, `No articles found on page ${currentPage}`);
        break;
      }

      // Extract timestamp and metadata for each article
      for (let i = 0; i < articleElements.length; i++) {
        const articleRow = articleElements[i].locator('xpath=ancestor::tr');
        const nextRow = articleRow.locator('xpath=following-sibling::tr[1]');
        let timeText = null;

        try {
          const ageElement = await nextRow.locator('.age').first();
          if (await ageElement.count() > 0) {
            timeText = await ageElement.textContent();
            timeText = timeText.trim();

            // Validate timestamp format before storing
            if (!timeText.match(/(\d+)\s+(minute|hour|day)s?\s+ago/i)) {
              logError('FORMAT_ERROR', 'timestamp_validation', currentPage, `Article ${i + 1} has invalid format: "${timeText}"`);
              timeText = null;
            }
          }
        } catch (e) {
          logError('TIMESTAMP_ERROR', 'timestamp_extraction', currentPage, `Failed to extract timestamp for article ${i + 1}: ${e.message}`);
          timeText = null;
        }

        allArticles.push({
          index: allArticles.length + 1,
          timestamp: timeText,
          page: currentPage,
          valid: timeText !== null
        });

        if (allArticles.length >= CONFIG.TARGET_ARTICLES) break;
      }

      // Navigate to next page if more articles are needed
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

    // Data quality checkpoint before validation
    if (allArticles.length < CONFIG.TARGET_ARTICLES) {
      const msg = `Incomplete collection: ${allArticles.length}/${CONFIG.TARGET_ARTICLES}`;
      logError('INCOMPLETE_COLLECTION', 'data_validation', 'final', msg);
    }

    const invalidCount = allArticles.filter(a => !a.valid).length;
    if (invalidCount > 0) {
      logError('DATA_QUALITY', 'data_validation', 'final', `${invalidCount} articles with invalid timestamps`);
    }

    // Validate chronological sorting
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
      validArticles: allArticles.filter(a => a.valid).length,
      validationPassed: validationResult.isValid,
      violations: validationResult.violations,
      articles: allArticles,
      runDurationSec: ((Date.now() - startTime) / 1000).toFixed(2),
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
      catch (closeError) { logError('BROWSER_ERROR', 'browser_close', dashboardData.currentPage, closeError.message); }
    }
  }
}

// Main Execution Loop
(async () => {
  const allRuns = [];

  for (let runNumber = 1; runNumber <= CONFIG.RUNS; runNumber++) {
    dashboardData.currentRun = runNumber;
    dashboardData.errors = [];
    dashboardData.violations = [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`STARTING RUN ${runNumber} OF ${CONFIG.RUNS}`);
    console.log('='.repeat(60));

    const runResult = await sortHackerNewsArticles();
    if (runResult) allRuns.push({ runNumber, ...runResult });
  }

  // Save JSON results
  fs.writeFileSync('validation-results.json', JSON.stringify(allRuns, null, 2));
  console.log(`Results saved to validation-results.json`);

  // Print summary to console
  console.log('\n' + '='.repeat(60));
  console.log('FINAL VALIDATION SUMMARY');
  console.log('='.repeat(60));

  const passed = allRuns.filter(r => r.validationPassed).length;
  const failed = allRuns.length - passed;
  const totalViolations = allRuns.reduce((sum, r) => sum + r.violations.length, 0);
  const totalInvalid = allRuns.reduce((sum, r) => sum + (r.totalArticles - r.validArticles), 0);
  const avgDuration = (allRuns.reduce((sum, r) => sum + parseFloat(r.runDurationSec), 0) / allRuns.length).toFixed(2);

  console.log(`Passed: ${passed}/${allRuns.length}`);
  console.log(`Failed: ${failed}/${allRuns.length}`);
  console.log(`Total Violations: ${totalViolations}`);
  console.log(`Invalid Timestamps: ${totalInvalid}`);
  console.log(`Average Runtime: ${avgDuration}s per run`);
  console.log('='.repeat(60) + '\n');

  generateHTMLReport(allRuns);
})();

// HTML Report Generation 
function generateHTMLReport(allRuns) {
  const outputDir = 'test-history';

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const latestRun = allRuns[allRuns.length - 1];
  const dateLabel = new Date(latestRun.timestamp).toLocaleString();

  const fileName = `report-${Date.now()}.html`;
  const outputPath = path.join(outputDir, fileName);

  const html = `
<html>
<head>
<meta charset="UTF-8">
<title>QA Wolf Validation Report</title>
<style>
  body { font-family: Arial, sans-serif; background: #f5f7fa; color:#222; padding:30px; }
  h1 { text-align: left; color:#333; padding-left:14px; }

  .full-report { display: flex; gap: 20px; flex-wrap: wrap; }
  .full-report > div { flex: 1; min-width: 300px; }

  .summary { background: #fff; padding: 20px; border-radius: 10px; margin-bottom: 30px; }
  .individual-run-summary { background: #fff; padding: 15px; margin-top: 3px; border-radius: 10px; }
  .individual-run-summary p, .summary p { margin: 6px 0; font-size: 15px; }

  .run-summary-container { display: flex; flex-direction: column; gap: 5px; max-width: 300px; margin-bottom: 30px; }
  .run-summary-container .summary { padding: 12px 15px; margin-bottom: 0; border-radius: 8px; font-size: 14px; }
  .run-summary-container .summary p { margin: 4px 0; }

  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; font-size: 10px; }
  th, td { padding: 2px 2px; text-align: left; border-bottom: 1px solid #ddd; }
  th { background: #f0f0f0; font-weight: bold; }
  tr:hover { background: #f9f9f9; }

  .collected-articles { background: #fff; padding: 10px 15px; border-radius: 8px; margin-bottom: 30px; max-width: 700px; }
  .collected-articles h3 { font-size: 16px; margin: 0 0 6px 0; padding: 0; }
  .article-headers { gap: 20px; }
  .article-headers span { padding-right: 34px; font-size: 13px; font-weight: medium; white-space: nowrap; }

  .articles-columns { column-count: 4; column-gap: 40px; }
  .article-row { break-inside: avoid; padding: 4px 0; border-bottom: 1px solid #ddd; font-size: 12px; display: flex; justify-content: space-between; max-width: 180px; }
  .article-row span { display: inline-block; width: 33%; white-space: nowrap; }
  .index { max-width: 18px; }
  .page { max-width: 12px; }
  .article-row.invalid { color: #d32f2f; font-style: italic; }

  .passed { color:#0a0; font-weight:bold; }
  .failed { color:#c00; font-weight:bold; }

  .violations { background:#fff; padding:20px; border-radius:10px; margin-bottom:30px; }
  .violations ul { list-style:disc; padding-left:20px; }
  .violations li { margin-bottom:4px; }

  .data-quality { background:#fff; padding:20px; border-radius:10px; margin-bottom:30px; }
</style>
</head>
<body>
  <h1>QA Wolf - Chronological Sorting Report</h1>

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
          <p><b>Status:</b> ${run.validationPassed ? '<span class="passed">PASSED</span>' : '<span class="failed">FAILED</span>'}</p>
          <p><b>Valid Articles:</b> ${run.validArticles}/${run.totalArticles}</p>
          ${run.violations.length > 0 ? `<p><b>Violations:</b> ${run.violations.length}</p>` : ''}
          <p><b>Duration:</b> ${run.runDurationSec}s</p>
          <p><b>Node.js:</b> ${run.nodeVersion}</p>
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
          <div class="article-row ${!a.valid ? 'invalid' : ''}">
            <span class="index">${a.index}</span>
            <span class="timestamp">
              ${a.timestamp ? a.timestamp.replace(/\bhours\b/g,'hrs').replace(/\bhour\b/g,'hr').replace(/\bminutes\b/g,'min').replace(/\bminute\b/g,'min') : 'INVALID'}
            </span>
            <span class="page">${a.page}</span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>
  ${latestRun.violations && latestRun.violations.length > 0 ? `
    <div class="violations">
      <h2>Sorting Violations</h2>
      <ul>
        ${latestRun.violations.map(v => `<li>${v.issue}</li>`).join('')}
      </ul>
    </div>
  ` : ''}
</body>
</html>
`;

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