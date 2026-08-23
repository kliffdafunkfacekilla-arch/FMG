import React from 'react';
import { Play, UserPlus, Settings } from 'lucide-react';

interface MainMenuProps {
  onNewCharacter: () => void;
  onStartGame: () => void;
  onSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onNewCharacter, onStartGame, onSettings }) => {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, #0f0f12 0%, #1a1a24 100%)',
      color: '#e2e8f0'
    }}>
      
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ 
          fontSize: '4rem', margin: 0, color: '#fbbf24', 
          textTransform: 'uppercase', letterSpacing: '8px',
          textShadow: '0 0 20px rgba(251, 191, 36, 0.3)'
        }}>SAGA</h1>
        <p style={{ fontSize: '1.2rem', color: '#94a3b8', letterSpacing: '2px', marginTop: '0.5rem' }}>
          VIRTUAL TABLETOP
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
        <button 
          onClick={onStartGame}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem',
            padding: '1rem', background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid #3b82f6', borderRadius: '8px', color: '#60a5fa',
            fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
        >
          <Play size={20} /> Continue / Quick Start
        </button>

        <button 
          onClick={onNewCharacter}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem',
            padding: '1rem', background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10b981', borderRadius: '8px', color: '#34d399',
            fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
        >
          <UserPlus size={20} /> Create Character
        </button>

        <button 
          onClick={onSettings}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem',
            padding: '1rem', background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#94a3b8',
            fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        >
          <Settings size={20} /> Options
        </button>
      </div>

    </div>
  );
};
