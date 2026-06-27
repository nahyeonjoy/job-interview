"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
  }, []);

  const speak = useCallback(
    (text: string, rate = 1.0, pitch = 1.0) => {
      if (!isSupported) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      utterance.rate = rate;
      utterance.pitch = pitch;

      // Pick Korean voice if available
      const voices = window.speechSynthesis.getVoices();
      const koVoice = voices.find((v) => v.lang.startsWith("ko"));
      if (koVoice) utterance.voice = koVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported]
  );

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported };
}
