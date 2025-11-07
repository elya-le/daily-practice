// 1. ASYNC/AWAIT AND PROMISES (for handling asynchronous operations in Playwright)
/* 
Every single line of Playwright code I write will be asynchronous.
So I need to be very comfortable with async/await syntax.
This means I need to understand Promises well enough to know when to use await.
A Promise is an object representing the eventual completion or failure of an asynchronous operation.
When I use the 'await' keyword, it makes JavaScript wait until that Promise settles and
returns its result.
This is crucial for writing reliable test scripts because I need to ensure that each step
completes before moving on to the next one.
For example, when navigating to a page or waiting for an element to appear, I must await
those actions to ensure they are fully completed before proceeding.
This prevents race conditions and flaky tests.
*/

/* 
The problem async/await solves with a real world analogy:

Imagine I am making breakfast...
in the Synchronous ('Normal') way:
1. I put bread in the toaster.
2. Stand there waiting for the toast to pop up for 2 minutes.
3. Once the toast pops up, I take it out and spread butter on it.
4. Then I make coffee.
5. Stand there waiting for the coffee to brew for 5 minutes.
6. Drink the coffee.
7. Eat the toast.

Total time: 7 minutes of actual work + waiting time.

But if I use Asynchronous (async/await) way:
1. I put bread in the toaster and set a timer for 2 minutes.
2. While the toast is toasting, I start making coffee.
3. I set a timer for 5 minutes for the coffee to brew.
4. When the toast pops up (after 2 minutes), I take it out and spread butter on it.
5. After 5 minutes, the coffee is ready, and I drink it
6. Eat the toast.

Total time: 5 minutes of actual work + waiting time, but I was productive during the waiting periods.
*/


// 2. Array Methods (for data manipulation)
// 3. Error Handling (for reliable test scripts)