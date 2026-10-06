"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNpcDialogue = generateNpcDialogue;
/**
 * Generates dynamic dialogue responses based on NPC state and active simulation conditions.
 */
function generateNpcDialogue(npc, playerQuery, isFamineActive) {
    if (isFamineActive && npc.currentMood !== 'HOSTILE') {
        npc.currentMood = 'PANICKED';
        return `*${npc.name} wringing their hands* — "There is no food left! The granaries are bone dry! If you have silver or supplies, for the love of the gods, share them!"`;
    }
    if (npc.attunementLevel > 0.7) {
        return `*${npc.name} eyes you with shimmering aetheric tension* — "You smell of the leylines, traveler... Be careful what powers you invoke in these walls."`;
    }
    return `*${npc.name} nods cautiously* — "Greetings, traveler. Welcome to our burg. Keep your blade sheathed and respect our laws."`;
}
//# sourceMappingURL=npcConversationEngine.js.map