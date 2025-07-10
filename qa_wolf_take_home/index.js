// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  await page.goto("https://news.ycombinator.com/newest");

  console.log("page loaded - extracting article timestamps");
  
  let allArticles = [];
  let currentPage = 1;
  const targetCount = 100;
  
  // collect articles from multiple pages
  while (allArticles.length < targetCount) {
    console.log(`\n--- page ${currentPage} ---`);
    
    // wait for page to load
    await page.waitForTimeout(2000);
    
    // extract article data from current page
    console.log("extracting article data...");
    
    // get all article elements
    const articleElements = await page.locator('tr .titleline').all();
    console.log(`found ${articleElements.length} article elements on page ${currentPage}`);
    
    // extract data from each article
    for (let i = 0; i < articleElements.length; i++) {
      // find the timestamp for this article (it's in the next row)
      const articleRow = articleElements[i].locator('xpath=ancestor::tr');
      const nextRow = articleRow.locator('xpath=following-sibling::tr[1]');
      
      // look for timestamp text (contains "ago")
      const timeText = await nextRow.locator('text=/\\d+\\s+(minute|hour|day)s?\\s+ago/').first().textContent();
      
      const articleData = {
        page: currentPage,
        index: allArticles.length + 1,
        timestamp: timeText || 'no timestamp found'
      };
      
      allArticles.push(articleData);
      
      if (allArticles.length >= targetCount) {
        console.log(`reached target of ${targetCount} articles!`);
        break;
      }
    }
    
    console.log(`collected ${allArticles.length} articles so far`);
    
    // check if we have enough
    if (allArticles.length >= targetCount) {
      break;
    }
    
    // navigate to next page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    const moreButton = page.locator('a').filter({ hasText: /more/i });
    
    if (await moreButton.count() > 0) {
      console.log("navigating to next page...");
      await moreButton.click();
      await page.waitForLoadState('networkidle');
      currentPage++;
    } else {
      console.log("no More button found - stopping collection");
      break;
    }
  }
  
  // show first few articles with timestamps
  console.log(`\nfirst 10 articles with timestamps:`);
  for (let i = 0; i < Math.min(10, allArticles.length); i++) {
    console.log(`${i + 1}. ${allArticles[i].timestamp}`);
  }
  
  console.log(`\ntotal articles collected: ${allArticles.length}`);
  console.log("browser staying open - ctrl+C to close early");
  await page.waitForTimeout(30000);
  
  await browser.close();
}

(async () => {
  await sortHackerNewsArticles();
})();