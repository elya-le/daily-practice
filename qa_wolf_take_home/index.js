// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  await page.goto("https://news.ycombinator.com/newest");

  console.log("page loaded - looking for more button");
  
  // wait for page to fully load
  await page.waitForTimeout(2000);
  
  // count initial articles
  const inititalCount = await page.locator('tr .titleline').count();
  console.log(`initial articles found: ${inititalCount}`);

  //look for "More" button in either case
  const moreButton = page.locator('a').filter({ hasText: /more/i });
  const moreButtonCount = await moreButton.count();
  console.log(`'More' buttons found: ${moreButtonCount}`);

  if (moreButtonCount > 0) {
    console.log("'More' button exists! ready to click it in next step.");
  } else {
    console.log("no 'More' button found - need to investigate");
  }

  // keep browser open for investigation
  console.log("browser staying open. scroll down to see the More button.");
  await page.waitForTimeout(15000);
  
  await browser.close();
}

(async () => {
  await sortHackerNewsArticles();
})();
