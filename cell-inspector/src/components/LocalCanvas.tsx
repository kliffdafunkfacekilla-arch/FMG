import React, { useEffect, useRef, useState } from 'react';
import { BIOME_MAPPING } from '../utils/biomeMapping';

interface LocalCanvasProps {
  terrain: any;
  burg: any;
}

const LocalCanvas: React.FC<LocalCanvasProps> = ({ terrain, burg }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generating, setGenerating] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!terrain) return;

    setGenerating(true);

    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/mapWorker.ts', import.meta.url), { type: 'module' });
    }

    workerRef.current.onmessage = (e) => {
      if (e.data.type === "MAP_READY") {
        const { mapData, gridWidth, gridHeight } = e.data;
        drawMapBackground(mapData, gridWidth, gridHeight);
        setGenerating(false);
      } else if (e.data.type === "AGENTS_UPDATE") {
        drawAgents(e.data.agents, 225, 225);
      } else if (e.data.mapData) { // Fallback for old code
        drawMapBackground(e.data.mapData, e.data.gridWidth, e.data.gridHeight);
        setGenerating(false);
      }
    };

    workerRef.current.postMessage({
      cellId: terrain.id,
      biomeId: terrain.biome,
      neighborBiomes: terrain.neighbor_biomes,
      features: terrain.cell_features,
      burg: burg,
      gridWidth: 225,
      gridHeight: 225
    });

    return () => {
       // Optional: could stop worker on unmount if needed
    };
  }, [terrain, burg]);

  const drawMapBackground = (mapData: Uint8Array, width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create an offscreen canvas to cache the map
    if (!mapCanvasRef.current) {
      mapCanvasRef.current = document.createElement('canvas');
      mapCanvasRef.current.width = canvas.width;
      mapCanvasRef.current.height = canvas.height;
    }
    const offCtx = mapCanvasRef.current.getContext('2d');
    if (!offCtx) return;

    const biomeDef = BIOME_MAPPING[terrain.biome] || BIOME_MAPPING["4"]; 
    const colors = biomeDef.colors;
    const pixelSize = canvas.width / width; 
    
    offCtx.fillStyle = '#000';
    offCtx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = mapData[y * width + x];
        let fill = colors.base;

        if (val === 1) fill = colors.feature;
        else if (val === 2) fill = colors.accent;
        else if (val === 3) fill = '#3b82f6'; 
        else if (val === 4) fill = '#52525b'; 
        else if (val === 5) fill = '#a1a1aa'; 
        else if (val === 6) fill = '#78350f'; 
        else if (val === 7) fill = '#f59e0b'; 

        offCtx.fillStyle = fill;
        offCtx.fillRect(Math.floor(x * pixelSize), Math.floor(y * pixelSize), Math.ceil(pixelSize), Math.ceil(pixelSize));
      }
    }
    
    // Draw initial background
    ctx.drawImage(mapCanvasRef.current, 0, 0);
  };

  const drawAgents = (agents: any[], width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !mapCanvasRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelSize = canvas.width / width;

    // Restore background
    ctx.drawImage(mapCanvasRef.current, 0, 0);

    // Draw agents
    for (const a of agents) {
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(a.x * pixelSize, a.y * pixelSize, pixelSize * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
      <h2 className="text-xl font-bold text-green-400 border-b border-gray-700 pb-2 mb-4 flex justify-between">
        <span>Fractal Local Map (50k Cells)</span>
        {generating && <span className="text-sm text-yellow-400 animate-pulse">Generating noise...</span>}
      </h2>
      <div className="flex justify-center">
        <canvas 
          ref={canvasRef} 
          width={600} 
          height={600} 
          className="border border-gray-900 shadow-lg rounded"
          style={{ imageRendering: 'pixelated', maxWidth: '100%', height: 'auto' }}
        />
      </div>
      <div className="mt-4 text-xs text-gray-400 text-center">
        1 pixel = 1 Local Hex. 225x225 grid.
      </div>
    </div>
  );
};

export default LocalCanvas;
