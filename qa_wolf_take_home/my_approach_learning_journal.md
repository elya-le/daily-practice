# My Approach - Learning Journal

## day 1: QA Wolf take-home assignment

### step 1: environment setup and basic navigation
**goal:** get playwright working and navigate to Hacker News

**what I did:**
- confirmed Node.js installed (v18.20.2)
- ran `npm i` - installed 6 packages with no vulnerabilities  
- ran `npx playwright install` - downloaded browsers (Chromium, Firefox, Webkit)
- created basic script that opens browser and navigates to Hacker News newest page

**results:**
- browser opens successfully
- navigates to https://news.ycombinator.com/newest
- can see articles with timestamps like "0 minutes ago", "2 minutes ago"
- basic automation is working

**learning:**
- playwright launches browsers programmatically
- can control browser navigation with `page.goto()`
- assignment requires validating 100 articles are sorted newest to oldest

**next:** figure out how to select and count articles on the page



### step 2: understanding page structure and finding articles
**goal:** learn how to identify and count articles using CSS selectors

**what I did:**
- added code to count total table rows (`tr` elements)
- used CSS selector `tr .titleline` to find actual articles
- added console logging to see the numbers

**results:**
- total table rows: 98 (includes headers, spacing, navigation, etc.)
- articles with .titleline class: 30 
- this means only 30 articles are visible on initial page load

**learning:**
- HTML structure: Hacker News uses table rows (`<tr>`) for layout
- CSS classes: `.titleline` is the class name for article titles
- CSS selectors: `tr .titleline` means "table rows containing elements with titleline class"
- problem identified: need 100 articles but only see 30

**key insight:** Hacker News loads articles in batches - need to load more to reach 100

**next:** investigate how to load more articles (likely a "more" button)



### step 3: locating the "More" button
**goal:** find the button that loads additional articles

**what I did:**
- used case-insensitive regex `/more/i` to find More button regardless of capitalization
- counted initial articles and More buttons
- kept browser open to manually verify button location

**results:**
page loaded - looking for more button
initial articles found: 30
'More' buttons found: 1
'More' button exists! ready to click it in next step.
browser staying open. scroll down to see the More button.

**learning:**
- regular expressions with `/more/i` flag make text matching case-insensitive
- defensive programming: handle different text cases
- Playwright `.filter()` can use regex patterns for flexible matching

**next:** implement clicking the 'More' button and loading additional articles