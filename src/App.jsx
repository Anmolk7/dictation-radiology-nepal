import React, { useState, useCallback, useEffect } from 'react';
import useAudioRecorder from './hooks/useAudioRecorder';
import useWhisper from './hooks/useWhisper';
import RecordingPanel from './components/RecordingPanel';
import PlayerPreview from './components/PlayerPreview';
import './App.css';

function App() {
  const [patientId, setPatientId] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [isElectronReady, setIsElectronReady] = useState(false);
  const [isTranscribingChunks, setIsTranscribingChunks] = useState(false);
  const [transcribingChunks, setTranscribingChunks] = useState('');

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    error: recordingError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useAudioRecorder();

  const { isTranscribing, transcript, error: transcriptError, transcribeAudio } =
    useWhisper();

  // Check if Electron API is available
  useEffect(() => {
    if (window.electron && window.electron.transcribeAudio) {
      setIsElectronReady(true);
      console.log('✓ Electron IPC bridge ready');
    } else {
      console.warn('⚠ Electron IPC bridge not available - are you running in Electron?');
    }
  }, []);

  // Listen for audio chunks and transcribe them in real-time
  useEffect(() => {
    let lastTranscript = '';

    const handleAudioChunk = async (event) => {
      const { blob, isRecording: stillRecording } = event.detail;

      if (!window.electron) {
        console.warn('❌ Cannot transcribe chunk - Electron API not available');
        return;
      }

      try {
        setIsTranscribingChunks(true);
        console.log('🎤 Transcribing accumulated audio...');

        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        console.log('   Buffer size:', uint8Array.length);

        // Transcribe the chunk via IPC
        const result = await window.electron.transcribeAudio(uint8Array);

        console.log('✅ Transcription complete!');
        console.log('   Full result:', result);

        if (result && result.trim()) {
          // Update the accumulated transcript
          lastTranscript = result;
          setTranscribingChunks(result);

          console.log('📝 Updated transcript:', result);
        } else {
          console.log('⚠️  Transcription result was empty');
        }

        setIsTranscribingChunks(false);
      } catch (err) {
        if (err.message.includes('Invalid data')) {
          console.log('⚠️  Chunk too small or incomplete, waiting for more audio...');
        } else {
          console.error('❌ Error transcribing:', err.message);
        }
        setIsTranscribingChunks(false);
      }
    };

    console.log('🎧 Setting up audio-chunk-ready listener');
    window.addEventListener('audio-chunk-ready', handleAudioChunk);

    return () => {
      console.log('🎧 Removing audio-chunk-ready listener');
      window.removeEventListener('audio-chunk-ready', handleAudioChunk);
    };
  }, []);

  const handleSaveAndTranscribe = useCallback(async () => {
    try {
      if (!window.electron) {
        throw new Error('Electron API not available. Make sure you are running in Electron.');
      }

      setSavedMessage('');

      // Use the accumulated transcript from chunks
      const finalTranscript = transcribingChunks || transcript || 'No transcription available';

      // Save to file
      const result = await window.electron.saveDictation({
        patientId,
        transcript: finalTranscript,
      });

      setSavedMessage(result.message);

      // Reset state
      setPatientId('');
      setTranscribingChunks('');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      setSavedMessage(`Error: ${err.message}`);
    }
  }, [transcribingChunks, transcript, patientId]);

  const handleStartRecording = useCallback(async () => {
    setTranscribingChunks(''); // Clear previous transcript
    await startRecording();
  }, [startRecording]);

  return (
    <div className="app">
      <div className="container">
        {!isElectronReady && (
          <div className="warning">
            ⚠ Running in browser mode. For full functionality, please run with: <code>npm run dev</code>
          </div>
        )}

        <RecordingPanel
          isRecording={isRecording}
          isPaused={isPaused}
          recordingTime={recordingTime}
          patientId={patientId}
          setPatientId={setPatientId}
          onStart={handleStartRecording}
          onStop={stopRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          isTranscribing={isTranscribingChunks || isTranscribing}
          onSaveAndTranscribe={handleSaveAndTranscribe}
          audioBlob={audioBlob}
        />

        {audioBlob && !isRecording && <PlayerPreview audioBlob={audioBlob} />}

        {(transcribingChunks || transcript) && (
          <div className="transcript">
            <h3>📝 Live Transcription:</h3>
            <p>{transcribingChunks || transcript}</p>
            {(isTranscribingChunks || isTranscribing) && <span className="transcribing-indicator">Writing...</span>}
          </div>
        )}

        {recordingError && <div className="error">{recordingError}</div>}
        {transcriptError && <div className="error">{transcriptError}</div>}
        {savedMessage && <div className="success">{savedMessage}</div>}
      </div>
    </div>
  );
}

export default App;
