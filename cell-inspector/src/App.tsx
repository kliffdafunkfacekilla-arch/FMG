import React, { useState } from 'react';
import LocalCanvas from './components/LocalCanvas';

function App() {
  const [cellId, setCellId] = useState('13408');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCell = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`/teller/map/ground/${cellId}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderJsonTable = (obj: any, title: string) => {
    if (!obj) return null;
    return (
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md mb-6">
        <h2 className="text-xl font-bold text-blue-400 border-b border-gray-700 pb-2 mb-4">{title}</h2>
        
        {obj.neighbor_biomes && (
          <div className="mb-4">
            <span className="text-gray-400 font-semibold mr-2">Neighboring Biomes:</span>
            <div className="inline-flex gap-2">
              {obj.neighbor_biomes.map((b: string) => (
                <span key={b} className="text-white bg-blue-900 border border-blue-700 px-2 py-0.5 rounded text-xs">{b}</span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {Object.entries(obj).map(([key, val]) => {
            if (key === 'geometry' || key === 'resource_profile' || key === 'neighbor_biomes' || typeof val === 'object') return null;
            return (
              <div key={key} className="flex justify-between border-b border-gray-700 pb-1">
                <span className="text-gray-400 font-semibold">{key}:</span>
                <span className="text-green-300">{String(val)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderResourceProfile = (profileJson: string | null) => {
    if (!profileJson) return null;
    try {
      const profile = JSON.parse(profileJson);
      return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md mb-6">
          <h2 className="text-xl font-bold text-yellow-500 border-b border-gray-700 pb-2 mb-4">🌾 Baked Resource Profile</h2>
          
          <div className="mb-4">
            <span className="text-gray-400 font-semibold">Local Biome: </span>
            <span className="text-white bg-gray-700 px-2 py-1 rounded">{profile.myBiome}</span>
          </div>
          
          <div className="mb-4">
            <span className="text-gray-400 font-semibold">Neighboring Biomes: </span>
            <div className="flex gap-2 mt-2">
              {profile.neighborBiomes?.map((b: string) => (
                <span key={b} className="text-white bg-blue-900 border border-blue-700 px-2 py-1 rounded text-sm">{b}</span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-gray-400 font-semibold">Allocated Slots: </span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {profile.slots?.map((s: any, i: number) => (
                <div key={i} className="bg-gray-900 border border-gray-700 p-2 rounded flex justify-between">
                  <span className="text-yellow-400">{s.res}</span>
                  <span className="text-gray-300">{s.workers} workers</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <h1 className="text-3xl font-extrabold text-white mb-6">Aetheria Cell Inspector</h1>
      
      <div className="flex gap-4 mb-8 bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
        <input 
          type="number" 
          value={cellId} 
          onChange={(e) => setCellId(e.target.value)}
          placeholder="Enter Cell ID (e.g. 13408)"
          className="bg-gray-900 border border-gray-600 rounded px-4 py-2 flex-grow text-white focus:outline-none focus:border-blue-500"
        />
        <button 
          onClick={fetchCell} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded transition-colors disabled:opacity-50"
        >
          {loading ? 'Scanning...' : 'Inspect Cell'}
        </button>
      </div>

      {error && <div className="bg-red-900 border-l-4 border-red-500 text-red-200 p-4 mb-6 rounded">{error}</div>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <LocalCanvas terrain={data.terrain} burg={data.burg} />
            {renderJsonTable(data.terrain, "🌍 Terrain & Ecology")}
            {data.burg && renderJsonTable(data.burg, "🏰 Burg Economy")}
            {!data.burg && (
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md text-gray-500 italic">
                No Burg found in this cell.
              </div>
            )}
            {data.burg?.resource_profile && renderResourceProfile(data.burg.resource_profile)}
          </div>

          
          <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
              <h2 className="text-xl font-bold text-yellow-400 border-b border-gray-700 pb-2 mb-4">👑 Paragons</h2>
              {data.paragons?.length > 0 ? (
                <ul className="space-y-3">
                  {data.paragons.map((p: any) => (
                    <li key={p.id} className="bg-gray-900 p-3 rounded border border-gray-700 text-sm">
                      <span className="font-bold text-yellow-300 mr-2">{p.title} {p.name}</span>
                      <div className="text-gray-400 mt-1">Corruption: <span className="text-red-400">{p.corruption_score}</span></div>
                      <div className="text-gray-400">Traits: {p.traits}</div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-gray-500 italic">No Paragons present.</p>}
            </div>

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
              <h2 className="text-xl font-bold text-red-400 border-b border-gray-700 pb-2 mb-4">🏴 Outlaws & Lairs</h2>
              {data.outlaws?.length > 0 ? (
                <ul className="space-y-3">
                  {data.outlaws.map((o: any) => (
                    <li key={o.id} className="bg-gray-900 p-3 rounded border border-gray-700 text-sm">
                      <pre className="text-xs text-red-300">{JSON.stringify(o, null, 2)}</pre>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-gray-500 italic">No Lairs present.</p>}
            </div>

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
              <h2 className="text-xl font-bold text-green-400 border-b border-gray-700 pb-2 mb-4">👤 Dynamic Agents</h2>
              {data.agents?.length > 0 ? (
                <ul className="space-y-3">
                  {data.agents.map((a: any) => (
                    <li key={a.id} className="bg-gray-900 p-3 rounded border border-gray-700 text-sm">
                       <span className="font-bold text-green-300">{a.role}</span> (Status: {a.state})
                    </li>
                  ))}
                </ul>
              ) : <p className="text-gray-500 italic">No Agents currently traversing this cell.</p>}
            </div>
            
             <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
              <h2 className="text-xl font-bold text-purple-400 border-b border-gray-700 pb-2 mb-4">🏗️ Infrastructure</h2>
              {data.infrastructure?.length > 0 ? (
                <ul className="space-y-3">
                  {data.infrastructure.map((i: any) => (
                    <li key={i.id} className="bg-gray-900 p-3 rounded border border-gray-700 text-sm">
                       <pre className="text-xs text-purple-300">{JSON.stringify(i, null, 2)}</pre>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-gray-500 italic">No Infrastructure built here.</p>}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default App;
