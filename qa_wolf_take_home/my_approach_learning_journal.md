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

### step 4a: clicking the More button
**goal:** test clicking More button to load additional articles

**what I did:**
- implemented `moreButton.click()` to click the button
- added wait time for new content to load
- compared article counts before and after clicking

**results:**
- initial articles found: 30
- clicking More button... ✓
- articles after clicking More: 30 (same count)
- new articles loaded: 0

**key discovery:** the More button DOES work - I can visually see more articles loaded on the page, but for some reason the counting code didn't detect them

**learning:**
- visual verification vs programmatic counting can give different results
- More button successfully loads content but timing or selector issues affect counting
- need to investigate why the count didn't increase

**next:** debug the counting issue and fix the article detection

### step 4b: debugging the counting issue
**goal:** fix the article counting after More button click

**what I tested:**
- different CSS selectors for counting articles
- using `waitForLoadState('networkidle')` for better timing
- multiple counting attempts with different wait strategies

**results:**
- method 1 (tr .titleline): 30
- method 2 (.titleline only): 30  
- method 3 (a.titlelink): 0
- final recount: 30

**key finding:** all counting methods still show 30 articles even though I can visually see more articles loaded

**hypothesis:** either the More button navigates to a completely new page (replacing content) or there's a fundamental issue with my selector strategy

**next step:** investigate if More button navigates to new page vs loading content inline


### step 4c: investigating URL behavior - mystery solved!
**goal:** understand why counting wasn't working after More button click

**what I tested:**
- captured URLs before and after More button click
- examined the More button's href attribute
- compared article counts on new page

**results:**
- initial URL: https://news.ycombinator.com/newest
- More button href: newest?next=44526207&n=31
- URL after click: https://news.ycombinator.com/newest?next=44526207&n=31
- articles after click: 30
- ✓ URL changed - More button navigates to new page

**key discovery:** the More button doesn't load additional content on the same page - it navigates to a completely NEW page with the next 30 articles!

**understanding the URL parameters:**
- `next=44526207` - indicates starting point for next batch
- `n=31` - indicates starting from article 31

**learning:**
- Hacker News uses pagination instead of infinite scroll
- each "More" click gets a new page with next 30 articles
- our counting was correct - each page has exactly 30 articles
- to get 100 articles, we need to collect from multiple pages

**strategy update:** need to click More multiple times and collect articles from each page, or navigate through pagination URLs directly

**next:** implement strategy to collect 100 articles across multiple pages