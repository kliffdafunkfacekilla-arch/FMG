import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Cpu } from 'lucide-react';

interface SettingsMenuProps {
  onBack: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ onBack }) => {
  const [provider, setProvider] = useState<'gemini' | 'ollama'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('http://localhost:8000/api/brutal/settings')
      .then(res => res.json())
      .then(data => {
        setProvider(data.llm_provider || 'gemini');
        setApiKey(data.gemini_api_key || '');
      })
      .catch(err => console.error("Failed to load settings", err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('http://localhost:8000/api/brutal/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm_provider: provider,
          gemini_api_key: apiKey
        })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings", err);
    }
    setSaving(false);
  };

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: '#121216', color: '#e2e8f0', padding: '2rem'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3rem', gap: '1rem' }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
            padding: '0.5rem', borderRadius: '50%', cursor: 'pointer'
          }}>
            <ArrowLeft size={20} />
          </button>
          <h2 style={{ margin: 0, color: '#fbbf24', fontSize: '2.5rem' }}>System Settings</h2>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <Cpu color="#a78bfa" size={28} />
            <h3 style={{ margin: 0, color: '#a78bfa', fontSize: '1.5rem' }}>AI Story Director</h3>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontWeight: 'bold' }}>LLM Provider</label>
            <select 
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'gemini' | 'ollama')}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #334155',
                background: '#1e293b', color: 'white', fontSize: '1rem'
              }}
            >
              <option value="gemini">Google Gemini 2.5 (Cloud)</option>
              <option value="ollama">Local Ollama (Llama 3)</option>
            </select>
          </div>

          {provider === 'gemini' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontWeight: 'bold' }}>Gemini API Key</label>
              <input 
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                style={{
                  width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #334155',
                  background: '#1e293b', color: 'white', fontSize: '1rem'
                }}
              />
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
                Your key is stored locally in <code style={{ color: '#fbbf24' }}>backend/data/settings.json</code>.
              </p>
            </div>
          )}

          {provider === 'ollama' && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '4px' }}>
              <p style={{ margin: 0, color: '#93c5fd', fontSize: '0.9rem' }}>
                Ensure your local Ollama server is running on <strong>http://localhost:11434</strong> and that the <code>llama3</code> model is pulled.
              </p>
            </div>
          )}
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          style={{ 
            width: '100%', padding: '1rem', 
            background: saved ? '#10b981' : '#3b82f6', 
            color: 'white', 
            border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', 
            cursor: saving ? 'wait' : 'pointer', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
            transition: 'background 0.2s'
          }}>
          <Save size={20} /> 
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Configuration'}
        </button>

      </div>
    </div>
  );
};
