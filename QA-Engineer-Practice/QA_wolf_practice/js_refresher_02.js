import fetch from 'node-fetch';
import fs from 'fs';

// --- call backs ---

// -- setTimeout example
// setTimeout(() => {
//   console.log('This runs after 2 seconds');
// }, 2000)

// -- nested setTimeout - CALLBACK HELL example
// setTimeout(() => {
//   console.log('3');
//   setTimeout(() => {
//     console.log('2');
//     setTimeout(() => {
//       console.log('1');
//     }, 1000);
//   }, 1000);
// }, 1000);

// -- button event listener handler in browser example
// const btn;
// btn.addEventListener('click', () => { 

// });

// --- promises ---

// error first callback style

// fs.readFile('test.txt', 'utf8', (err, data) => {
//   if (err) {
//     console.error('Error reading file:');
//     console.error(err);
//   } else {
//     console.log('Got data from file:');
//     console.log(data);
//   }
// })

// --create a promise 
// const myPromise = new Promise ((resolve, reject) => {
//   const rand = Math.floor(Math.random() * 2);// random number that is either a 0 or 1
//   if (rand === 0) {
//     resolve('Promise resolved successfully!');
//   } else {
//     reject ('Promise rejected with an error.');
//   }
// });

// myPromise
//   .then(() => console.log('Success!'))
//   .catch(() => console.error('Failure!'));

// -- fs readFile with promise example
// fs.promises.readFile('test.txt', 'utf8')
//   .then((data) => {
//     console.log('Got data from file:');
//     console.log(data);
//   })
//   .catch((err) => {
//     console.error('Error reading file:');
//     console.error(err);
//   });

// -- fetch with promises example
// fetch('https://pokeapi.co/api/v2/pokemon/pikachu')
//   .then((res) => res.json()) 
//   .then((data) => console.log(data))
//   .catch((err) => console.error('Error fetching data:', err));