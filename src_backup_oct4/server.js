"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const worldInitializer_1 = require("./engine/worldInitializer");
const fractalGenerator_1 = require("./engine/fractalGenerator");
const streamingRouter_1 = require("./api/streamingRouter");
const climateEngine_1 = require("./engine/climateEngine");
const ecologyEngine_1 = require("./engine/ecologyEngine");
const economicEngine_1 = require("./engine/economicEngine");
const factionEngine_1 = require("./engine/factionEngine");
const cosmicEngine_1 = require("./engine/cosmicEngine");
const gameRouter_1 = __importDefault(require("./api/gameRouter"));
const characterRouter_1 = __importDefault(require("./api/characterRouter"));
const dmRouter_1 = __importDefault(require("./api/dmRouter"));
const observerRouter_1 = __importDefault(require("./api/observerRouter"));
const regionRouter_1 = __importDefault(require("./api/regionRouter"));
const tellerRouter_1 = __importDefault(require("./api/tellerRouter"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
app.use('/api/game', gameRouter_1.default);
app.use('/api/character', characterRouter_1.default);
app.use('/api/dm', dmRouter_1.default);
app.use('/api/observer', observerRouter_1.default);
app.use('/api/region', regionRouter_1.default);
app.use('/teller', tellerRouter_1.default);
// 1. Initialize World Seed API
app.post('/api/world/initialize', async (req, res) => {
    try {
        const { seed, resolution, axialTilt, daysPerYear } = req.body;
        await (0, worldInitializer_1.initializeWorldMesh)({ seed, resolution: resolution || 200, axialTilt: axialTilt || 23.5, daysPerYear: daysPerYear || 365 });
        res.status(201).json({ status: 'success', message: `World seed '${seed}' initialized successfully.` });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
// 2. Generate Regional Sub-Grid Cells API
app.post('/api/world/generate-subgrid', async (req, res) => {
    try {
        const { seed, globalCellId } = req.body;
        await (0, fractalGenerator_1.generateSubGridCells)({ seed, globalCellId });
        res.status(200).json({ status: 'success', message: `Sub-grid cells generated for global cell ${globalCellId}.` });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
// 3. Unified Master Simulation Tick API
app.post('/api/world/tick', async (req, res) => {
    try {
        const { seed, ticksToAdvance } = req.body;
        const climateResult = await (0, climateEngine_1.advancePlanetaryTick)({ seed, ticksToAdvance: ticksToAdvance || 1 });
        await (0, ecologyEngine_1.updateLocalEcologicalCycles)(seed);
        await (0, economicEngine_1.executeCivilizationEconomicTick)(seed);
        await (0, factionEngine_1.executeFactionAndDiplomacyTick)(seed);
        await (0, cosmicEngine_1.executeCosmicShadowWarTick)(seed);
        res.status(200).json({
            status: 'success',
            message: 'Master simulation tick executed across all layers.',
            climate: climateResult
        });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
// 4. Stream Player LOD Window API
app.get('/api/world/stream', async (req, res) => {
    try {
        const { seed, globalId, regX, regY, tick } = req.query;
        const streamData = await (0, streamingRouter_1.streamPlayerLODWindow)({
            seed: seed,
            globalId: parseInt(globalId) || 0,
            regionalX: parseInt(regX) || 50,
            regionalY: parseInt(regY) || 50,
            currentTick: parseInt(tick) || 0
        });
        res.status(200).json(streamData);
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Simulation Engine Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map