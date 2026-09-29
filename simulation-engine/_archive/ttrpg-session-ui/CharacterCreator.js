"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterCreator = CharacterCreator;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
function CharacterCreator({ sessionId, onCharacterCreated, title }) {
    const [name, setName] = (0, react_1.useState)('');
    const [type, setType] = (0, react_1.useState)('Attuned');
    const [creatureType, setCreatureType] = (0, react_1.useState)('Mammal');
    const [attributes, setAttributes] = (0, react_1.useState)({
        might: 10, endurance: 10, finesse: 10, reflex: 10,
        vitality: 10, fortitude: 10, knowledge: 10, logic: 10,
        awareness: 10, intuition: 10, charm: 10, willpower: 10
    });
    const handleUpdate = (attr, val) => {
        setAttributes(prev => ({ ...prev, [attr]: val }));
    };
    const handleComplete = async () => {
        if (!name)
            return alert("Enter a name");
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
            }
            else {
                alert(data.error);
            }
        }
        catch (e) {
            alert("Failed to create character: " + e.message);
        }
    };
    return ((0, jsx_runtime_1.jsx)("div", { style: { padding: '2rem', background: '#0a0a0a', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }, children: (0, jsx_runtime_1.jsxs)("div", { style: { maxWidth: '600px', margin: '0 auto', background: '#111', padding: '2rem', borderRadius: '6px', border: '1px solid #333' }, children: [(0, jsx_runtime_1.jsx)("h2", { style: { color: '#ffb703', marginTop: 0 }, children: title }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }, children: [(0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Character Name", value: name, onChange: e => setName(e.target.value), style: { padding: '0.75rem', background: '#222', border: '1px solid #444', color: '#fff' } }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '1rem' }, children: [(0, jsx_runtime_1.jsxs)("select", { value: type, onChange: e => setType(e.target.value), style: { flex: 1, padding: '0.75rem', background: '#222', border: '1px solid #444', color: '#fff' }, children: [(0, jsx_runtime_1.jsx)("option", { value: "Attuned", children: "Attuned (Magic/Focus)" }), (0, jsx_runtime_1.jsx)("option", { value: "Null", children: "Null (Science/Stamina)" })] }), (0, jsx_runtime_1.jsxs)("select", { value: creatureType, onChange: e => setCreatureType(e.target.value), style: { flex: 1, padding: '0.75rem', background: '#222', border: '1px solid #444', color: '#fff' }, children: [(0, jsx_runtime_1.jsx)("option", { value: "Mammal", children: "Mammal" }), (0, jsx_runtime_1.jsx)("option", { value: "Avian", children: "Avian" }), (0, jsx_runtime_1.jsx)("option", { value: "Reptile", children: "Reptile" })] })] })] }), (0, jsx_runtime_1.jsx)("h3", { style: { color: '#aaa', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }, children: "The 12 Constants" }), (0, jsx_runtime_1.jsx)("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }, children: Object.entries(attributes).map(([attr, val]) => ((0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', padding: '0.5rem 1rem', borderRadius: '4px' }, children: [(0, jsx_runtime_1.jsx)("span", { style: { textTransform: 'capitalize' }, children: attr }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => handleUpdate(attr, Math.max(1, val - 1)), style: { background: '#333', color: '#fff', border: 'none', padding: '0.25rem 0.5rem', cursor: 'pointer' }, children: "-" }), (0, jsx_runtime_1.jsx)("span", { style: { width: '20px', textAlign: 'center' }, children: val }), (0, jsx_runtime_1.jsx)("button", { onClick: () => handleUpdate(attr, Math.min(20, val + 1)), style: { background: '#333', color: '#fff', border: 'none', padding: '0.25rem 0.5rem', cursor: 'pointer' }, children: "+" })] })] }, attr))) }), (0, jsx_runtime_1.jsx)("button", { onClick: handleComplete, style: { width: '100%', padding: '1rem', background: '#d90429', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold' }, children: "FINALIZE CHARACTER" })] }) }));
}
//# sourceMappingURL=CharacterCreator.js.map