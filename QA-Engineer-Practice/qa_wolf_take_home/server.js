const express = require('express'); // import express framework to create a web server
const http = require('http'); // import http module to create a server that express can use
const socketIo = require('socket.io'); // import socket.io to enable real-time connection between server and browser
const fs = require('fs'); // import file system module to read and write files
const path = require('path'); // import path module to to handle file paths properly across operating systems
const app = express(); // initialize express app

// create an http server using the express app
// this is needed because socket.io works on a raw HTTP server
const server = http.createServer(app); 

// initialize socket.io to listen on the http server
// io wil handle all real-time communication with connected clients
const io = socketIo(server);

// set port number here all the server wil run
const PORT = process.env.PORT || 3000;

// --- serve static files
// serve all files in the 'public' folder at the root URL
// e.g., public/index.html will be served at http://localhost:3000/index.html
app.use(express.static('public'));

// serve files in the 'reports' folder at the '/reports' URL path
// e.g., reports/report1.html will be served at http://localhost:3000/reports/report1.html
app.use('/reports', express.static('reports'));

// serve files in the videos folder at the /videos URL path
app.user('/videos', express.static('videos'));

// --- API endpoint: /api/history ---
// this endpoint returns the last 10 test runs from test-history folder
app.get('/api/history', (req, res) => { 
  const historyDir = './test-history'; // directory where test history files are stored

  // if folder doesn't exist, return an empty array
  if (!fs.existsSync(historyDir)) {
    return res.json([]);
  }

  // read all files in the test-history directory
  const files = fs.readdirSync(historyDir)
    .filter(f => f.endsWith('.json')) // only keep .json files
    .map(f => JSON.parse(fs.readFileSync(path.join(historyDir, f), 'utf8'))) // read and parse each file
    .sort((a, b) => new Date(b.metadata.timestamp) - new Date(a.metadata.timestamp)) // sort by timestamp descending
    
  res.json(files.slice(0, 10)); // return the last 10 test runs
});


// --- socket.io connection handler ---
io.on('connection', (socket) => {
  console.group('Client connected to dashboard');
  
  //listen for client disconnecting
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    console.groupEnd();
  });
});

// make socket.io instance globally accessible
// this lets out test script (index.js) send events to the dashboard
global.dashboardIO = io;

// --- start the server ---
server.listen(PORT, () => {
  console.log(`Dashboard running at ${PORT}`);
});
