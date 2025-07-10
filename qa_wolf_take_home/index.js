// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  await page.goto("https://news.ycombinator.com/newest");

  console.log("page loaded - testing More button click");
  
  // wait for page to fully load
  await page.waitForTimeout(2000);
  
  // count initial articles
  const initialCount = await page.locator('tr .titleline').count();
  console.log(`initial articles found: ${initialCount}`);

  // find and click the More button
  const moreButton = page.locator('a').filter({ hasText: /more/i });
  const moreButtonCount = await moreButton.count();
  
  if (moreButtonCount > 0) {
    console.log("clicking More button...");
    await moreButton.click();
    
    // wait for new content to load
    console.log("waiting for new articles to load...");
    await page.waitForTimeout(3000);
    
    // count articles after clicking
    const afterClickCount = await page.locator('tr .titleline').count();
    console.log(`articles after clicking More: ${afterClickCount}`);
    
    const newArticles = afterClickCount - initialCount;
    console.log(`new articles loaded: ${newArticles}`);
    
  } else {
    console.log("no More button found");
  }

  // keep browser open to see results
  console.log("browser staying open to verify results. ctrl+c to close earlier");
  await page.waitForTimeout(20000);
  
  await browser.close();
}

(async () => {
  await sortHackerNewsArticles();
})();