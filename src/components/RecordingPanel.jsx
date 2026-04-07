import React from 'react';
import Timer from './Timer';

const RecordingPanel = ({
  isRecording,
  isPaused,
  recordingTime,
  patientId,
  setPatientId,
  onStart,
  onStop,
  onPause,
  onResume,
  isTranscribing,
  onSaveAndTranscribe,
  audioBlob,
}) => {
  return (
    <div className="recording-panel">
      <h1>Radiology Dictation Tool</h1>

      <div className="patient-id-input">
        <label htmlFor="patientId">Patient ID:</label>
        <input
          id="patientId"
          type="text"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          placeholder="Enter patient ID (e.g., RAD001)"
          disabled={isRecording}
        />
      </div>

      {isRecording && <Timer seconds={recordingTime} />}

      <div className="controls">
        {!isRecording ? (
          <button
            className="btn btn-primary"
            onClick={onStart}
            disabled={!patientId}
          >
            Start Recording
          </button>
        ) : (
          <>
            {!isPaused ? (
              <button className="btn btn-warning" onClick={onPause}>
                Pause
              </button>
            ) : (
              <button className="btn btn-warning" onClick={onResume}>
                Resume
              </button>
            )}

            <button className="btn btn-danger" onClick={onStop}>
              Stop Recording
            </button>
          </>
        )}
      </div>

      {audioBlob && !isRecording && (
        <button
          className="btn btn-success"
          onClick={onSaveAndTranscribe}
          disabled={isTranscribing}
        >
          {isTranscribing ? 'Transcribing...' : 'Save & Transcribe'}
        </button>
      )}

      {isTranscribing && <p className="status">Transcribing audio...</p>}
    </div>
  );
};

export default RecordingPanel;
