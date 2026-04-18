import { useState, useCallback, useEffect, useRef } from "react";

const useWhisper = (
  onStreamingUpdate,
  onTranscriptionComplete,
  active = true,
) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const callbacksRef = useRef({ onStreamingUpdate, onTranscriptionComplete });
  const completeCallbackRef = useRef(false);

  // Update the callbacks ref whenever they change, but don't re-register the listener
  useEffect(() => {
    callbacksRef.current = { onStreamingUpdate, onTranscriptionComplete };
  }, [onStreamingUpdate, onTranscriptionComplete]);

  // Listen for streaming transcription updates only when active
  useEffect(() => {
    if (!active) {
      return undefined;
    }

    if (!window.electron || !window.electron.onTranscriptionUpdate) {
      console.warn("🟡 onTranscriptionUpdate not available yet");
      return undefined;
    }

    console.log("🎧 Setting up transcription update listener");

    const handleUpdate = (data) => {
      console.log(
        "[useWhisper] Event received:",
        data.type,
        "sessionId:",
        data.sessionId,
      );
      if (data.type === "segment") {
        console.log(
          "[useWhisper] Segment update:",
          data.text?.substring(0, 50),
        );
        if (callbacksRef.current.onStreamingUpdate) {
          callbacksRef.current.onStreamingUpdate(
            data.fullTranscript,
            data.sessionId,
          );
        } else {
          setTranscript(data.fullTranscript);
        }
      } else if (data.type === "complete") {
        console.log(
          "[useWhisper] Complete event:",
          data.text?.substring(0, 50),
        );
        if (callbacksRef.current.onStreamingUpdate) {
          callbacksRef.current.onStreamingUpdate(data.text, data.sessionId);
        } else {
          setTranscript(data.text);
        }
        setIsTranscribing(false);
        if (completeCallbackRef.current) {
          console.log("[useWhisper] Calling onTranscriptionComplete");
          if (callbacksRef.current.onTranscriptionComplete) {
            console.log(
              "[useWhisper] onTranscriptionComplete exists, calling it",
            );
            callbacksRef.current.onTranscriptionComplete(data.sessionId);
          }
        }
      }
    };

    const unsubscribe = window.electron.onTranscriptionUpdate(handleUpdate);
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [active]);

  const transcribeAudio = useCallback(
    async (
      audioBlob,
      isStreaming = false,
      shouldCallComplete = false,
      sessionId = null,
    ) => {
      try {
        if (!window.electron || !window.electron.transcribeAudio) {
          throw new Error(
            "Electron API not available. Make sure you are running the app with: npm run dev",
          );
        }

        completeCallbackRef.current = shouldCallComplete;
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
          "sessionId:",
          sessionId,
        );

        // Call Electron IPC to transcribe
        const result = await window.electron.transcribeAudio({
          audioBuffer: uint8Array,
          sessionId,
        });

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
      } finally {
        completeCallbackRef.current = false;
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
