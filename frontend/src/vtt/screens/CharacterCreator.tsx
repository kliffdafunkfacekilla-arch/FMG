import React, { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';

interface CharacterCreatorProps {
  onBack: () => void;
  onComplete: (character: any) => void;
}

const ATTRIBUTES = [
  "might", "endurance", "finesse", "reflex", "vitality", "fortitude",
  "knowledge", "logic", "awareness", "intuition", "charm", "willpower"
];

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onBack, onComplete }) => {
  const [name, setName] = useState('Subject 000');
  const [origin, setOrigin] = useState('Scavenger');
  const [stats, setStats] = useState<Record<string, number>>(
    ATTRIBUTES.reduce((acc, attr) => ({ ...acc, [attr]: 2 }), {})
  );
  
  const [error, setError] = useState<string | null>(null);

  const totalPoints = Object.values(stats).reduce((a, b) => a + b, 0);

  const handleStatChange = (stat: string, delta: number) => {
    setStats(prev => {
      const newVal = prev[stat] + delta;
      if (newVal < 1 || newVal > 8) return prev; // Rules limits
      return { ...prev, [stat]: newVal };
    });
  };

  const handleSubmit = async () => {
    setError(null);
    if (totalPoints !== 26) {
      setError(`Total attribute points must equal 26. Currently: ${totalPoints}`);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/brutal/create_character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, origin, 
          stats: {
            might: stats.might,
            end: stats.endurance,
            fin: stats.finesse,
            ref: stats.reflex,
            vit: stats.vitality,
            "for": stats.fortitude,
            know: stats.knowledge,
            log: stats.logic,
            awa: stats.awareness,
            int: stats.intuition,
            cha: stats.charm,
            wil: stats.willpower
          }
        })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.detail || 'Validation failed');
        return;
      }

      const pools = await response.json();
      
      onComplete(pools);
      
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
  };

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: '#121216', color: '#e2e8f0', padding: '2rem'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
            padding: '0.5rem', borderRadius: '50%', cursor: 'pointer'
          }}>
            <ArrowLeft size={20} />
          </button>
          <h2 style={{ margin: 0, color: '#fbbf24', fontSize: '2rem' }}>Character Creation</h2>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem' }}>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '0.8rem', background: '#000', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '6px' }} />
          </div>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem' }}>Origin</label>
            <input type="text" value={origin} onChange={e => setOrigin(e.target.value)}
              style={{ width: '100%', padding: '0.8rem', background: '#000', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '6px' }} />
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#60a5fa' }}>Attributes</h3>
            <span style={{ color: totalPoints === 26 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
              Points Spent: {totalPoints} / 26
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {ATTRIBUTES.map(attr => (
              <div key={attr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{attr}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button onClick={() => handleStatChange(attr, -1)} style={{ background: '#ef4444', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer' }}>-</button>
                  <span style={{ width: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>{stats[attr]}</span>
                  <button onClick={() => handleStatChange(attr, 1)} style={{ background: '#10b981', border: 'none', color: 'white', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          style={{ width: '100%', padding: '1.2rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
          <Save size={24} /> Finalize Source Code
        </button>

      </div>
    </div>
  );
};
