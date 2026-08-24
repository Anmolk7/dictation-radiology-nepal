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
        import useMedASR from "./useMedASR";
        data.type,
        // Backward-compatible alias while existing imports migrate to `useMedASR`.
        export default useMedASR;
      );
