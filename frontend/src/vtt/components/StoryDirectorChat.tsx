import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

interface Message {
  sender: 'system' | 'director' | 'player';
  content: string;
}

interface StoryDirectorChatProps {
    characterId: string | null;
    worldId: string | null;
    regionId: string | null;
}

export const StoryDirectorChat: React.FC<StoryDirectorChatProps> = ({ characterId, worldId, regionId }) => {
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'system', content: 'Connecting to the SAGA Story Director...' }
  ]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket('ws://localhost:8000/ws/chat');
      
      ws.current.onopen = () => {
        setConnected(true);
        // Send init sequence
        if (characterId && worldId && regionId) {
            ws.current?.send(JSON.stringify({
                type: 'session_init',
                character_id: characterId,
                world_id: worldId,
                region_id: regionId
            }));
        } else {
            setMessages(prev => [...prev, { sender: 'system', content: 'Connected to the AI Director.' }]);
        }
      };
      
      ws.current.onmessage = (event) => {
        setMessages(prev => [...prev, { sender: 'director', content: event.data }]);
      };
      
      ws.current.onclose = () => {
        setConnected(false);
        setMessages(prev => [...prev, { sender: 'system', content: 'Connection lost. Retrying in 5s...' }]);
        setTimeout(connect, 5000);
      };
    };
    
    connect();
    
    return () => {
      if (ws.current) ws.current.close();
    };
  }, [characterId, worldId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    
    setMessages(prev => [...prev, { sender: 'player', content: input }]);
    ws.current.send(JSON.stringify({ type: 'player_input', content: input }));
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#121216' }}>
      
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: '#fbbf24' }}>Story Director</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: connected ? '#10b981' : '#f87171' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#10b981' : '#f87171' }} />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Chat History */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            padding: '1rem', borderRadius: '8px', lineHeight: 1.5, maxWidth: '90%',
            alignSelf: msg.sender === 'system' ? 'center' : (msg.sender === 'player' ? 'flex-end' : 'flex-start'),
            background: msg.sender === 'system' ? 'rgba(239, 68, 68, 0.1)' : (msg.sender === 'player' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)'),
            borderLeft: msg.sender === 'system' ? '4px solid #ef4444' : (msg.sender === 'director' ? '4px solid #3b82f6' : 'none'),
            borderRight: msg.sender === 'player' ? '4px solid #10b981' : 'none',
            color: msg.sender === 'system' ? '#fca5a5' : '#e2e8f0',
            fontFamily: msg.sender === 'director' ? 'Georgia, serif' : 'inherit',
            fontSize: msg.sender === 'system' ? '0.9rem' : '1.05rem',
          }}>
            {msg.content}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '1rem', background: 'rgba(20, 20, 25, 0.9)', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', gap: '0.8rem' }}>
        <textarea 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="What do you do?"
          style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.8rem', borderRadius: '6px', resize: 'none', outline: 'none', fontFamily: 'inherit' }}
          rows={2}
        />
        <button 
          onClick={handleSend}
          style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', padding: '0 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Send size={18} /> Send
        </button>
      </div>

    </div>
  );
};
