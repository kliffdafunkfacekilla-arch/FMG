import React, { useState } from 'react';

interface CharacterCreatorProps {
  sessionId: string;
  onCharacterCreated: (characterId: string) => void;
  title: string;
}

export function CharacterCreator({ sessionId, onCharacterCreated, title }: CharacterCreatorProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Attuned');
  const [creatureType, setCreatureType] = useState('Mammal');

  const [attributes, setAttributes] = useState({
    might: 10, endurance: 10, finesse: 10, reflex: 10,
    vitality: 10, fortitude: 10, knowledge: 10, logic: 10,
    awareness: 10, intuition: 10, charm: 10, willpower: 10
  });

  const handleUpdate = (attr: keyof typeof attributes, val: number) => {
    setAttributes(prev => ({ ...prev, [attr]: val }));
  };

  const handleComplete = async () => {
    if (!name) return alert("Enter a name");
    
    try {
      const res = await fetch('/api/character/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, name, type, creature_type: creatureType, attributes
        })
      });
      const data = await res.json();
      if (data.success) {
        onCharacterCreated(data.characterId.toString());
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert("Failed to create character: " + e.message);
    }
  };

  return (
    <div style={{ padding: '2rem', background: '#0a0a0a', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: '#111', padding: '2rem', borderRadius: '6px', border: '1px solid #333' }}>
        <h2 style={{ color: '#ffb703', marginTop: 0 }}>{title}</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <input type="text" placeholder="Character Name" value={name} onChange={e => setName(e.target.value)} style={{ padding: '0.75rem', background: '#222', border: '1px solid #444', color: '#fff' }} />
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <select value={type} onChange={e => setType(e.target.value)} style={{ flex: 1, padding: '0.75rem', background: '#222', border: '1px solid #444', color: '#fff' }}>
              <option value="Attuned">Attuned (Magic/Focus)</option>
              <option value="Null">Null (Science/Stamina)</option>
            </select>
            
            <select value={creatureType} onChange={e => setCreatureType(e.target.value)} style={{ flex: 1, padding: '0.75rem', background: '#222', border: '1px solid #444', color: '#fff' }}>
              <option value="Mammal">Mammal</option>
              <option value="Avian">Avian</option>
              <option value="Reptile">Reptile</option>
            </select>
          </div>
        </div>

        <h3 style={{ color: '#aaa', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>The 12 Constants</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          {Object.entries(attributes).map(([attr, val]) => (
            <div key={attr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', padding: '0.5rem 1rem', borderRadius: '4px' }}>
              <span style={{ textTransform: 'capitalize' }}>{attr}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => handleUpdate(attr as keyof typeof attributes, Math.max(1, val - 1))} style={{ background: '#333', color: '#fff', border: 'none', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>-</button>
                <span style={{ width: '20px', textAlign: 'center' }}>{val}</span>
                <button onClick={() => handleUpdate(attr as keyof typeof attributes, Math.min(20, val + 1))} style={{ background: '#333', color: '#fff', border: 'none', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>+</button>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleComplete} style={{ width: '100%', padding: '1rem', background: '#d90429', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold' }}>
          FINALIZE CHARACTER
        </button>
      </div>
    </div>
  );
}
