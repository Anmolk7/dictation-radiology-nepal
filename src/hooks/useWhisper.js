import { useState, useCallback, useEffect, useRef } from "react";

const useWhisper = (onStreamingUpdate) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const listenerSetup = useRef(false);

  // Listen for streaming transcription updates
  useEffect(() => {
    if (listenerSetup.current) return;

    if (!window.electron || !window.electron.onTranscriptionUpdate) {
      console.warn("🟡 onTranscriptionUpdate not available yet");
      return;
    }

    console.log("🎧 Setting up transcription update listener");
    listenerSetup.current = true;

    window.electron.onTranscriptionUpdate((data) => {
      console.log("📥 Received update:", data.type, data);

      if (data.type === "segment") {
        console.log("📝 New segment:", data.text);
        if (onStreamingUpdate) {
          onStreamingUpdate(data.fullTranscript);
        } else {
          setTranscript(data.fullTranscript);
        }
      } else if (data.type === "complete") {
        console.log("✅ Transcription complete");
        if (onStreamingUpdate) {
          onStreamingUpdate(data.text);
        } else {
          setTranscript(data.text);
        }
        setIsTranscribing(false);
      }
    });
  }, [onStreamingUpdate]);

  const transcribeAudio = useCallback(
    async (audioBlob, isStreaming = false) => {
      try {
        if (!window.electron || !window.electron.transcribeAudio) {
          throw new Error(
            "Electron API not available. Make sure you are running the app with: npm run dev",
          );
        }

        setError(null);
        setIsTranscribing(true);

        // Only clear transcript for non-streaming calls
        if (!isStreaming) {
          setTranscript("");
        }

        // Convert blob to array buffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        console.log(
          "🎙️ Starting transcription with buffer of size:",
          uint8Array.length,
          isStreaming ? "(streaming)" : "(final)",
        );

        // Call Electron IPC to transcribe
        const result = await window.electron.transcribeAudio(uint8Array);

        console.log("✅ Final transcription result length:", result.length);

        // For streaming, don't set the final result as it will come via updates
        if (!isStreaming) {
          setTranscript(result);
        }
        return result;
      } catch (err) {
        const errorMsg = `Transcription failed: ${err.message}`;
        console.error("❌ " + errorMsg, err);
        setError(errorMsg);
        setIsTranscribing(false);
        throw err;
      }
    },
    [],
  );

  return {
    isTranscribing,
    transcript,
    error,
    transcribeAudio,
    setTranscript,
  };
};

export default useWhisper;
