const fs = require('fs');
let code = fs.readFileSync('src/observer/Dashboard.tsx', 'utf8');

// Replace tickLoop with a state polling loop
const newEffect = `
  // Polling loop for state
  useEffect(() => {
    let active = true;
    let timerId: any = null;

    async function poll() {
      if (!active) return;
      await fetchState();
      if (active) timerId = setTimeout(poll, 1500);
    }
    
    poll();

    // Also fetch initial autoplay state
    fetch("/api/observer/autoplay").then(r => r.json()).then(d => {
        if (active) setIsPlaying(d.autoplay);
    }).catch(()=>{});

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [fetchState]);

  const togglePlay = async () => {
      const nextState = !isPlaying;
      setIsPlaying(nextState);
      await fetch("/api/observer/autoplay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: nextState })
      });
  };
`;

code = code.replace(/useEffect\(\(\) => \{\s*let active = true;\s*let timerId: any = null;\s*async function tickLoop\(\) \{[\s\S]*?\}, \[isPlaying, fetchState\]\);/, newEffect);

code = code.replace(/onClick=\{.*?setIsPlaying\(\!isPlaying\).*?\}/, 'onClick={togglePlay}');

fs.writeFileSync('src/observer/Dashboard.tsx', code);
console.log("Dashboard background sync added");
