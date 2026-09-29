import React, { useState } from 'react';
import { MainMenu } from './MainMenu';
import { CharacterCreator } from './CharacterCreator';
import { GameSessionHUD } from './GameSessionHUD';
import { WorldObserver } from './WorldObserver';

export function App() {
  const [appState, setAppState] = useState<'MENU' | 'CREATE_P1' | 'CREATE_P2' | 'PLAY'>('MENU');
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [p1Id, setP1Id] = useState<string | null>(null);
  const [p2Id, setP2Id] = useState<string | null>(null);

  const startNewGame = async () => {
    try {
      const res = await fetch('/api/game/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Session - ${new Date().toLocaleTimeString()}` })
      });
      const data = await res.json();
      if (data.success) {
        setSessionId(data.sessionId.toString());
        setAppState('CREATE_P1');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadGame = async (sid: string) => {
    setSessionId(sid);
    // On a real load, we'd fetch characters associated with session and set them.
    // For this prototype, we'll assume characters are fetched inside GameSessionHUD.
    setAppState('PLAY');
  };

  if (window.location.pathname === '/observer') {
    return <WorldObserver />;
  }

  if (appState === 'MENU') {
    return <MainMenu onStartNewGame={startNewGame} onLoadGame={loadGame} />;
  }

  if (appState === 'CREATE_P1' && sessionId) {
    return <CharacterCreator 
      title="Create Player 1" 
      sessionId={sessionId} 
      onCharacterCreated={(cid) => { setP1Id(cid); setAppState('CREATE_P2'); }} 
    />;
  }

  if (appState === 'CREATE_P2' && sessionId) {
    return <CharacterCreator 
      title="Create Player 2" 
      sessionId={sessionId} 
      onCharacterCreated={(cid) => { setP2Id(cid); setAppState('PLAY'); }} 
    />;
  }

  if (appState === 'PLAY' && sessionId) {
    return <GameSessionHUD sessionId={sessionId} />;
  }

  return <div>Invalid State</div>;
}
