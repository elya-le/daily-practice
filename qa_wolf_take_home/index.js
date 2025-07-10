// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  await page.goto("https://news.ycombinator.com/newest");

  console.log("Successfully navigated to Hacker News newest page");
  
  // Keep browser open for 5 seconds so we can see it worked
  await page.waitForTimeout(5000);
  
  await browser.close();
  console.log("Browser closed - basic setup working!");
}

(async () => {
  await sortHackerNewsArticles();
})();
