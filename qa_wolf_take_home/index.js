// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  await page.goto("https://news.ycombinator.com/newest");

  console.log("page loaded - collecting articles across multiple pages");
  
  let allArticles = [];
  let currentPage = 1;
  const targetCount = 100;
  
  // collect articles from multiple pages
  while (allArticles.length < targetCount) {
    console.log(`\n--- page ${currentPage} ---`);
    
    // wait for page to load
    await page.waitForTimeout(2000);
    
    // get articles from current page
    const articles = await page.locator('tr .titleline').count();
    console.log(`articles on page ${currentPage}: ${articles}`);
    
    // add to our total count
    allArticles.push(...Array(articles).fill(`page-${currentPage}-article`));
    console.log(`total articles collected: ${allArticles.length}`);
    
    // check if we have enough
    if (allArticles.length >= targetCount) {
      console.log(`\n✓ reached target! collected ${allArticles.length} articles`);
      // trim to exactly 100
      allArticles = allArticles.slice(0, targetCount);
      console.log(`trimmed to exactly ${allArticles.length} articles`);
      break;
    }
    
    // find and click More button for next page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    const moreButton = page.locator('a').filter({ hasText: /more/i });
    
    if (await moreButton.count() > 0) {
      console.log("clicking More for next page...");
      await moreButton.click();
      await page.waitForLoadState('networkidle');
      currentPage++;
    } else {
      console.log("no More button found - stopping collection");
      break;
    }
  }
  
  console.log(`\nfinal result: collected ${allArticles.length} articles from ${currentPage} pages`);
  console.log("browser staying open - ctrl+c to exit early");
  await page.waitForTimeout(30000);
  
  await browser.close();
}

(async () => {
  await sortHackerNewsArticles();
})();