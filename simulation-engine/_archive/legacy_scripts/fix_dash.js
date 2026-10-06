const fs = require('fs');
let file = fs.readFileSync('src/observer/Dashboard.tsx', 'utf8');
file = file.replace('bounds.current.baseOffX = pad - minX * baseScale;', 'bounds.current.baseOffX = (canvas.width - (maxX - minX) * baseScale) / 2 - minX * baseScale;');
file = file.replace('bounds.current.baseOffY = pad - minY * baseScale;', 'bounds.current.baseOffY = (canvas.height - (maxY - minY) * baseScale) / 2 - minY * baseScale;');
fs.writeFileSync('src/observer/Dashboard.tsx', file);
