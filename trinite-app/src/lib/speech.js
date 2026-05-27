// Reconnaissance vocale : l'enfant pose ses questions au micro.
import { useState, useEffect, useRef, useCallback } from "react";
import { stopSpeaking } from "./tts";

export const useSpeechRecognition = () => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [available, setAvailable] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    setAvailable(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    stopSpeaking();
    try {
      const r = new SR();
      r.lang = "fr-FR";
      r.continuous = false;
      r.interimResults = false;
      r.onstart = () => setListening(true);
      r.onresult = (e) => {
        setTranscript(e.results[0][0].transcript);
        setListening(false);
      };
      r.onerror = () => setListening(false);
      r.onend = () => setListening(false);
      recognitionRef.current = r;
      r.start();
    } catch (e) {
      setAvailable(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, transcript, startListening, stopListening, setTranscript, available };
};