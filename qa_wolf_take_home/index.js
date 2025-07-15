// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  const browser = await chromium.launch({ headless: false });
  let success = false;
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("starting Hacker News sorting validation...");
    console.log("navigating to https://news.ycombinator.com/newest");
    
    // navigate with timeout and error handling
    await page.goto("https://news.ycombinator.com/newest", { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    console.log("page loaded successfully");
    
    let allArticles = [];
    let currentPage = 1;
    const targetCount = 100;
    const startTime = Date.now();
    
    // collect articles from multiple pages
    while (allArticles.length < targetCount) {
      console.log(`\n--- collecting from page ${currentPage} ---`);
      
      // wait for content to load
      await page.waitForTimeout(2000);
      
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
            
            if (allArticles.length >= targetCount) {
              console.log(`reached target of ${targetCount} articles!`);
              break;
            }
          } catch (error) {
            console.warn(`warning: failed to extract article ${i + 1} on page ${currentPage}: ${error.message}`);
          }
        }
        
        console.log(`total articles collected: ${allArticles.length}/${targetCount}`);
        
      } catch (error) {
        console.error(`error extracting articles from page ${currentPage}: ${error.message}`);
        break;
      }
      
      if (allArticles.length >= targetCount) {
        break;
      }
      
      // navigate to next page
      try {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
        
        // use more specific selector for the More button
        const moreButton = page.locator('a.morelink');
        
        if (await moreButton.count() > 0) {
          console.log("navigating to next page...");
          await moreButton.click();
          await page.waitForLoadState('networkidle', { timeout: 15000 });
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
    if (allArticles.length < targetCount) {
      throw new Error(`only collected ${allArticles.length} articles, need ${targetCount}`);
    }
    
    // trim to exactly 100 articles
    allArticles = allArticles.slice(0, targetCount);
    
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