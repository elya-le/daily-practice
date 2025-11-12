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


### step 2: installing dashboard packages dependencies

**goal:** get the packages needed to build the web dashboard

**what I did:**
- ran `npm install express socket.io`
- checked package.json to confirm they were added

**results:**
- express and socket.io now listed in package.json dependencies
- when reviewers run `npm install` on my submission, these will auto-install
- verified with `npm list express socket.io`


### step 3: creating project structure for dashboard

**goal:** organize files so dashboard code is separate from test code

**what I did:**
- created `public/` folder for dashboard frontend files (HTML, CSS, JavaScript)
- created `test-history/` folder to store past test runs as JSON files

**why this structure:**
- keeps dashboard code separate from test automation code
- `public/` is standard naming for web server static files
- `test-history/` will let users see previous test runs (building a history feature)

**project structure now:**

```
qa_wolf_take_home/
├── public/              ← new: dashboard frontend
├── test-history/        ← new: historical test data
├── index.js             (existing test script)
├── package.json         (dependencies)
└── other files...
```

**learning:**
- planning file organization before coding prevents messy refactoring later
- separating frontend (what users see) from backend (test logic) is standard practice
- empty folders are fine - we'll populate them in next steps

### step 4: create the express server for dashboard

**goal:** serve the web dashboard and enable real-time test updates

**what I did:**
- created `server.js` using express and socket.io
- added endpoint `/api/history` to serve last 10 test runs
- exported `io` globally so `index.js` can emit real-time events
- ran `node server.js` to verify server starts

**why this matters:**
- separates frontend (dashboard) from test automation code
- allows non-technical stakeholders to watch test progress live
- mimics professional QA platforms that provide dashboards and reporting

**learning:**
- express static middleware serves frontend files
- socket.io enables live communication between Node.js and browser
- planning for test history now avoids rework later
- I had used Socket.io before when building a realtime messaging and wanted to bring that skill back here — it felt like a good fit for real-time test updates
