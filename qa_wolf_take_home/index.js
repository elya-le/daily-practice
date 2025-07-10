// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  await page.goto("https://news.ycombinator.com/newest");

  console.log("page loaded - investigating URL behavior");
  
  // wait for page to fully load
  await page.waitForTimeout(2000);
  
  // record initial state
  const initialUrl = page.url();
  const initialCount = await page.locator('tr .titleline').count();
  console.log(`initial URL: ${initialUrl}`);
  console.log(`initial articles: ${initialCount}`);

  // scroll to bottom and examine More button
  console.log("scrolling to More button...");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  const moreButton = page.locator('a').filter({ hasText: /more/i });
  
  if (await moreButton.count() > 0) {
    // check where More button points
    const moreHref = await moreButton.getAttribute('href');
    console.log(`More button href: ${moreHref}`);
    
    console.log("clicking More button...");
    await moreButton.click();
    
    // wait and check new state
    await page.waitForLoadState('networkidle');
    
    const afterUrl = page.url();
    const afterCount = await page.locator('tr .titleline').count();
    console.log(`URL after click: ${afterUrl}`);
    console.log(`articles after click: ${afterCount}`);
    
    // compare URLs
    if (initialUrl !== afterUrl) {
      console.log("✓ URL changed - More button navigates to new page");
    } else {
      console.log("× URL same - More button loads content inline");
    }
    
  } else {
    console.log("no More button found");
  }

  console.log("browser staying open for verification. press Ctrl+C to close.");
  await page.waitForTimeout(30000);
  
  await browser.close();
}

(async () => {
  await sortHackerNewsArticles();
})();