const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large JSON payloads for map data

const DB_FILE = path.join(__dirname, 'database.json');

// Initialize database file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
	const initData = {
		events: [],
		storyHooks: [],
		paragons: []
	};
	fs.writeFileSync(DB_FILE, JSON.stringify(initData, null, 2));
}

// Helper to read DB
const readDB = () => {
	const data = fs.readFileSync(DB_FILE, 'utf-8');
	return JSON.parse(data);
};

// Helper to write DB
const writeDB = (data) => {
	fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// =======================
// ROUTES
// =======================

// 1. Ingest Memory Nodes (Events, Actors, Locations)
app.post('/api/memory/nodes', (req, res) => {
	const newNodes = req.body.nodes || [];
	if (!Array.isArray(newNodes) || newNodes.length === 0) {
		return res.status(400).json({ error: "Missing 'nodes' array." });
	}

	const db = readDB();
	
	newNodes.forEach(node => {
		// Only push if it doesn't exist
		if (!db.events.find(e => e.id === node.id)) {
			db.events.push(node);
		}
	});

	writeDB(db);
	res.status(200).json({ success: true, ingested: newNodes.length });
});

// 2. Ingest Paragons
app.post('/api/paragons', (req, res) => {
	const newParagons = req.body.paragons || [];
	if (!Array.isArray(newParagons)) {
		return res.status(400).json({ error: "Missing 'paragons' array." });
	}

	const db = readDB();
	
	newParagons.forEach(p => {
		const existingIndex = db.paragons.findIndex(ep => ep.id === p.id);
		if (existingIndex >= 0) {
			// Update
			db.paragons[existingIndex] = p;
		} else {
			// Insert
			db.paragons.push(p);
		}
	});

	writeDB(db);
	res.status(200).json({ success: true, ingested: newParagons.length });
});

// 3. Ingest Story Hooks
app.post('/api/story-hooks', (req, res) => {
	const hooks = req.body.hooks || [];
	if (!Array.isArray(hooks)) {
		return res.status(400).json({ error: "Missing 'hooks' array." });
	}

	const db = readDB();
	
	hooks.forEach(h => {
		const existingIndex = db.storyHooks.findIndex(eh => eh.id === h.id);
		if (existingIndex >= 0) {
			db.storyHooks[existingIndex] = h;
		} else {
			db.storyHooks.push(h);
		}
	});

	writeDB(db);
	res.status(200).json({ success: true, ingested: hooks.length });
});

// 4. Get all data (for AI Director to read)
app.get('/api/dump', (req, res) => {
	const db = readDB();
	res.status(200).json(db);
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
	console.log(`SAGA Backend Engine running on http://localhost:${PORT}`);
	console.log(`JSON Database stored at: ${DB_FILE}`);
});
