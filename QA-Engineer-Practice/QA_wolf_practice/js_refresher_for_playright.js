// 1. ASYNC/AWAIT AND PROMISES (for handling asynchronous operations in Playwright)
/* 
The Playwright code I write will be asynchronous.
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

// Synchronous vs Asynchronous code example

// Synchronous (blocking)
const data = getDataFromServer(); // freezes here for 3 seconds until data is returned
console.log(data); // only runs after above finishes
console.log('done')

// output:
// [3 second pause]
// [data appears]
// done

// Asynchronous with Promises (non-blocking)
getDataFromServer().then(data => {
    console.log(data); // runs when data is returned
});
console.log('done') // runs immediately without waiting

// output:
// done
// [3 second pause]
// [data appears]

// the  second example doesnt block the execution of the rest of the code
// the program can continue running other tasks while waiting for the data

// what is a Promise?
// a promise is like a receipt for something you ordered but havent received yet

/* real world analogy of a Promise:
Ordering a pizza:
1. I order a pizza
2. the restaurant gives me a receipt (the Promise)
3. I can go do other things while I wait (non blocking - the program continues running)
4. when the pizza is ready, I get notified (the Promise is fulfilled)
or! if something goes wrong, I get an error message (the Promise is rejected)
*/

// code example of a Promise

// function that returns a Promise
function orderPizza() {
  return new Promise((resolve, reject) => { 
    // simulate pizza making time (3seconds)
    setTimeout(() => {
      const success = Math.random() > 0.2; // 80% chance of success

      if (success) {
        resolve('Pizza is ready!'); // promise fulfilled
      } else {
        reject('Sorry, we ran out of ingredients.'); // promise rejected
      }
    }, 3000);
  });
}

// using the Promise with async/await
orderPizza()
  .then(result => console.log(result)) // runs when pizza is ready
  .catch(error => console.error(error)); // runs if there was an error
console.log('Doing other things while waiting for pizza...'); // runs immediately

// output:
// Doing other things while waiting for pizza...
// [3 second pause]
// Pizza is ready!  OR  Sorry, we ran out of ingredients.


// Three states of a Promise:

// 1. PENDING: initial state, neither fulfilled nor rejected
const promise = orderPizza(); // Status: Pending

// 2. FULFILLED: promise completed successfully
promise.then(pizza => {
  console.log(pizza); // Status: Fulfilled
})

// 3. REJECTED: promise failed
promise.catch(error => {
  console.error(error); // Status: Rejected
})


// The Old way (Promises with .then() and .catch())

function step1() {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Step 1 complete');
      resolve('Result of Step 1');
    }, 1000);
  });
}

function step2(previousResult) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Step 2 complete');
      resolve('Result of Step 2 based on ' + previousResult);
    }, 1000);
  });
}

function step3(previousResult) {
  return new Promise(resolve => {
    setTimeout(() => {
      console.log('Step 3 complete');
      resolve('Result of Step 3 based on ' + previousResult);
    }, 1000);
  })
}

// Using .then() chains (the old way)

step1()
  .then(result1 => step2(result1))
  .then(result2 => step3(result2))
  .then(result3 => {
    console.log('All steps complete:', result3);
  })
  .catch(error => {
    console.error('Error occurred:', error);
  });

// output (over 3 seconds):
// step 1 complete
// step 2 complete
// step 3 complete
// final: result from step 1 + result from step 2 + result from step 3

// the problem With .then() chaining is that it can get messy and hard to read with many steps
// especially when error handling is involved

// this gets messy fast ("callback hell"):
step1()
  .then(result1 => {
    return step2(result1)
      .then(result2 => {
        return step3(result2)
          .then(result3 => {
            return step4(result3)
              .then(result4 => {
                // this is hard to read!
                console.log(result4);
              });
          });
      });
  });


// the new way (using async/await)
// much cleaner and easier to read
// it looks like normal synchronous code but it is still asynchronous under the hood

// mark function as async
async function doAllSteps() {
  try {
    const result1 = await step1(); // wait for step 1 to complete
    const result2 = await step2(result1); // wait for step 2 to complete
    const result3 = await step3(result2); // wait for step 3 to complete

    console.log('All steps complete:', result3);
  } catch (error) {
    console.error('Error occurred:', error);
  }
}

doAllSteps();

// RULE 1: Use 'async' keyword before function definition to mark it as asynchronous

// regular function 
function regularFunction() {
  return 'hello';
}

// async function
async function asyncFunction() {
  return 'hello';
}

// what's the difference?
console.log(regularFunction()); // 'hello'
console.log(asyncFunction()); // Promise {'hello'}

// async functions ALWAYS return a promise

// RULE 2: Use 'await' only inside async functions to wait for a Promise to resolve

// wrong and will cause error
function wrongUsage() {
  //await orderPizza(); // SyntaxError: await is only valid in async functions
}

// right must be inside async function
async function correctUsage() {
  await orderPizza(); // works fine
}

// RULE 3: await pauses execution of the async function until the Promise resolves

async function fetchData() {
  console.log('Fetching data...');
  const data = await getDataFromServer(); // pauses here until data is returned
  console.log('Data received:', data); // runs after data is available

  console.log('done');
}

function getDataFromServer() {
  return new Promise((resolve) => { 
    setTimeout(() => resolve('Server Data'), 3000);
  })
}

example();

// output:
// Fetching data...
// [3 second pause]
// Data received: Server Data
// done


//  Task: Write a function that simulates fetching user data from a server.

// Create a promise that stimulates network delay of 2 seconds

function fetchUserData(userId) {
  return new Promise((resolve, reject) => {
    setTimeout (() => {
      if (userId > 0) {
        resolve ({ id: userId, name: 'John Doe'})
      } else {
        reject ('Invalid user ID');
      }
    }, 2000);
  })
}

async function getUser() {
  try {
    console.log('Fetching user data...');
    const user = await fetchUserData(1); // valid user ID
    console.log('User data received:', user);
  } catch (error) {
    console.error('Error fetching user data:', error);
  }
}

getUser();

// Modify this to fetch TWO users in sequence // Then modify it to fetch TWO users in parallel (hint: Promise.all)

async function getTwoUsersSequentially() {
  try {
    console.log('Fetching first user data...');
    const user1 = await fetchUserData(1); // valid user ID
    console.log('First user data received:', user1);

    console.log('Fetching second user data...');
    const user2 = await fetchUserData(2); // valid user ID
    console.log('Second user data received:', user2);
  } catch (error) {
    console.error('Error fetching user data:', error);
  }
}

getTwoUsersSequentially(); 

async function getTwoUsersInParallel() {
  try {
    console.log('Fetching both users data in parallel...');
    const [user1, user2] = await Promise.all([
      fetchUserData(1), // valid user ID
      fetchUserData(2)  // valid user ID
    ]);
    console.log('Both users data received:', user1, user2);
  } catch (error) {
    console.error('Error fetching user data:', error);
  }
}


