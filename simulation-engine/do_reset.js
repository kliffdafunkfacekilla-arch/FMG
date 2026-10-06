const { resetWorld } = require('./dist/engine/resetWorld.js');
resetWorld().then(res => { console.log(res); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
