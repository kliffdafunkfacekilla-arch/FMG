const http = require('http');

async function runYear() {
    console.log("Starting 1-year simulation (52 ticks)...");
    const start = Date.now();
    
    for (let i = 1; i <= 52; i++) {
        await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: 3000,
                path: '/api/observer/tick',
                method: 'POST'
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        console.error(`Tick ${i} failed with status ${res.statusCode}: ${data}`);
                        reject(new Error("Tick failed"));
                    } else {
                        console.log(`Tick ${i}/52 complete.`);
                        resolve();
                    }
                });
            });
            req.on('error', reject);
            req.end();
        });
    }
    
    const end = Date.now();
    console.log(`\nSimulation complete! 1 Year (52 Ticks) processed in ${((end - start) / 1000).toFixed(2)} seconds.`);
}

runYear().catch(console.error);
