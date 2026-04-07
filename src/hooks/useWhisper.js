import { useState, useCallback } from 'react';

const useWhisper = () => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const transcribeAudio = useCallback(async (audioBlob) => {
    try {
      setError(null);
      setIsTranscribing(true);

      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Call Electron IPC to transcribe
      const result = await window.electron.transcribeAudio(uint8Array);

      setTranscript(result);
      return result;
    } catch (err) {
      const errorMsg = `Transcription failed: ${err.message}`;
      setError(errorMsg);
      throw err;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  return {
    isTranscribing,
    transcript,
    error,
    transcribeAudio,
    setTranscript,
  };
};

export default useWhisper;
