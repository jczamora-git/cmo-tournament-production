require('dotenv').config();
const http = require('http');

function makeRequest(path, token) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token !== undefined) {
      options.headers['Authorization'] = token;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', (err) => resolve({ status: 'error', data: err.message }));
    req.end();
  });
}

async function run() {
  console.log("Testing with missing token:");
  let res = await makeRequest('/api/sync/tournaments', undefined);
  console.log(`Status: ${res.status}, Data: ${res.data}`);

  console.log("\nTesting with wrong token format:");
  res = await makeRequest('/api/sync/tournaments', "wrong-format-token");
  console.log(`Status: ${res.status}, Data: ${res.data}`);

  console.log("\nTesting with wrong token (403):");
  res = await makeRequest('/api/sync/tournaments', "Bearer invalid-token");
  console.log(`Status: ${res.status}, Data: ${res.data}`);

  const validToken = "Bearer " + process.env.PRODUCTION_SYNC_TOKEN;
  console.log("\nTesting valid token /tournaments:");
  res = await makeRequest('/api/sync/tournaments', validToken);
  console.log(`Status: ${res.status}, Data: ${res.data}`);

  console.log("\nTesting mismatched context /tournament-modes?tournament_id=1&tournament_mode_id=999:");
  res = await makeRequest('/api/sync/tournament-modes?tournament_id=1&tournament_mode_id=999', validToken);
  console.log(`Status: ${res.status}, Data: ${res.data}`);
}

setTimeout(run, 2000); // give server time to start
