import { useEffect, useRef, useState } from "react";

/**
 * Web Speech API hook for voice input.
 * Supports Chrome, Edge, Safari.
 * Auto-detects browser support and returns helpers.
 */
export default function useVoiceInput({ onResult } = {}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState("");
  const [interim, setInterim] = useState("");

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SR =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SR) {
      setSupported(false);
      return;
    }

    setSupported(true);

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => {
      setListening(true);
      setError("");
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed") {
        setError("Microphone permission denied.");
      } else if (e.error === "no-speech") {
        // Silent — user didn't speak
      } else {
        setError(`Voice error: ${e.error}`);
      }
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    rec.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (interimText) setInterim(interimText);

      if (finalText) {
        setInterim("");
        if (onResult) onResult(finalText.trim());
      }
    };

    recognitionRef.current = rec;

    return () => {
      try {
        rec.abort();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch {
      // already started
    }
  };

  const stop = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // not started
    }
  };

  const toggle = () => {
    if (listening) stop();
    else start();
  };

  return {
    listening,
    supported,
    error,
    interim,
    start,
    stop,
    toggle,
  };
}