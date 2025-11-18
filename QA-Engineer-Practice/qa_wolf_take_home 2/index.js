// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  await page.goto("https://news.ycombinator.com/newest");
}

(async () => {
  await sortHackerNewsArticles();
})();



/* 
Goal:
Scrape through HackerNews page and make sure that it each article is chronological order according to the date posted (newest to oldest)

--- 1. Look at Hacker News and draft a plan ---

I took a few minutes to look over HackerNews page and this is what I noticed:
- the articles are numbered 1-30
- there are only 30 articles per page
- there is a more button
- clicking the more button loads a new page with the next 30 articles (#31-60, then #61-90)
--- * this means that I will have to paginate to at least 4 pages before reaching a total of 100 articles (articles 1-30, 31-60, 61-90, 91-120, then take the first 100) * 
- visible time documentation is 1 minute ago - 59 minutes ago then it goes to 1 hour ago and 2 hour ago
--- * this means that I will have to inspect the individual article link html to find more granular time data *

--- 2. Look at the article news html from multiple links to confirm time information is consistent
#7:  <span class="age" title="2025-11-14T22:24:36 1763159076"><a href="item?id=45932886">7 minutes ago</a></span>
#21: <span class="age" title="2025-11-14T21:57:19 1763157439"><a href="item?id=45932652">34 minutes ago</a></span>
#31: <span class="age" title="2025-11-14T21:36:22 1763156182"><a href="item?id=45932477">1 hour ago</a></span>
#75; <span class="age" title="2025-11-14T20:39:43 1763152783"><a href="item?id=45931908">2 hours ago</a></span>
--- * confirms descending ISO timestamps


Micro-task to start off and learn Playwright: write code that:

- waits for the page to load
- selects the FIRST article's <span class="age"> element
- gets its title attribute
- logs it to console 

that's it. just extract one timestamp from one article and print it.

*/

page.goto(url)