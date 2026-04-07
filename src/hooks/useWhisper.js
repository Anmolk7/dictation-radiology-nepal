import { useState, useCallback } from 'react';

const useWhisper = () => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const transcribeAudio = useCallback(async (audioBlob) => {
    try {
      if (!window.electron || !window.electron.transcribeAudio) {
        throw new Error(
          'Electron API not available. Make sure you are running the app with: npm run dev'
        );
      }

      setError(null);
      setIsTranscribing(true);

      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      console.log('Transcribing audio buffer of size:', uint8Array.length);

      // Call Electron IPC to transcribe
      const result = await window.electron.transcribeAudio(uint8Array);

      console.log('Transcription result:', result);

      setTranscript(result);
      return result;
    } catch (err) {
      const errorMsg = `Transcription failed: ${err.message}`;
      console.error(errorMsg, err);
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
