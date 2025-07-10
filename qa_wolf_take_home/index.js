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

  // scroll to bottom 
  console.log("scrolling to More button...");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // click More button
  const moreButton = page.locator('a').filter({ hasText: /more/i });
  
  if (await moreButton.count() > 0) {
    console.log("clicking More button...");
    await moreButton.click();
    
    // wait for network to be completely idle
    console.log("waiting for content to fully load...");
    await page.waitForLoadState('networkidle');
    
    // try different counting methods
    console.log("testing different counting methods...");
    
    const method1 = await page.locator('tr .titleline').count();
    console.log(`method 1 (tr .titleline): ${method1}`);
    
    const method2 = await page.locator('.titleline').count();
    console.log(`method 2 (.titleline only): ${method2}`);
    
    const method3 = await page.locator('a.titlelink').count();
    console.log(`method 3 (a.titlelink): ${method3}`);
    
    // additional wait and recount
    await page.waitForTimeout(3000);
    const finalCount = await page.locator('tr .titleline').count();
    console.log(`final recount: ${finalCount}`);
    
  } else {
    console.log("no More button found");
  }

  console.log("browser staying open - manually count articles to verify - ctrl+c to close earlier");
  await page.waitForTimeout(30000);
  
  await browser.close();
}

(async () => {
  await sortHackerNewsArticles();
})();