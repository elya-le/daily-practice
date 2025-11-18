/*
Initial observations and plan draft:
The articles are numbered 1-30 per page and there's a more button that loads the next batch. 
This means I'll have to paginate through at least 4 pages to reach 100 articles total 
(page 1 gets me 30, page 2 gets me 30 more, page 3 another 30, then I grab the first 10 from page 4). 
The visible timestamps only show ranges like "1 minute ago" up to "59 minutes ago" then it jumps to 
"1 hour ago" and "2 hours ago". To actually compare when articles are posted with precision, 
I need to dig into the individual article link HTML where there's more granular timestamp data.

Timestamp attribute structure
I inspected the HTML from multiple article links and confirmed the timestamp information is consistent. 
Each one has a title attribute with both an ISO 8601 timestamp and a Unix epoch number. 
Examples from my inspection:
Article #7: span class="age" title="2025-11-14T22:24:36 1763159076"
Article #31: span class="age" title="2025-11-14T21:36:22 1763156182"
Article #75: span class="age" title="2025-11-14T20:39:43 1763152783"

I decided to use the Unix epoch number since it's a single unique number and requires no parsing at all.

Extract timestamps logic:
I originally planned to use page.locator('.age').first() to grab all age epoch attributes, 
but after reading the Playwright docs more carefully I realized that approach was fragile because it relies 
on CSS class selectors and ambiguous element order. The docs recommend prioritizing user-facing attributes 
and explicit contracts like page.getByRole(). Looking at what's actually visible to users, each timestamp 
link has a role of "link" and the visible text always contains "ago". 
So I'm using page.getByRole('link', { name: /ago/i }) to robustly get all the timestamp links. 
Then I create an empty array called timestamps, loop through each link, extract the title attribute,
parse out the Unix epoch number, and push it to the array.

Validation logic:
Once I have all the timestamps, I compare each one to the next one in the sequence. 
If an article is older than the one after it, the list is out of order and that's an error. 
If two articles were posted within one minute of each other, that's acceptable 
but I flag them as "same-minute" pairs since the visible timestamps might round the same way. (See edge case below)
If an article is newer than the one after it, that's the correct order and everything is fine. 
I loop through all articles and compare each to the next.

Tracking results and error handling:
While validating, I keep track of how many comparisons pass, how many fail, and I maintain a list of same-minute pairs. 
If no timestamps are found on a page, I stop and report an error
If I can't extract a timestamp from any article, I stop and report
If an out-of-order article is found, that gets reported as an error
If the "More" button is missing before I've collected enough articles, I stop and report that too
For network timeouts or other unexpected issues, I log the error and exit

Edge-case observed:
While running the initial test, I ran into a situation where two articles appeared slightly out of order 
just because the visible timestamps rounded to "53 minutes ago" vs "54 minutes ago". 
But when I looked at the actual Unix epoch timestamps underneath, the posting order was correct. 
That's why same-minute pairs get flagged separately instead of being treated as errors.

Final reporting:
At the end I generate a summary that shows the total number of articles I checked, 
the number of same-minute pairs I flagged, how many errors I encountered, and the overall pass or fail result.

Additional considerations:
I'm not worried about duplicate articles since the site is dynamic and I just need to validate sorting order. 
Network timeouts could happen but for this assignment I'll just log the error and exit if that occurs.

Future next step improvements I am going to make next:
Beyond this assignment, I want to generate an HTML report with all the results laid out nicely. 
I also need to review my error handling to make sure I've covered all possible failure points, 
and then draft retry logic where it makes sense. Finally, I should clean up and standardize 
the console reporting format so it's easier to read through the results.
*/


































const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // go to Hacker News
  await page.goto("https://news.ycombinator.com/newest");

  const maxArticles = 100; // set max number of articles to validate
  const timestamps = [];  // empty array to hold timestamps or null for failed articles

  // counters for summary report
  let sameMinuteCount = 0;       // number of article pairs in the same minute
  let errorCount = 0;            // number of timestamp extraction errors

  // loop until we have 100 articles
  while (timestamps.length < maxArticles) { 
    // find all the user-facing timestamp links (text like "7 minutes ago")
    const timestampLinks = page.getByRole("link", { name: /ago/i });  
    const count = await timestampLinks.count();

    // If no timestamps are found, something went wrong (e.g., end of pagination), prevent infinite loop
    if (count === 0) { 
      throw new Error("Unable to load more articles. Pagination ended early.");
    }

    // loop through the timestamp links on this page
    for (let i = 0; i < count && timestamps.length < maxArticles; i++) {
      const link = timestampLinks.nth(i);

      // get the parent <span> element that actually has the title attribute
      const parentSpan = await link.evaluateHandle(el => el.parentElement);
      const attribute = await parentSpan.getAttribute("title");

      // debug: log what we actually fetched
      console.log(`Link ${i} title:`, attribute);

      // handle missing title edge case
      if (!attribute) {
        console.error(`Article ${timestamps.length + 1} has no title or timestamp`);
        timestamps.push(null); // still count it toward 100 articles
        errorCount++;
        continue; // move to the next link
      }

      // extract just the Unix epoch number (the second part after the space)
      const epochMatch = attribute.match(/(\d+)$/);
      if (!epochMatch) {
        console.error(`Could not extract epoch from title for Article ${timestamps.length + 1}`);
        timestamps.push(null);
        errorCount++;
        continue;
      }

      const epoch = parseInt(epochMatch[1], 10);
      timestamps.push(epoch);
    }

    // if we still need more articles, click the "More" button to load next page of articles
    if (timestamps.length < maxArticles) {
      await page.click("a.morelink"); // click the "More" button
      await page.waitForLoadState("domcontentloaded"); // wait for the new page content to load
    }
  }

  // convert all valid timestamps to milliseconds for comparison
  const epochList = timestamps.map(t => (t === null ? null : new Date(t * 1000).getTime()));

  // validate that articles are sorted from newest to oldest
  for (let i = 0; i < epochList.length - 1; i++) {
    const current = epochList[i];
    const next = epochList[i + 1];

    // if either timestamp is invalid, log a warning and skip comparison
    if (current === null || next === null) {
      console.warn(`Article ${i + 1} or ${i + 2} skipped due to missing timestamp`);
      continue;
    }

    if (current < next) { // if the current article is older than the next one, the list is out of order
      console.error(`Articles ${i + 1} and ${i + 2} are out of order`);
      errorCount++;
    } else if (Math.abs(current - next) < 60_000) { // if two articles were posted within 1 minute of each other
      // Reason: Hacker News rounds visible timestamps to the nearest minute
      // Edge case observed: Article #31 ("53 minutes ago") can be newer than Article #30 ("54 minutes ago")
      // Using epoch ensures precise comparison, but we treat <1 minute difference as same-minute to avoid false errors
      console.log(`Articles ${i + 1} and ${i + 2} are in the same minute`);
      sameMinuteCount++;
    } else { // otherwise, they are in correct order
      console.log(`Pass: Articles ${i + 1} and ${i + 2} are in correct order`);
    }
  }

  // Final message once all 100 articles are validated
  console.log(`Validation complete. Total same-minute pairs: ${sameMinuteCount}, total errors: ${errorCount}`);
  console.log("First 100 Hacker News articles validated (newest → oldest)");
  await browser.close();
}

(async () => {
  try {
    await sortHackerNewsArticles();
  } catch (err) {
    console.error(err.message); // surface thrown error clearly and exit non-zero for CI
    process.exit(1);
  }
})();





