import React, { useState, useEffect } from 'react';
import { BattleMap } from '../components/BattleMap';
import { StoryDirectorChat } from '../components/StoryDirectorChat';
import { CharacterPanel } from '../components/CharacterPanel';

interface PlayModeProps {
  characterId: string | null;
  worldId: string | null;
  regionId: string | null;
  onBack: () => void;
}

export const PlayMode: React.FC<PlayModeProps> = ({ characterId, worldId, regionId, onBack }) => {
  const [character, setCharacter] = useState<any>(null);

  useEffect(() => {
    if (characterId) {
      // In a real app, you'd fetch the specific character by ID, but since we list them all:
      fetch('http://localhost:8000/api/brutal/characters')
        .then(res => res.json())
        .then(data => {
            const char = data.find((c: any) => c.id === characterId);
            if (char) setCharacter(char);
        })
        .catch(err => console.error(err));
    }
  }, [characterId]);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      
      {/* Left Side: High LOD Battle Map */}
      <div style={{ flex: 2, borderRight: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
        <BattleMap />
        <button 
          onClick={onBack}
          style={{ position: 'absolute', top: 15, right: 15, background: 'rgba(0,0,0,0.8)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', zIndex: 10 }}>
          Exit Game
        </button>
      </div>

      {/* Middle: AI DM Chat */}
      <div style={{ flex: 1.5, borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
        <StoryDirectorChat characterId={characterId} worldId={worldId} regionId={regionId} />
      </div>

      {/* Right: Character Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CharacterPanel character={character} />
      </div>

    </div>
  );
};
