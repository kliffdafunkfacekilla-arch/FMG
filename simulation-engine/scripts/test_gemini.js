const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ override: true });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: 'I try to sneak past the cultist' }] }],
      config: { 
        systemInstruction: 'Output only JSON: { "intent": "SNEAK", "stat_used": "finesse", "target": "cultist" }', 
        temperature: 0.1 
      }
    });
    console.log('SUCCESS:', result.text);
  } catch(e) {
    console.error('ERROR:', e.message);
  }
}
test();
