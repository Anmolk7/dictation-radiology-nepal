import React from "react";

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
  templates = [],
  selectedTemplate = null,
  onTemplateChange = () => {},
  onTemplateSubmit = () => {},
  onHomeClick = () => {},
  formError = "",
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

      <div className="template-selector">
        <label htmlFor="templateSelect">Dictation Template (Optional):</label>
        <select
          id="templateSelect"
          value={selectedTemplate?.id || ""}
          onChange={(e) => {
            const selected = templates.find((t) => t.id === e.target.value);
            onTemplateChange(selected || null);
          }}
          disabled={isRecording}
          className="template-select"
        >
          <option value="">None (Free-form dictation)</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} ({template.sections.length} sections)
            </option>
          ))}
        </select>
        {selectedTemplate && (
          <div className="selected-template-info">
            ✓ Using template: <strong>{selectedTemplate.name}</strong>
          </div>
        )}
      </div>

      <div className="template-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onHomeClick}
        >
          ← Home
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onTemplateSubmit}
          disabled={!patientId.trim() || !selectedTemplate}
        >
          Continue to Template
        </button>
      </div>

      {formError && <div className="error">{formError}</div>}

      {audioBlob && !isRecording && (
        <button
          className="btn btn-success"
          onClick={onSaveAndTranscribe}
          disabled={isTranscribing}
        >
          {isTranscribing ? "Transcribing..." : "Save & Transcribe"}
        </button>
      )}
    </div>
  );
};

export default RecordingPanel;
