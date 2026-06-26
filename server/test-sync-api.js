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
  const validToken = "Bearer " + process.env.PRODUCTION_SYNC_TOKEN;
  
  const routes = [
    '/api/sync/tournaments',
    '/api/sync/tournaments?tournament_id=12',
    '/api/sync/tournament-modes?tournament_id=12',
    '/api/sync/teams?tournament_id=12&tournament_mode_id=9',
    '/api/sync/teams?tournament_id=12&tournament_mode_id=10',
    '/api/sync/players?tournament_id=12&tournament_mode_id=9',
    '/api/sync/players?tournament_id=12&tournament_mode_id=10'
  ];

  console.log("=== GET Route Tests ===");
  for (const route of routes) {
    const res = await makeRequest(route, validToken);
    let rows = "error parsing json";
    try {
      const parsed = JSON.parse(res.data);
      rows = parsed.success && Array.isArray(parsed.data) ? parsed.data.length : res.data;
    } catch(e) {}
    console.log(`[${res.status}] ${route} -> rows: ${rows}`);
  }

  console.log("\n=== Mismatch Tests ===");
  const mismatches = [
    '/api/sync/teams?tournament_id=11&tournament_mode_id=9',
    '/api/sync/players?tournament_id=11&tournament_mode_id=9'
  ];
  for (const route of mismatches) {
    const res = await makeRequest(route, validToken);
    console.log(`[${res.status}] (Expected 400 or empty array based on logic) ${route}`);
  }
}

setTimeout(run, 2000);
