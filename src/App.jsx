import React, { useState, useCallback } from 'react';
import useAudioRecorder from './hooks/useAudioRecorder';
import useWhisper from './hooks/useWhisper';
import RecordingPanel from './components/RecordingPanel';
import PlayerPreview from './components/PlayerPreview';
import './App.css';

function App() {
  const [patientId, setPatientId] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

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

  const handleSaveAndTranscribe = useCallback(async () => {
    try {
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
