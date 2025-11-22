# Goals 
- Write a robust test script that validates/confirms the first 100 HN articles are sorted from newest to oldest.
- Clear logic that a fellow QA Engineer/Co-worker can easily review and duplicate testing
- Keep customer experience front of mind - include additional digest-able HTML report that is useful for customer as well as coworkers

# Initial observations
- Articles numbered 1-30 per page 
- More button at bottom to paginate to next 30 articles
- Need to paginate to 4 pages to reach 100 articles
(page 1 gets us 30, page 2 gets us 30 more, page 3 another 30, then I grab the first 10 from page 4)
- Visible timestamps show "1 minute ago" up to "59 minutes ago" then jumps to "1 hour ago" and "2 hours ago"
- More granular timestamp data needed for precise sorting validation

Timestamp attribute structure and ruling out Playwright locator logic:
- visible text: "14 minutes ago" (in link text, user-facing)
- title attribute: "2025-11-21T20:14:15 1763756055" (ISO timestamp : Unix epoch timestamp)
- title attribute contains the precise data we need, but it's hidden from users visually

Ruling out :
- getByRole("link"), we'll match all 6+ links in that row—not just the timestamp.
Age link ("14 minutes ago") ← The one we want but there are aso 
Vote arrow link, user profile link, hide link, algolia search link, discuss link

# Extract timestamps logic:





I initially tried page.locator('.age').first(), which could have worked with simpler syntax,
but the Playwright recommend user-facing attributes and explicit contracts like page.getByRole() instead.
page.locator('.age').first() can be fragile as it relies on CSS classes and element order. 
Since each timestamp link has role "link" with visible text "ago", 
I'm using page.getByRole('link', { name: /ago/i }) to reliably locate them. 
Then I loop through each link, traverse up to its parent span.age element, extract the title attribute 
(which holds the Unix epoch), parse out the number, `and push it to an array. 
I also handle edge cases where the title is missing or the regex doesn't match, pushing null and tracking errors.

# Validation logic:
100 timestamps are collected we then loop compare each one to the next one in the sequence. 
If an article is older than the one after it, the list is out of order and that's an error. 
If two articles were posted within one minute of each other, that's acceptable 
but I flag them as "same-minute" pairs since the visible timestamps might not round the same way. (See edge case below)
If an article is newer than the one after it, that's the correct order and everything is fine. 

Tracking results and error handling:
While validating, I keep track of how many comparisons pass, how many fail, and I maintain a list of same-minute pairs. 
If no timestamps are found on a page, I stop and report an error
If I can't extract a timestamp from any article, I stop and report
If an out-of-order article is found, that gets reported as an error
If the "More" button is missing before I've collected enough articles, I stop and report that too
For network timeouts or other unexpected issues, I log the error and exit

# Edge-case observed:
I noticed two articles showing up slightly out of order because their visible timestamps were rounded 
— one showed “54 minutes ago” and the next one “53 minutes ago.” 
However, when I checked their actual Unix epoch timestamps, the posting order was correct.
Because of this, items posted within the same minute are flagged separately instead of being treated as true ordering errors.

# Final reporting:
At the end I generate a summary that shows the total number of articles I checked, 
the number of same-minute pairs I flagged, how many errors I encountered, and the overall pass or fail result.

# Additional considerations:
I'm not worried about duplicate articles since the site is dynamic and I just need to validate sorting order. 
Network timeouts could happen but for this assignment I'll just log the error and exit if that occurs.

Future next step improvements I am going to make next:
Beyond this assignment, I want to generate an HTML report with all the results laid out nicely. 
I also need to review my error handling to make sure I've covered all possible failure points, 
and then draft retry logic where it makes sense. Finally, I should clean up and standardize 
the console reporting format so it's easier to read through the results.
*/






# 🐺 QA Wolf Take Home Assignment

Welcome to the QA Wolf take home assignment for our [QA Engineer](https://www.task-wolf.com/apply-qae) role! We appreciate your interest and look forward to seeing what you come up with.

## Instructions

This assignment has two questions as outlined below. When you are done, upload your assignment to our [application page](https://www.task-wolf.com/apply-qae):


### Question 1

In this assignment, you will create a script on [Hacker News](https://news.ycombinator.com/) using JavaScript and Microsoft's [Playwright](https://playwright.dev/) framework. 

1. Install node modules by running `npm i`.

2. Edit the `index.js` file in this project to go to [Hacker News/newest](https://news.ycombinator.com/newest) and validate that EXACTLY the first 100 articles are sorted from newest to oldest. You can run your script with the `node index.js` command.

Note that you are welcome to update Playwright or install other packages as you see fit, however you must utilize Playwright in this assignment.

### Question 2

Why do you want to work at QA Wolf? Please record a short, ~2 min video using [Loom](https://www.loom.com/) that includes:

1. Your answer 

2. A walk-through demonstration of your code, showing a successful execution

The answer and walkthrough should be combined into *one* video, and must be recorded using Loom as the submission page only accepts Loom links.

## Frequently Asked Questions

### What is your hiring process? When will I hear about next steps?

This take home assignment is the first step in our hiring process, followed by a final round interview if it goes well. **We review every take home assignment submission and promise to get back to you either way within two weeks (usually sooner).** The only caveat is if we are out of the office, in which case we will get back to you when we return. If it has been more than two weeks and you have not heard from us, please do follow up.

The final round interview is a 2-hour technical work session that reflects what it is like to work here. We provide a $150 stipend for your time for the final round interview regardless of how it goes. After that, there may be a short chat with our director about your experience and the role.

Our hiring process is rolling where we review candidates until we have filled our openings. If there are no openings left, we will keep your contact information on file and reach out when we are hiring again.

### Having trouble uploading your assignment?
Be sure to delete your `node_modules` file, then zip your assignment folder prior to upload. 

### How do you decide who to hire?

We evaluate candidates based on three criteria:

- Technical ability (as demonstrated in the take home and final round)
- Customer service orientation (as this role is customer facing)
- Alignment with our mission and values (captured [here](https://qawolf.notion.site/Mission-and-Values-859c7d0411ba41349e1b318f4e7abc8f))

This means whether we hire you is based on how you do during our interview process, not on your previous experience (or lack thereof). Note that you will also need to pass a background check to work here as our customers require this.

### How can I help my application stand out?

While the assignment has clear requirements, we encourage applicants to treat it as more than a checklist. If you're genuinely excited about QA Wolf, consider going a step further—whether that means building a simple user interface, adding detailed error handling or reporting, improving the structure of the script, or anything else that showcases your unique perspective.

There's no "right" answer—we're curious to see what you choose to do when given freedom and ambiguity. In a world where tools can help generate working code quickly and make it easier than ever to complete technical take-homes, we value originality and intentionality. If that resonates with you, use this assignment as a chance to show us how you think.

Applicants who approach the assignment as a creative challenge, not just a checklist, tend to perform best in our process.
