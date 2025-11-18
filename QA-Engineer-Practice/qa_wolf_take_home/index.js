// QA Wolf Take-Home Submission (Robust & Enhanced)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// Helper: parse relative time from Hacker News (e.g., "5 minutes ago")
function parseRelativeTime(text) {
  const now = Date.now();
  const match = text.match(/(\d+)\s+(minute|hour|day)s?\s+ago/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "minute": return now - value * 60 * 1000;
    case "hour": return now - value * 60 * 60 * 1000;
    case "day": return now - value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

async function sortHackerNewsArticles() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const articles = [];
  let pageCount = 1;

  async function safeGoto(url) {
    try {
      await page.goto(url, { waitUntil: "networkidle" });
    } catch (err) {
      console.error("Failed to load page, retrying...", err.message);
      await page.waitForTimeout(1000);
      await page.goto(url, { waitUntil: "networkidle" });
    }
  }

  await safeGoto("https://news.ycombinator.com/newest");

  while (articles.length < 100) {
    const rows = await page.$$(".athing");
    for (const row of rows) {
      if (articles.length >= 100) break;

      const id = await row.getAttribute("id");
      let ageText = null;
      let timestamp = null;

      try {
        const ageElement = await row.evaluateHandle(r => r.nextElementSibling?.querySelector(".age"));
        if (ageElement) {
          ageText = await ageElement.evaluate(el => el.getAttribute("title") || el.innerText);
          timestamp = ageText
            ? new Date(ageText).getTime() || parseRelativeTime(ageText)
            : null;
        }
      } catch (err) {
        console.warn(`Could not get age for article ${id}: ${err.message}`);
      }

      // Only include articles with valid timestamps
      if (timestamp) {
        articles.push({ id, age: ageText, timestamp });
      } else {
        console.warn(`Skipping article ${id}: invalid timestamp`);
      }
    }

    if (articles.length < 100) {
      const moreLink = await page.$("a.morelink");
      if (!moreLink) break;
      await moreLink.click();
      await page.waitForLoadState("networkidle");
      pageCount++;
    }
  }

  // Ensure exactly 100 valid articles
  const slicedArticles = articles.slice(0, 100);

  // Validate descending order
  const violations = [];
  for (let i = 0; i < slicedArticles.length - 1; i++) {
    if (slicedArticles[i].timestamp < slicedArticles[i + 1].timestamp) {
      violations.push(
        `Sort violation at index ${i}: ${slicedArticles[i].id} is older than ${slicedArticles[i + 1].id}`
      );
    }
  }

  if (violations.length) {
    console.error("Sorting validation failed:", violations);
  } else {
    console.log("All 100 articles are correctly sorted from newest to oldest.");
  }

  const summary = {
    runTimestamp: new Date().toISOString(),
    totalArticlesChecked: slicedArticles.length,
    newestArticle: slicedArticles[0],
    oldestArticle: slicedArticles[slicedArticles.length - 1],
    violationsCount: violations.length,
    pageCount,
    violations
  };

  fs.writeFileSync("summary.json", JSON.stringify(summary, null, 2));
  console.log("JSON summary saved: summary.json");

  // Create simple HTML dashboard
  const html = `
  <html>
    <head>
      <title>Hacker News QA Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background-color: #f4f4f4; }
        .success { color: green; }
        .error { color: red; }
      </style>
    </head>
    <body>
      <h1>Hacker News QA Report</h1>
      <p>Run Timestamp: ${summary.runTimestamp}</p>
      <p>Total Articles Checked: ${summary.totalArticlesChecked}</p>
      <p>Violations Count: <span class="${violations.length ? 'error' : 'success'}">${violations.length}</span></p>
      <h2>Newest Article</h2>
      <p>ID: ${summary.newestArticle.id} | Age: ${summary.newestArticle.age}</p>
      <h2>Oldest Article</h2>
      <p>ID: ${summary.oldestArticle.id} | Age: ${summary.oldestArticle.age}</p>
      <h2>Articles Table</h2>
      <table>
        <tr><th>ID</th><th>Age</th></tr>
        ${slicedArticles.map(a => `<tr><td>${a.id}</td><td>${a.age}</td></tr>`).join('')}
      </table>
    </body>
  </html>
  `;

  const reportPath = path.join(__dirname, "report.html");
  fs.writeFileSync(reportPath, html);
  console.log("HTML dashboard saved: report.html");

  // Auto-open report in default browser (cross-platform)
  const startCommand = process.platform === "win32" ? "start" :
                        process.platform === "darwin" ? "open" :
                        "xdg-open";
  exec(`${startCommand} "${reportPath}"`);

  await browser.close();
}

// Run script
sortHackerNewsArticles().catch(err => {
  console.error("Script failed:", err.message);
  process.exit(1);
});
