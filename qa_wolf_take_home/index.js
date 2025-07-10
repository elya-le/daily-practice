// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  await page.goto("https://news.ycombinator.com/newest");

  console.log("page loaded - analyzing article structure...");
  
  // reduce to 2 seconds but still wait for page to fully load
  await page.waitForTimeout(2000);
  
  // count different elements to understand page structure
  const totalRows = await page.locator('tr').count();
  console.log(`total table rows found: ${totalRows}`);
  
  // find rows that contain article titles
  const articleCount = await page.locator('tr .titleline').count();
  console.log(`articles found: ${articleCount}`);
  
  // keep browser open so we can verify what we're counting
  console.log("browser staying open for verification - ctrl+c to close");
  await page.waitForTimeout(10000);
  
  await browser.close();
}

(async () => {
  await sortHackerNewsArticles();
})();
