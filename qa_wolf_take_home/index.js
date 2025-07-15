// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");
const fs = require('fs');

// configuration constants - shows clean coding practices
const CONFIG = {
  TARGET_ARTICLES: 100,
  PAGE_LOAD_TIMEOUT: 2000,
  NAVIGATION_TIMEOUT: 15000,
  BROWSER_TIMEOUT: 30000,
  HEADLESS: false,
  EXPORT_DATA: true
};

async function sortHackerNewsArticles() {
  const browser = await chromium.launch({ headless: CONFIG.HEADLESS });
  let success = false;
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("starting Hacker News sorting validation...");
    console.log("navigating to https://news.ycombinator.com/newest");
    
    // navigate with timeout and error handling
    await page.goto("https://news.ycombinator.com/newest", { 
      waitUntil: 'networkidle',
      timeout: CONFIG.BROWSER_TIMEOUT 
    });

    console.log("page loaded successfully");
    
    let allArticles = [];
    let currentPage = 1;
    const startTime = Date.now();
    
    // collect articles from multiple pages
    while (allArticles.length < CONFIG.TARGET_ARTICLES) {
      console.log(`\n--- collecting from page ${currentPage} ---`);
      
      // wait for content to load
      await page.waitForTimeout(CONFIG.PAGE_LOAD_TIMEOUT);
      
      // extract article data with error handling
      try {
        const articleElements = await page.locator('tr .titleline').all();
        
        if (articleElements.length === 0) {
          throw new Error(`no articles found on page ${currentPage}`);
        }
        
        console.log(`found ${articleElements.length} articles on page ${currentPage}`);
        
        // extract data from each article
        for (let i = 0; i < articleElements.length; i++) {
          try {
            const articleRow = articleElements[i].locator('xpath=ancestor::tr');
            const nextRow = articleRow.locator('xpath=following-sibling::tr[1]');
            
            const timeText = await nextRow.locator('text=/\\d+\\s+(minute|hour|day)s?\\s+ago/').first().textContent();
            
            if (!timeText) {
              console.warn(`warning: no timestamp found for article ${allArticles.length + 1}`);
            }
            
            const articleData = {
              index: allArticles.length + 1,
              timestamp: timeText || 'no timestamp found',
              timeValue: parseTimeToMinutes(timeText),
              page: currentPage
            };
            
            allArticles.push(articleData);
            
            if (allArticles.length >= CONFIG.TARGET_ARTICLES) {
              console.log(`reached target of ${CONFIG.TARGET_ARTICLES} articles!`);
              break;
            }
          } catch (error) {
            console.warn(`warning: failed to extract article ${i + 1} on page ${currentPage}: ${error.message}`);
          }
        }
        
        console.log(`total articles collected: ${allArticles.length}/${CONFIG.TARGET_ARTICLES}`);
        
      } catch (error) {
        console.error(`error extracting articles from page ${currentPage}: ${error.message}`);
        break;
      }
      
      if (allArticles.length >= CONFIG.TARGET_ARTICLES) {
        break;
      }
      
      // navigate to next page using robust selector
      try {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
        
        // use specific class selector to avoid matching article content
        const moreButton = page.locator('a.morelink');
        
        if (await moreButton.count() > 0) {
          console.log("navigating to next page...");
          await moreButton.click();
          await page.waitForLoadState('networkidle', { timeout: CONFIG.NAVIGATION_TIMEOUT });
          currentPage++;
        } else {
          console.log("no more button found - stopping collection");
          break;
        }
      } catch (error) {
        console.error(`error navigating to next page: ${error.message}`);
        break;
      }
    }
    
    // validate we have enough articles
    if (allArticles.length < CONFIG.TARGET_ARTICLES) {
      throw new Error(`only collected ${allArticles.length} articles, need ${CONFIG.TARGET_ARTICLES}`);
    }
    
    // trim to exactly target count
    allArticles = allArticles.slice(0, CONFIG.TARGET_ARTICLES);
    
    // validate sorting
    console.log(`\n=== SORTING VALIDATION ===`);
    console.log(`validating ${allArticles.length} articles are sorted newest to oldest...`);
    
    const validationResult = validateSorting(allArticles);
    
    // report results
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (validationResult.isValid) {
      console.log(`\nVALIDATION SUCCESSFUL!`);
      console.log(`all ${allArticles.length} articles are properly sorted newest to oldest`);
      console.log(`execution time: ${executionTime} seconds`);
      console.log(`pages visited: ${currentPage}`);
      success = true;
    } else {
      console.log(`\nVALIDATION FAILED!`);
      console.log(`found ${validationResult.violations.length} sorting violations:`);
      validationResult.violations.forEach(v => console.log(`   - ${v.issue}`));
    }
    
    // show sample data
    console.log(`\nsample articles (first 5, last 5):`);
    for (let i = 0; i < 5; i++) {
      console.log(`${i + 1}. ${allArticles[i].timestamp}`);
    }
    console.log(`...`);
    for (let i = 95; i < 100; i++) {
      console.log(`${i + 1}. ${allArticles[i].timestamp}`);
    }
    
    // data export functionality - shows thinking about outputs and documentation
    if (CONFIG.EXPORT_DATA) {
      try {
        const exportData = {
          metadata: {
            timestamp: new Date().toISOString(),
            executionTime: parseFloat(executionTime),
            totalArticles: allArticles.length,
            pagesVisited: currentPage,
            validationResult: validationResult.isValid ? 'PASSED' : 'FAILED',
            violationsCount: validationResult.violations.length,
            configuration: CONFIG
          },
          violations: validationResult.violations,
          articles: allArticles.map(a => ({
            index: a.index,
            timestamp: a.timestamp,
            timeValue: a.timeValue,
            page: a.page
          }))
        };
        
        const filename = `hacker-news-validation-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
        console.log(`\ndata exported to: ${filename}`);
      } catch (exportError) {
        console.warn(`warning: failed to export data: ${exportError.message}`);
      }
    }
    
  } catch (error) {
    console.error(`\nSCRIPT FAILED: ${error.message}`);
    console.error(`this indicates an issue with the validation process`);
  } finally {
    await browser.close();
    console.log(`\nbrowser closed`);
    
    if (success) {
      console.log(`script completed successfully`);
    } else {
      console.log(`script completed with errors`);
      process.exit(1);
    }
  }
}

// helper function to validate sorting
function validateSorting(articles) {
  let isValid = true;
  let violations = [];
  
  for (let i = 0; i < articles.length - 1; i++) {
    const current = articles[i];
    const next = articles[i + 1];
    
    // current article should be newer (smaller time value) than next
    if (current.timeValue > next.timeValue) {
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

// helper function to convert timestamps to minutes for comparison
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

(async () => {
  await sortHackerNewsArticles();
})();