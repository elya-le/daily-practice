// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  await page.goto("https://news.ycombinator.com/newest");

  console.log("page loaded - validating article sorting");
  
  let allArticles = [];
  let currentPage = 1;
  const targetCount = 100;
  
  // collect articles from multiple pages
  while (allArticles.length < targetCount) {
    console.log(`\n--- page ${currentPage} ---`);
    
    // wait for page to load
    await page.waitForTimeout(2000);
    
    // extract article data from current page
    const articleElements = await page.locator('tr .titleline').all();
    
    // extract data from each article
    for (let i = 0; i < articleElements.length; i++) {
      const articleRow = articleElements[i].locator('xpath=ancestor::tr');
      const nextRow = articleRow.locator('xpath=following-sibling::tr[1]');
      
      const timeText = await nextRow.locator('text=/\\d+\\s+(minute|hour|day)s?\\s+ago/').first().textContent();
      
      const articleData = {
        index: allArticles.length + 1,
        timestamp: timeText || 'no timestamp found',
        timeValue: parseTimeToMinutes(timeText)
      };
      
      allArticles.push(articleData);
      
      if (allArticles.length >= targetCount) {
        break;
      }
    }
    
    console.log(`collected ${allArticles.length} articles so far`);
    
    if (allArticles.length >= targetCount) {
      break;
    }
    
    // navigate to next page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    const moreButton = page.locator('a').filter({ hasText: /more/i });
    
    if (await moreButton.count() > 0) {
      await moreButton.click();
      await page.waitForLoadState('networkidle');
      currentPage++;
    } else {
      break;
    }
  }
  
  // validate sorting
  console.log(`\n=== SORTING VALIDATION ===`);
  console.log(`validating ${allArticles.length} articles are sorted newest to oldest...`);
  
  let isValidSort = true;
  let violations = [];
  
  for (let i = 0; i < allArticles.length - 1; i++) {
    const current = allArticles[i];
    const next = allArticles[i + 1];
    
    // current article should be newer (smaller time value) than next
    if (current.timeValue > next.timeValue) {
      isValidSort = false;
      violations.push({
        position: i + 1,
        current: current.timestamp,
        next: next.timestamp,
        issue: `article ${i + 1} (${current.timestamp}) is older than article ${i + 2} (${next.timestamp})`
      });
    }
  }
  
  // report results
  if (isValidSort) {
    console.log(`SUCCESS: All ${allArticles.length} articles are properly sorted newest to oldest`);
  } else {
    console.log(`FAILURE: Found ${violations.length} sorting violations:`);
    violations.forEach(v => console.log(`   - ${v.issue}`));
  }
  
  // show sample data
  console.log(`\nfirst 10 articles:`);
  for (let i = 0; i < Math.min(10, allArticles.length); i++) {
    console.log(`${i + 1}. ${allArticles[i].timestamp} (${allArticles[i].timeValue} minutes)`);
  }
  
  await browser.close();
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