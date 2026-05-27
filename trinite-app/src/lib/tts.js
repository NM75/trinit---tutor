// Synthèse vocale de Trinité (Web Speech API).
// Découpe le texte en phrases pour un rythme naturel.

const speakQueue = { cancel: false };

export const speakNatural = (text, onDone) => {
  if (!("speechSynthesis" in window)) { onDone?.(); return; }
  window.speechSynthesis.cancel();
  speakQueue.cancel = false;
  const sentences = text
    .replace(/([.!?…])\s+/g, "$1|||")
    .split("|||")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const voices = window.speechSynthesis.getVoices();
  const frVoice =
    voices.find((v) => v.lang.startsWith("fr") && v.name.toLowerCase().includes("audrey")) ||
    voices.find((v) => v.lang.startsWith("fr") && v.name.toLowerCase().includes("thomas")) ||
    voices.find((v) => v.lang.startsWith("fr"));
  let i = 0;
  const speakNext = () => {
    if (speakQueue.cancel || i >= sentences.length) { onDone?.(); return; }
    const u = new SpeechSynthesisUtterance(sentences[i]);
    u.lang = "fr-FR";
    u.rate = 0.82;
    u.pitch = 1.05;
    if (frVoice) u.voice = frVoice;
    u.onend = () => { i++; setTimeout(speakNext, 350); };
    u.onerror = () => { i++; speakNext(); };
    window.speechSynthesis.speak(u);
  };
  speakNext();
};

export const stopSpeaking = () => {
  speakQueue.cancel = true;
  window.speechSynthesis?.cancel();
};