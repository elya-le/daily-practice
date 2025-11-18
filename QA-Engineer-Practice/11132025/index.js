const { chromium } = require("playwright"); // Import Playwright's Chromium module for browser automation
const fs = require('fs'); // File system module to read/write files
const { exec } = require('child_process'); // Allows executing shell commands (e.g., opening HTML report)
const path = require('path'); // Provides utilities for working with file and directory paths

// Configuration
const CONFIG = {
  TARGET_ARTICLES: 100,           // Number of articles to collect before stopping
  NAVIGATION_TIMEOUT: 15000,      // Timeout (ms) for page navigation
  BROWSER_TIMEOUT: 30000,         // Timeout (ms) for page load
  HEADLESS: false,                // Whether browser runs in headless mode
  MAX_RETRIES: 2                  // Number of retry attempts for scraping
};

// ===== PRIORITY 1: ROBUST TIMESTAMP COLLECTION =====
// Capture absolute Unix timestamp + relative text
// Enables ground-truth comparison across page loads
function captureTimestamp() {
  return Date.now(); // Returns current timestamp in milliseconds since Unix epoch
}

// Converts relative time (like "2 hours ago") into absolute timestamp
function parseTimeToMinutes(timeText, collectionTime) {
  if (!timeText || timeText === 'no timestamp found') return null; // If no timestamp, return null
  
  // Extract numeric value and unit from "2 hours ago" format
  const match = timeText.match(/^(\d+)\s+(minute|hour|day)s?\s+ago/);
  if (!match) return null; // Return null if format does not match
  
  const value = parseInt(match[1]); // The numeric part (e.g., 2)
  const unit = match[2];            // The time unit (minute/hour/day)
  let minutes = 0;
  
  if (unit === 'minute') minutes = value;
  else if (unit === 'hour') minutes = value * 60;
  else if (unit === 'day') minutes = value * 24 * 60;
  else return null; // Invalid unit, return null
  
  // Convert relative time to absolute timestamp (milliseconds)
  return collectionTime - (minutes * 60 * 1000);
}

// ===== PRIORITY 2: DEFENSIVE SELECTORS =====
// grabs the article titles and their rows without crashing, even if the page looks a bit different than expected

async function extractArticlesWithFallback(page, currentPage) {
  const articleElements = [];
  
  // Primary selector strategy: find all elements with .titleline inside <tr>
  let elements = await page.locator('tr .titleline').all();
  
  if (elements.length === 0) {
    console.error(`No articles found on page ${currentPage}`); // Log error if selector fails
    return null; // Fail fast
  }
  
  return elements; // Return all found article elements
}

// Extract timestamp from a single article element
async function extractTimestampFromArticle(page, articleElement, pageNum) {
  try {
    // Validate that article is inside a <tr> element
    const articleRow = articleElement.locator('xpath=ancestor::tr[1]');
    const rowCount = await articleRow.count();
    
    if (rowCount === 0) {
      return { text: null, confidence: 'FAILED', reason: 'Article not in valid row structure' };
    }
    
    // Locate the metadata row (usually next <tr>)
    const metadataRow = articleRow.locator('xpath=following-sibling::tr[1]');
    const metaCount = await metadataRow.count();
    
    if (metaCount === 0) {
      return { text: null, confidence: 'FAILED', reason: 'No metadata row found' };
    }
    
    // Locate the timestamp inside metadata
    const ageElement = await metadataRow.locator('.age').first();
    if (await ageElement.count() === 0) {
      return { text: null, confidence: 'FAILED', reason: 'No .age element in metadata' };
    }
    
    const timeText = await ageElement.textContent(); // Extract timestamp text
    
    // Validate the format
    if (!timeText.match(/^\d+\s+(minute|hour|day)s?\s+ago/)) {
      return { text: null, confidence: 'FAILED', reason: `Invalid timestamp format: "${timeText}"` };
    }
    
    return { text: timeText, confidence: 'SUCCESS', reason: 'Valid extraction' };
    
  } catch (e) {
    return { text: null, confidence: 'FAILED', reason: `Exception: ${e.message}` }; // Handle exceptions
  }
}

// ===== TIMESTAMP PRECISION ANALYSIS =====
// Identify articles that may have close timestamps causing precision issues
function analyzeTimestampPrecision(allArticles) {
  const precisionRisks = [];
  const riskIndices = new Set();
  
  for (let i = 1; i < allArticles.length; i++) {
    const current = allArticles[i];
    const previous = allArticles[i - 1];
    
    if (!current.timestamp || !previous.timestamp) continue; // Skip if timestamps missing
    
    // Extract minute values from "x minutes ago"
    const currMatch = current.timestamp.match(/^(\d+)\s+minute/);
    const prevMatch = previous.timestamp.match(/^(\d+)\s+minute/);
    
    // Flag articles that are very close in minutes
    if (currMatch && prevMatch) {
      const currMin = parseInt(currMatch[1]);
      const prevMin = parseInt(prevMatch[1]);
      const delta = Math.abs(prevMin - currMin);
      
      if (delta <= 1) { // Same or adjacent minute
        precisionRisks.push({
          article1: previous.index,
          article2: current.index,
          delta: `${delta} minute(s)`,
          timestamps: `${previous.timestamp} vs ${current.timestamp}`,
          risk: 'HIGH - Both in minute-precision range'
        });
        riskIndices.add(current.index);
        riskIndices.add(previous.index);
      }
    }
  }
  
  return { precisionRisks, riskIndices };
}

// ===== PRIORITY 1 & 3: VALIDATION WITH CONFIDENCE SCORING =====
function validateSortingWithConfidence(allArticles, collectionTime) {
  const violations = [];
  const metrics = {
    totalArticles: allArticles.length,
    validTimestamps: 0,
    failedExtractions: 0,
    outOfOrder: 0,
    highRiskArticles: 0
  };
  
  // Analyze timestamp precision first
  const { precisionRisks, riskIndices } = analyzeTimestampPrecision(allArticles);
  metrics.highRiskArticles = riskIndices.size;
  
  // Convert all timestamps to absolute time
  const absoluteTimestamps = allArticles.map((article, idx) => {
    const absTime = parseTimeToMinutes(article.timestamp, collectionTime);
    
    if (absTime === null) {
      metrics.failedExtractions++;
      return { idx, absTime: null, relative: article.timestamp, valid: false, isRisk: false };
    }
    
    metrics.validTimestamps++;
    return { idx, absTime, relative: article.timestamp, valid: true, isRisk: riskIndices.has(article.index) };
  });
  
  // Check that timestamps decrease monotonically (newest to oldest)
  const TOLERANCE_MS = 60 * 1000; // 60 seconds tolerance
  
  for (let i = 1; i < absoluteTimestamps.length; i++) {
    const current = absoluteTimestamps[i];
    const previous = absoluteTimestamps[i - 1];
    
    if (!current.valid || !previous.valid) continue; // Skip invalid extractions
    
    // Current should be older than previous
    if (current.absTime > previous.absTime + TOLERANCE_MS) {
      const isPrecisionRelated = current.isRisk || previous.isRisk;
      
      metrics.outOfOrder++;
      violations.push({
        issue: `Article #${current.idx + 1} (${current.relative}) is NEWER than Article #${previous.idx + 1} (${previous.relative})`,
        detail: `Time delta: ${(current.absTime - previous.absTime) / 1000}s (violation threshold: ${TOLERANCE_MS / 1000}s)`,
        precisionFlag: isPrecisionRelated ? 'PRECISION RISK - May be false positive' : 'GENUINE VIOLATION'
      });
    }
  }
  
  // Compute confidence score (exclude high-risk articles)
  const scoringArticles = metrics.validTimestamps - metrics.highRiskArticles;
  const confidence = scoringArticles <= 0 ? 0 : 
    ((scoringArticles - metrics.outOfOrder) / scoringArticles * 100).toFixed(1);
  
  const isValid = violations.length === 0;
  
  return {
    isValid,
    confidence,
    violations,
    metrics,
    precisionRisks
  };
}

// ===== MAIN SCRAPING WITH RETRY LOGIC =====
async function validateHackerNewsSorting() {
  const startTime = Date.now(); // Track total collection time
  let browser = null;
  let attempt = 0;
  
  while (attempt < CONFIG.MAX_RETRIES) {
    attempt++;
    console.log(`\n=== VALIDATION ATTEMPT ${attempt}/${CONFIG.MAX_RETRIES} ===\n`);
    
    try {
      // Launch browser
      browser = await chromium.launch({ headless: CONFIG.HEADLESS });
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Go to Hacker News "newest" page
      await page.goto("https://news.ycombinator.com/newest", {
        waitUntil: 'networkidle',
        timeout: CONFIG.BROWSER_TIMEOUT
      });
      
      const collectionTime = captureTimestamp(); // Record when collection starts
      const allArticles = [];
      let currentPage = 1;
      
      // Loop until TARGET_ARTICLES are collected
      while (allArticles.length < CONFIG.TARGET_ARTICLES) {
        console.log(`Collecting articles from page ${currentPage}...`);
        
        const articleElements = await extractArticlesWithFallback(page, currentPage);
        if (!articleElements) break; // Stop if no articles found
        
        for (const element of articleElements) {
          if (allArticles.length >= CONFIG.TARGET_ARTICLES) break;
          
          const result = await extractTimestampFromArticle(page, element, currentPage);
          
          allArticles.push({
            index: allArticles.length + 1,
            timestamp: result.text,
            // extractionConfidence: result.confidence, // Commented out
            reason: result.reason,
            page: currentPage
          });
        }
        
        // Click "More" button if more articles are needed
        if (allArticles.length < CONFIG.TARGET_ARTICLES) {
          const moreButton = page.locator('a.morelink');
          if (await moreButton.count() > 0) {
            await moreButton.click();
            await page.waitForLoadState('networkidle', { timeout: CONFIG.NAVIGATION_TIMEOUT });
            currentPage++;
          } else {
            console.log('No more button found, stopping collection');
            break;
          }
        }
      }
      
      await browser.close();
      browser = null;
      
      // Run validation logic
      const validationResult = validateSortingWithConfidence(
        allArticles.slice(0, CONFIG.TARGET_ARTICLES),
        collectionTime
      );
      
      return {
        timestamp: new Date().toISOString(),
        collectionTimeMs: Date.now() - startTime,
        totalArticles: allArticles.length,
        validationPassed: validationResult.isValid,
        confidenceScore: validationResult.confidence,
        violations: validationResult.violations,
        metrics: validationResult.metrics,
        precisionRisks: validationResult.precisionRisks,
        articles: allArticles.slice(0, CONFIG.TARGET_ARTICLES),
        headlessMode: CONFIG.HEADLESS,
        platform: `${process.platform} ${process.arch}`,
        nodeVersion: process.version,
        attempts: attempt
      };
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed: ${error.message}`);
      if (browser) await browser.close().catch(() => {});
      
      if (attempt < CONFIG.MAX_RETRIES) {
        console.log(`Retrying in 5 seconds...`);
        await new Promise(r => setTimeout(r, 5000)); // Wait before retry
      }
    }
  }
  
  return null; // Return null if all retries fail
}

// ===== HTML REPORT GENERATION =====
function generateReport(result) {
  if (!result) {
    console.error('Validation failed after all retries');
    return;
  }
  
  // HTML template for report
  const html = `
<html>
  <head>
    <meta charset="UTF-8">
    <title>Sorting Validation Report</title>
    <style>
      body, h1, h2, h3, p, b, table, th, td, tr {
        font-family: Arial, sans-serif;
        font-size: 14px;
        margin: 0;
      }
      h1 { font-size: 18px; }
      h2 { font-size: 16px; }
      .body { margin: 20px; }
      .row {
        display: flex;
        gap: 16px;
        border: 1px solid blue; 
        padding-top: 10px;      
      }
      .details {
      }
      .details, .collected-articles{
        flex: 1;  
      }
      .data-quality-metrics, .validation-environment, .timestamp-precision-analysis { padding-top: 10px; }
      .failed { color: #c00; }
      .passed { color: #0a0;}
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
      }
      tr:hover {
        background-color: #f9f9f9;
      }
      .timestamp-column {
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <div class="body">
      <h1>Hacker News Sorting Validator Report</h1>
      <div class="row">
        <section class="details">
          <div class="validation-status">
            <h2>Validation Status</h2>
            <div class="summary status">
              <p><b>Result:</b> <span class="${result.validationPassed ? 'passed' : 'failed'}">
                ${result.validationPassed ? 'Passed ✔' : 'Failed ✖'}
              </span></p>
              <p><b>Confidence Score:</b> <span class="confidence">${result.confidenceScore}%</span></p>
              <p><b>Articles Validated:</b> ${result.totalArticles}</p>
              <p><b>Attempts Required:</b> ${result.attempts}</p>
              <p><b>Collection Time:</b> ${(result.collectionTimeMs / 1000).toFixed(1)}s</p>
            </div>
          </div>
          <div class="data-quality-metrics">
            <h2>Data Quality Metrics</h2>
            <div class="summary">
              <p><b>Valid Timestamps:</b> ${result.metrics.validTimestamps} / ${result.metrics.totalArticles}</p>
              <p><b>Failed Extractions:</b> <span class="${result.metrics.failedExtractions > 0 ? 'failed' : ''}">${result.metrics.failedExtractions}</span></p>
              <p><b>Out-of-Order Articles:</b> <span class="${result.metrics.outOfOrder > 0 ? 'failed' : ''}">${result.metrics.outOfOrder}</span></p>
            </div>
          </div>
          <div class="validation-environment">
            <h2>Validation Environment</h2>
            <p><b>Timestamp:</b> ${result.timestamp}</p>
            <p><b>Platform:</b> ${result.platform}</p>
            <p><b>Node.js:</b> ${result.nodeVersion}</p>
            <p><b>Browser Mode:</b> ${result.headlessMode ? 'Headless' : 'Visible'}</p>
          </div>
          <div class="report-violations">
            ${result.violations.length > 0 ? `
              <h2>Sorting Violations</h2>
              ${result.violations.map(v => `
                <div class="violation-item">
                  <p><b>${v.issue}</b></p>
                  <p>${v.detail}</p>
                  <p style="color:${v.precisionFlag.includes('FALSE') ? '#f90' : '#c00'};"><b>${v.precisionFlag}</b></p>
                </div>
              `).join('')}
            ` : ''}
          </div>
          <div class="timestamp-precision-analysis">
            ${result.precisionRisks && result.precisionRisks.length > 0 ? `
              <h2>Timestamp Precision Analysis</h2>
              <p><b>Found ${result.precisionRisks.length} article pair(s) within 60-second window</b> = high-risk for false-positive violations.</p>
              <p><b>Why this matters:</b> HN timestamps show "x minutes ago". Articles posted within the same minute may appear out-of-order due to timestamp quantization. Confidence excludes ${result.metrics.highRiskArticles} high-risk articles.</p>
              ${result.precisionRisks.map(r => `
                <div class="violation-item">
                  <p>Article #${r.article1} vs #${r.article2} - ${r.timestamps} - (${r.delta} apart)</p>
                </div>
              `).join('')}
            ` : ''}
          </div>
        </section>   
        <section class="collected-articles">
          <h2>Collected Articles</h2>
          <table>
            <thead>
              <tr>
                <th>Article #</th>
                <th>Timestamp</th>
                <th>Page</th>
              </tr>
            </thead>
            <tbody>
              ${result.articles.map(a => `
                <tr>
                  <td>${a.index}</td>
                  <td class="timestamp-column">${a.timestamp || a.reason}</td>
                  <td>${a.page}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  </body>
</html>

`;

  // Ensure directory exists
  const outputDir = 'test-history';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  
  const fileName = `report-${Date.now()}.html`;
  const outputPath = path.join(outputDir, fileName);
  fs.writeFileSync(outputPath, html, 'utf-8'); // Save report
  
  console.log(`\nReport generated: ${outputPath}`);
  
  // Open report automatically
  const platform = process.platform;
  let command;
  if (platform === 'darwin') command = `open "${outputPath}"`;
  else if (platform === 'win32') command = `start "" "${outputPath}"`;
  else command = `xdg-open "${outputPath}"`;
  
  exec(command, (error) => {
    if (error) console.error('Failed to open report:', error.message);
    else console.log('Report opened in browser.');
    process.exit(0); // Exit after opening
  });
}

// ===== RUN =====
(async () => {
  const result = await validateHackerNewsSorting(); // Scrape and validate
  generateReport(result); // Generate HTML report
})();



  // <td>${a.extractionConfidence}</td>
// /*
// Objectives:
// - Verify that the 'newest' page of Hacker News is sorted from newest to oldest
// - Collect timestamps for the first 100 posts
// - Detect any out-of-order posts
// - Provide a live dashboard for monitoring progress
// - Log errors professionally
// - Generate detailed HTML reports for presentation
// */

// // Imports
// const { chromium } = require("playwright");
// const fs = require('fs');
// const express = require('express');
// const { exec } = require('child_process');
// const path = require('path');
// const os = require('os');

// // Configuration Constants
// const CONFIG = {
//   TARGET_ARTICLES: 100,
//   PAGE_LOAD_TIMEOUT: 200,
//   NAVIGATION_TIMEOUT: 15000,
//   BROWSER_TIMEOUT: 30000,
//   HEADLESS: false,
//   EXPORT_DATA: true,
//   AUTO_OPEN_DASHBOARD: true,
//   RUNS: 3
// };

// // Dashboard Setup 
// const app = express();
// const PORT = 3000;

// let dashboardData = {
//   articlesCollected: 0,
//   totalArticles: CONFIG.TARGET_ARTICLES,
//   currentPage: 0,
//   validationStatus: 'In Progress',
//   errors: [],
//   violations: [],
//   currentRun: 0
// };

// // Helper Functions 
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

// function logError(type, step, page, message) {
//   const errObj = {
//     timestamp: new Date().toISOString(),
//     type,
//     step,
//     page,
//     message
//   };
//   dashboardData.errors.push(errObj);
//   try { fs.appendFileSync('error-log.json', JSON.stringify(errObj) + '\n'); }
//   catch(e) { console.error('Failed to write error log:', e.message); }
//   console.error(`[ERROR] ${type} at ${step} (page ${page}): ${message}`);
// }

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

// const TIME_TOLERANCE = 2;
// function validateSorting(allArticles) {
//   const violations = [];
//   let isValid = true;
//   for (let i = 1; i < allArticles.length; i++) {
//     const currentMinutes = parseTimeToMinutes(allArticles[i].timestamp);
//     const previousMinutes = parseTimeToMinutes(allArticles[i - 1].timestamp);
//     if (currentMinutes + TIME_TOLERANCE < previousMinutes) {
//       violations.push({
//         issue: `Article #${i + 1} (${allArticles[i].timestamp}) is newer than Article #${i} (${allArticles[i - 1].timestamp})`
//       });
//       isValid = false;
//     }
//   }
//   return { isValid, violations };
// }

// // Dashboard Route 
// app.get('/', (req, res) => {
//   const progressPercent = Math.floor((dashboardData.articlesCollected / dashboardData.totalArticles) * 100);
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


// // Main Scraping & Validation
// async function sortHackerNewsArticles() {
//   const startTime = Date.now();
//   let browser = null;

//   console.log("Waiting for dashboard to initialize...");
//   await new Promise(resolve => setTimeout(resolve, 2000));

//   try {
//     browser = await chromium.launch({ headless: CONFIG.HEADLESS });
//     const context = await browser.newContext();
//     const page = await context.newPage();
//     await page.goto("https://news.ycombinator.com/newest", { waitUntil: 'networkidle', timeout: CONFIG.BROWSER_TIMEOUT });

//     let allArticles = [];
//     let currentPage = 1;

//     while (allArticles.length < CONFIG.TARGET_ARTICLES) {
//       dashboardData.articlesCollected = allArticles.length;
//       dashboardData.currentPage = currentPage;
//       dashboardData.validationStatus = 'In Progress';

//       await page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);

//       let articleElements = [];
//       try { articleElements = await page.locator('tr .titleline').all(); }
//       catch(e) { logError('ELEMENT_ERROR', 'article_selection', currentPage, e.message); }

//       if (!articleElements.length) { 
//         logError('SCRAPING_ERROR', 'article_collection', currentPage, `No articles found on page ${currentPage}`);
//         break; 
//       }

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

//     const validationResult = validateSorting(allArticles);
//     if (validationResult.isValid) {
//       dashboardData.validationStatus = 'Passed';
//       dashboardData.violations = [];
//     } else {
//       dashboardData.validationStatus = `Failed with ${validationResult.violations.length}`;
//       dashboardData.violations = validationResult.violations;
//     }

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
//     if (browser) {
//       try { await browser.close(); }
//       catch(e) { logError('BROWSER_ERROR', 'browser_close', dashboardData.currentPage, e.message); }
//     }
//   }
// }

// // HTML Report Generator
// function generateHTMLReport(allRuns) {
//   const outputDir = 'test-history';
//   if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

//   const latestRun = allRuns[allRuns.length - 1];
//   const dateLabel = new Date(latestRun.timestamp).toLocaleString();

//   const html = `
// <html>
//   <head>
//     <meta charset="UTF-8">
//     <title>Validation Report</title>
//     <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
//     <style>
//       body { font-family: Arial, sans-serif; background: #f5f7fa; color:#222; padding:30px; }
//       h1 { text-align: left; color:#333; padding-left:14px; }
//       .full-report { display: flex; gap: 20px; flex-wrap: wrap; }
//       .full-report > div { flex: 1; min-width: 300px; }
//       .summary { background: #fff; padding: 20px; border-radius: 10px; margin-bottom: 30px; }
//       .individual-run-summary { background: #fff; padding: 15px; margin-top: 3px; border-radius: 10px; }
//       .individual-run-summary p { margin: 6px 0; font-size: 15px; }
//       .summary p { margin: 6px 0; font-size: 15px; }
//       .run-summary-container { display: flex; flex-direction: column; gap: 5px; max-width: 300px; margin-bottom: 30px; }
//       .run-summary-container .summary { padding: 12px 15px; margin-bottom: 0; border-radius: 8px; font-size: 14px; }
//       .run-summary-container .summary p { margin: 4px 0; }
//       table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; font-size: 10px; }
//       th, td { padding: 2px 2px; text-align: left; border-bottom: 1px solid #ddd; }
//       th { background: #f0f0f0; font-weight: bold; }
//       tr:hover { background: #f9f9f9; }
//       canvas { margin-top: 20px; background: #fff; border-radius: 8px; padding: 16px; }
//       .collected-articles h3 { font-size: 16px; margin: 0 0 6px 0; padding: 0; }
//       .collected-articles { background: #fff; padding: 10px 15px; border-radius: 8px; margin-bottom: 30px; max-width: 700px; }
//       .article-headers { gap: 20px; }
//       .article-headers span { padding-right: 34px; font-size: 13px; font-weight: medium; white-space: nowrap; }
//       .articles-columns { column-count: 4; column-gap: 40px; }
//       .article-row { break-inside: avoid; padding: 4px 0; border-bottom: 1px solid #ddd; font-size: 12px; display: flex; justify-content: space-between; max-width: 180px; }
//       .article-row span { display: inline-block; width: 33%; white-space: nowrap; }
//       .index { max-width: 18px; }
//       .page { max-width: 12px; }
//       .passed { color:#0a0; font-weight:bold; }
//       .failed { color:#c00; font-weight:bold; }
//       .violations { background:#fff; padding:20px; border-radius:10px; margin-bottom:30px; }
//       .violations ul { list-style:disc; padding-left:20px; }
//       .violations li { margin-bottom:4px; }
//     </style>
//   </head>
//   <body>
//     <h1>QA Wolf – Chronological Sorting Report</h1>
//     <div class="full-report">
//       <div class="run-summary-container">
//         <div class="summary">
//           <p><b>Run Date:</b> ${dateLabel}</p>
//           <p><b>Number of Runs:</b> ${allRuns.length}</p>
//           <p><b>Total Articles per Run:</b> ${latestRun.totalArticles}</p>
//         </div>
//         ${allRuns.map(run => `
//           <div class="individual-run-summary">
//             <p><b>Run #${run.runNumber}</b></p>
//             <p><b>Status:</b> ${run.validationPassed ? '<span class="passed">PASSED ✔</span>' : '<span class="failed">FAILED ✖</span>'}</p>
//             ${run.violations.length>0 ? `<p><b>Violations:</b> ${run.violations.length}</p>` : ''}
//             <p><b>Run Duration (sec):</b> ${run.runDurationSec}</p>
//             <p><b>Node.js Version:</b> ${run.nodeVersion}</p>
//             <p><b>Browser Mode:</b> ${run.headlessMode ? 'Headless' : 'Visible'}</p>
//             <p><b>Platform:</b> ${run.platform}</p>
//           </div>
//         `).join('')}
//       </div>

//       <div class="collected-articles">
//         <h3>Collected Articles from Latest Run</h3>
//         <div class="article-headers">
//           <span class="index">#</span>
//           <span class="timestamp">Time</span>
//           <span class="page">Page</span>
//         </div>
//         <div class="articles-columns">
//           ${latestRun.articles.map(a => `
//             <div class="article-row">
//               <span class="index">${a.index}</span>
//               <span class="timestamp">${a.timestamp
//                   .replace(/\bhours\b/g,'hrs')
//                   .replace(/\bhour\b/g,'hr')
//                   .replace(/\bminutes\b/g,'min')
//                   .replace(/\bminute\b/g,'min')}
//               </span>
//               <span class="page">${a.page}</span>
//             </div>
//           `).join('')}
//         </div>
//       </div>

//       ${latestRun.violations.length > 0 ? `
//         <div class="violations">
//           <h3>Violations</h3>
//           <ul>
//             ${latestRun.violations.map(v => `<li>${v.issue}</li>`).join('')}
//           </ul>
//         </div>
//       ` : ''}
//     </div>
//   </body>
// </html>
// `;

//   const fileName = `report-${Date.now()}.html`;
//   const outputPath = path.join(outputDir, fileName);
//   fs.writeFileSync(outputPath, html, 'utf-8');
//   console.log(`Report generated: ${outputPath}`);

//   const platform = process.platform;
//   let command;
//   if (platform === 'darwin') command = `open "${outputPath}"`;
//   else if (platform === 'win32') command = `start "" "${outputPath}"`;
//   else command = `xdg-open "${outputPath}"`;
//   require('child_process').exec(command, (error) => {
//     if (error) console.error('Failed to open report automatically:', error.message);
//     else console.log('Report opened in browser.');
//     process.exit(0);
//   });
// }
// // --- Run Main Function ---
// (async () => {
//   const allRuns = [];
//   for (let runNumber = 1; runNumber <= CONFIG.RUNS; runNumber++) {
//     dashboardData.currentRun = runNumber;
//     console.log(`\n=== STARTING RUN ${runNumber} ===\n`);
//     const runResult = await sortHackerNewsArticles();
//     if (runResult) allRuns.push({ runNumber, ...runResult });
//   }

//   fs.writeFileSync('validation-results.json', JSON.stringify(allRuns, null, 2));
//   console.log(`All ${CONFIG.RUNS} runs saved to validation-results.json`);

//   generateHTMLReport(allRuns);
// })();



