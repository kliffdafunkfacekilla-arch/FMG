const http = require('http');

function tick() {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/observer/tick',
            method: 'POST'
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    console.log("Fast-forwarding 15 ticks...");
    for (let i = 0; i < 15; i++) {
        await tick();
        process.stdout.write('.');
    }
    console.log("\nDone.");
}
run();
