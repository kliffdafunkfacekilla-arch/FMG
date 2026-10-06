"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPlayerActionWithDM = processPlayerActionWithDM;
const genai_1 = require("@google/genai");
// Initialize Google GenAI SDK using environment API key
const ai = new genai_1.GoogleGenAI();
async function processPlayerActionWithDM(payload) {
    try {
        const systemInstruction = `
You are the AI Game Master for a gritty, tactical TTRPG where reality is governed by 12 Universal Constants (Might, Endurance, Finesse, Reflex, Vitality, Fortitude, Knowledge, Logic, Awareness, Intuition, Charm, Willpower). 
Characters are either Attuned (bending cosmic constants via magic) or Nulls (stepping outside of a single constant through biological anomaly and science).

Current World: ${payload.worldName} (${payload.biome}, Chaos Level: ${payload.chaosLevel})
Active Character: ${payload.characterName} (${payload.creatureType})

Your tasks:
1. Provide an immersive, atmospheric DM narrative response in second-person.
2. Parse the player's natural language input into a structured command object with:
   - actionType: 'SKILL_CHECK', 'CAST_POWER', 'NULL_EXEMPTION', 'EQUIP_GEAR', 'DIALOGUE', 'MOVEMENT', 'ATTACK', or 'LOOT'
   - targetAttribute: the most relevant of the 12 attributes if applicable
   - targetItem: any gear or power referenced
   - targetName: the exact name of the enemy or item when attacking or looting
   - direction: optional, specify 'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW' for MOVEMENT actions
   - rawIntent: concise summary of the player's goal

Output strictly valid JSON matching this schema:
{
  "narrativeResponse": "string",
  "parsedCommand": {
    "actionType": "string",
    "targetAttribute": "string",
    "targetItem": "string",
    "targetName": "string",
    "rawIntent": "string"
  }
}
`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: `Player Input: "${payload.playerInput}"` }] }
            ],
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                temperature: 0.7
            }
        });
        const resultText = response.text;
        if (!resultText) {
            throw new Error('Empty response received from AI Game Master.');
        }
        return JSON.parse(resultText);
    }
    catch (error) {
        console.error('[AI DM ERROR]:', error.message);
        return {
            narrativeResponse: "The aether flickers uncertainly, and the DM voice remains silent for a moment as reality recalibrates.",
            parsedCommand: {
                actionType: 'DIALOGUE',
                rawIntent: payload.playerInput
            }
        };
    }
}
//# sourceMappingURL=aiGameMaster.js.map