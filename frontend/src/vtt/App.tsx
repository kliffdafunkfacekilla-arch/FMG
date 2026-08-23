import React, { useState } from 'react';
import { MainMenu } from './screens/MainMenu';
import { CharacterCreator } from './screens/CharacterCreator';
import { NewGame } from './screens/NewGame';
import { PlayMode } from './screens/PlayMode';
import { SettingsMenu } from './screens/SettingsMenu';

export type ViewState = 'MAIN_MENU' | 'CHARACTER_CREATOR' | 'NEW_GAME' | 'PLAY_MODE' | 'SETTINGS';

export const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('MAIN_MENU');
  
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [activeWorldId, setActiveWorldId] = useState<string | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);

  const handleStartSession = (worldId: string, characterId: string, regionId: string) => {
    setActiveWorldId(worldId);
    setActiveCharacterId(characterId);
    setActiveRegionId(regionId);
    setView('PLAY_MODE');
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {view === 'MAIN_MENU' && (
        <MainMenu 
          onNewCharacter={() => setView('CHARACTER_CREATOR')} 
          onStartGame={() => setView('NEW_GAME')} 
          onSettings={() => setView('SETTINGS')}
        />
      )}
      
      {view === 'CHARACTER_CREATOR' && (
        <CharacterCreator 
          onBack={() => setView('MAIN_MENU')}
          onComplete={() => setView('MAIN_MENU')}
        />
      )}

      {view === 'NEW_GAME' && (
        <NewGame
          onBack={() => setView('MAIN_MENU')}
          onStart={handleStartSession}
        />
      )}

      {view === 'SETTINGS' && (
        <SettingsMenu
          onBack={() => setView('MAIN_MENU')}
        />
      )}
      
      {view === 'PLAY_MODE' && (
        <PlayMode 
            characterId={activeCharacterId} 
            worldId={activeWorldId} 
            regionId={activeRegionId}
            onBack={() => setView('MAIN_MENU')} 
        />
      )}
    </div>
  );
};
