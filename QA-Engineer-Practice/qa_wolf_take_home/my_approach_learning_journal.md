### 1: research - going beyond basic requirements

**goal:** better understand what a typical day as a QA engineer at QA wolf will be and how to create a great customer or stakeholder experience given our product and results are very client-facing and not all clients are engineers, so bug testing needs an easy to read and decipher output

**what I researched:**
- re-read the assignment carefully: "consider going a step further—whether that means building a simple user interface, adding detailed error handling or reporting"
- read some of QA wolf's case studies to understand their actual workflow:
  - drata case study: "daily and weekly reporting" - they're regularly updating customers
  - scope3 case study: "24 hour turnaround for new test coverage" - fast communication is critical
  - metronome case study: "11-minute QA cycles" with "<1% flake rate" - they track and report metrics
- key observation: every case study mentions reporting and communication, not just testing

**what I realized:**
- QA wolf engineers don't just write tests - they communicate results to customers
- customers need to understand what's happening without being technical experts
- console logs work for me, but won't work for a product manager or stakeholder
- the assignment literally suggests "user interface" as an example of going beyond

**my idea:** 
build a live web dashboard where anyone can watch the test run in real-time and see results visually... I am not fully sure how this will pan out yet given its a clear straight forward test of validating 100 articles but I will find a way to tie it in. If I cant, I will leave out the feature

**technology research:**
looked at what tools could build this quickly:
- express.js: lightweight node.js web server (industry standard, simple to set up)
- socket.io: enables real-time updates from my test script to the browser
- both are production-grade and commonly used in professional QA platforms

**decision:** go with express + socket.io to build a live dashboard

**next:** install these packages and start building


### step 2: installing dashboard dependencies

**goal:** get the packages needed to build the web dashboard

**what I did:**
- ran `npm install express socket.io`
- checked package.json to confirm they were added

**results:**
- express and socket.io now listed in package.json dependencies
- when reviewers run `npm install` on my submission, these will auto-install
- verified with `npm list express socket.io`

**next:** create the folder structure for dashboard files