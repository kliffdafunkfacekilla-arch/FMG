const fs = require('fs');
let code = fs.readFileSync('src/api/observerRouter.ts', 'utf8');

const injection = `
let autoplayTimer: any = null;
observerRouter.post("/autoplay", (req, res) => {
    const { enabled } = req.body;
    if (enabled && !autoplayTimer) {
        autoplayTimer = setInterval(async () => {
            if (!tickInProgress && !resetInProgress) {
                tickInProgress = true;
                try { await executeMasterTick(); } catch(e) { console.error("Autoplay tick err", e); }
                tickInProgress = false;
            }
        }, 1500);
    } else if (!enabled && autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
    }
    res.json({ autoplay: !!autoplayTimer });
});
observerRouter.get("/autoplay", (req, res) => {
    res.json({ autoplay: !!autoplayTimer });
});
`;

code = code.replace('const observerRouter = Router();', 'const observerRouter = Router();' + injection);
fs.writeFileSync('src/api/observerRouter.ts', code);
console.log("Added /autoplay to API");
