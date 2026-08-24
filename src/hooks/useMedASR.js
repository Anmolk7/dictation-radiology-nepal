import { useCallback, useState } from "react";

const useMedASR = (onTranscriptionUpdate, onTranscriptionComplete) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);

  const transcribeAudio = useCallback(
    async (audioBlob, sessionId = null, isFinal = false) => {
      if (!window.electron?.transcribeAudio) {
        throw new Error(
          "Electron API not available. Start the app with npm run dev.",
        );
      }

      try {
        setError(null);
        setTranscript("");
        setIsTranscribing(true);

        const audioBuffer = new Uint8Array(await audioBlob.arrayBuffer());
        const result = await window.electron.transcribeAudio({
          audioBuffer,
          sessionId,
        });

        setTranscript(result);
        onTranscriptionUpdate?.(result, sessionId);
        if (isFinal) {
          onTranscriptionComplete?.(sessionId);
        }
        return result;
      } catch (err) {
        const errorMessage = `MedASR transcription failed: ${err.message}`;
        console.error(errorMessage, err);
        setError(errorMessage);
        throw err;
      } finally {
        setIsTranscribing(false);
      }
    },
    [onTranscriptionComplete, onTranscriptionUpdate],
  );

  return { isTranscribing, transcript, error, transcribeAudio, setTranscript };
};

export default useMedASR;