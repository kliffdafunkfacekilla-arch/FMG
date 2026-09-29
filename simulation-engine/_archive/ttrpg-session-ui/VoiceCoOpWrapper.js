"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSpeechToText = useSpeechToText;
exports.speakDMResponse = speakDMResponse;
const react_1 = require("react");
// Speech-to-Text Hook
function useSpeechToText(onTranscript) {
    const [isListening, setIsListening] = (0, react_1.useState)(false);
    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Speech-to-Text is not supported in this browser.');
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event) => {
            const speechText = event.results[0][0].transcript;
            onTranscript(speechText);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
    };
    return { isListening, startListening };
}
// Text-to-Speech Function
function speakDMResponse(text, enabled) {
    if (!enabled || !('speechSynthesis' in window))
        return;
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 0.9; // Gritty DM pitch
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
}
//# sourceMappingURL=VoiceCoOpWrapper.js.map