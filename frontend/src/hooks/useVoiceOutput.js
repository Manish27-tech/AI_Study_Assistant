import { useEffect, useState } from "react";

/**
 * Text-to-speech via browser SpeechSynthesis API.
 */
export default function useVoiceOutput() {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const speak = (id, text) => {
    if (!supported) return;

    // If already speaking this id → stop
    if (speakingId === id) {
      stop();
      return;
    }

    // Stop anything currently speaking
    window.speechSynthesis.cancel();

    // Strip markdown for cleaner speech
    const clean = text
      .replace(/```[\s\S]*?```/g, " code block ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*_#>~]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\$\$[\s\S]*?\$\$/g, " formula ")
      .replace(/\$([^$]+)\$/g, "$1")
      .replace(/\n{2,}/g, ". ")
      .slice(0, 3000);

    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 1.0;
    utter.pitch = 1.0;

    utter.onstart = () => setSpeakingId(id);
    utter.onend = () => setSpeakingId(null);
    utter.onerror = () => setSpeakingId(null);

    window.speechSynthesis.speak(utter);
  };

  const stop = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  };

  return {
    supported,
    speakingId,
    speak,
    stop,
  };
}