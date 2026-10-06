const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/observer/Dashboard.tsx');
let content = fs.readFileSync(file, 'utf8');

const oldCode = `  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPlaying) return;
    intervalRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/observer/tick", { method: "POST" });
        if (r.status === 429) return; 
        await fetchState();
      } catch (e) {
        console.error("Tick error:", e);
      }
    }, 1500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, fetchState]);`;

const newCode = `  useEffect(() => {
    let active = true;
    let timerId = null;

    async function tickLoop() {
      if (!active || !isPlaying) return;
      try {
        const r = await fetch("/api/observer/tick", { method: "POST" });
        if (r.status !== 429) {
          await fetchState();
        }
      } catch (e) {
        console.error("Tick error:", e);
      }
      
      if (active && isPlaying) {
        // Schedule the next tick slightly after this one finishes
        timerId = setTimeout(tickLoop, 500);
      }
    }

    if (isPlaying) {
      tickLoop();
    }

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [isPlaying, fetchState]);`;

content = content.replace(oldCode, newCode);
fs.writeFileSync(file, content);
console.log("Updated Dashboard.tsx!");
