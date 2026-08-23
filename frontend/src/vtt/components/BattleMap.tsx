import React, { useRef, useEffect } from 'react';

export const BattleMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        renderMap();
      }
    };

    const renderMap = () => {
      ctx.fillStyle = '#08080a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      
      const gridSize = 50;
      const cols = Math.ceil(canvas.width / gridSize);
      const rows = Math.ceil(canvas.height / gridSize);

      for (let i = 0; i < cols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, canvas.height);
        ctx.stroke();
      }

      for (let j = 0; j < rows; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * gridSize);
        ctx.lineTo(canvas.width, j * gridSize);
        ctx.stroke();
      }

      const centerX = Math.floor(cols / 2) * gridSize + gridSize / 2;
      const centerY = Math.floor(rows / 2) * gridSize + gridSize / 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX + gridSize * 2, centerY - gridSize, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#f87171';
      ctx.stroke();
    };

    window.addEventListener('resize', resize);
    resize();

    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#000', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <div style={{
        position: 'absolute', top: 15, left: 15, background: 'rgba(0,0,0,0.6)',
        padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(4px)', color: 'white'
      }}>
        <h2 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', color: '#60a5fa' }}>High-LOD Battle Map</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>Generating local zone data...</p>
      </div>
    </div>
  );
};
