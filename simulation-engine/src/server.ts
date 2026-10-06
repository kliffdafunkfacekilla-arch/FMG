import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import pool from './db/pool';
import { initializeWorldMesh } from './engine/worldInitializer';
import { generateSubGridCells } from './engine/fractalGenerator';
import { streamPlayerLODWindow } from './api/streamingRouter';
import { advancePlanetaryTick } from './engine/climateEngine';
import { updateLocalEcologicalCycles } from './engine/ecologyEngine';
import { executeCivilizationEconomicTick } from './engine/economicEngine';
import { executeFactionAndDiplomacyTick } from './engine/factionEngine';
import { executeCosmicShadowWarTick } from './engine/cosmicEngine';

import gameRouter from './api/gameRouter';
import characterRouter from './api/characterRouter';
import dmRouter from './api/dmRouter';
import observerRouter from './api/observerRouter';
import { regionalRouter } from './api/regionalRouter';
import tellerRouter from './api/tellerRouter';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/game', gameRouter);
app.use('/api/character', characterRouter);
app.use('/api/dm', dmRouter);
app.use('/api/observer', observerRouter);
app.use('/api/regional', regionalRouter);
app.use('/teller', tellerRouter);

// 1. Initialize World Seed API
app.post('/api/world/initialize', async (req, res) => {
  try {
    const { seed, resolution, axialTilt, daysPerYear } = req.body;
    await initializeWorldMesh({ seed, resolution: resolution || 200, axialTilt: axialTilt || 23.5, daysPerYear: daysPerYear || 365 });
    res.status(201).json({ status: 'success', message: `World seed '${seed}' initialized successfully.` });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 2. Generate Regional Sub-Grid Cells API
app.post('/api/world/generate-subgrid', async (req, res) => {
  try {
    const { seed, globalCellId } = req.body;
    await generateSubGridCells({ seed, globalCellId });
    res.status(200).json({ status: 'success', message: `Sub-grid cells generated for global cell ${globalCellId}.` });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 3. Unified Master Simulation Tick API
app.post('/api/world/tick', async (req, res) => {
  try {
    const { seed, ticksToAdvance } = req.body;
    const climateResult = await advancePlanetaryTick({ seed, ticksToAdvance: ticksToAdvance || 1 });
    await updateLocalEcologicalCycles(seed);
    await executeCivilizationEconomicTick(seed);
    await executeFactionAndDiplomacyTick(seed);
    await executeCosmicShadowWarTick(seed);

    res.status(200).json({ 
      status: 'success', 
      message: 'Master simulation tick executed across all layers.',
      climate: climateResult
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 4. Stream Player LOD Window API
app.get('/api/world/stream', async (req, res) => {
  try {
    const { seed, globalId, regX, regY, tick } = req.query;
    const streamData = await streamPlayerLODWindow({
      seed: seed as string,
      globalId: parseInt(globalId as string) || 0,
      regionalX: parseInt(regX as string) || 50,
      regionalY: parseInt(regY as string) || 50,
      currentTick: parseInt(tick as string) || 0
    });
    res.status(200).json(streamData);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Simulation Engine Server running on http://localhost:${PORT}`);
});

