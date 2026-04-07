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

  const handleSaveAndTranscribe = useCallback(async () => {
    try {
      if (!window.electron) {
        throw new Error('Electron API not available. Make sure you are running in Electron.');
      }

      setSavedMessage('');

      // Transcribe audio
      const transcribed = await transcribeAudio(audioBlob);

      // Save to file
      const result = await window.electron.saveDictation({
        patientId,
        transcript: transcribed,
      });

      setSavedMessage(result.message);

      // Reset state
      setPatientId('');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      setSavedMessage(`Error: ${err.message}`);
    }
  }, [audioBlob, patientId, transcribeAudio]);

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
          onStart={startRecording}
          onStop={stopRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          isTranscribing={isTranscribing}
          onSaveAndTranscribe={handleSaveAndTranscribe}
          audioBlob={audioBlob}
        />

        {audioBlob && !isRecording && <PlayerPreview audioBlob={audioBlob} />}

        {transcript && (
          <div className="transcript">
            <h3>Transcription:</h3>
            <p>{transcript}</p>
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
