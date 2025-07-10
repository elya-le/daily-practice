# My Approach - Learning Journal

## Day 1: QA Wolf Take-Home Assignment

### Step 1: Environment Setup and Basic Navigation
**Goal:** Get Playwright working and navigate to Hacker News

**What I did:**
- Confirmed Node.js installed (v18.20.2)
- Ran `npm i` - installed 6 packages with no vulnerabilities  
- Ran `npx playwright install` - downloaded browsers (Chromium, Firefox, Webkit)
- Created basic script that opens browser and navigates to Hacker News newest page

**Results:**
- Browser opens successfully
- Navigates to https://news.ycombinator.com/newest
- Can see articles with timestamps like "0 minutes ago", "2 minutes ago"
- Basic automation is working

**Learning:**
- Playwright launches browsers programmatically
- Can control browser navigation with `page.goto()`
- Assignment requires validating 100 articles are sorted newest to oldest

**Next:** Figure out how to select and count articles on the page