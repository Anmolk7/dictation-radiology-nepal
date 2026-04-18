import React, { useState } from "react";
import "./TemplateMapper.css";

const TemplateMapper = ({
  transcript,
  template,
  patientId,
  onSave,
  onBack,
}) => {
  const [mappedContent, setMappedContent] = useState(
    template.sections.reduce((acc, section) => {
      acc[section.id] = "";
      return acc;
    }, {}),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSectionChange = (sectionId, value) => {
    setMappedContent({
      ...mappedContent,
      [sectionId]: value,
    });
  };

  const handleSaveMapping = async () => {
    try {
      setIsSaving(true);
      setError(null);

      if (!patientId.trim()) {
        setError("Patient ID is required");
        return;
      }

      // Navigate to review page with mapped content
      if (onSave) {
        onSave(mappedContent);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getWordCount = (text) => {
    return text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  };

  const getTotalWordCount = () => {
    return Object.values(mappedContent).reduce(
      (sum, content) => sum + getWordCount(content),
      0,
    );
  };

  return (
    <div className="template-mapper">
      <div className="mapper-header">
        <div>
          <h2>📋 Map Transcription to Template</h2>
          <p>Organize your transcription into template sections</p>
        </div>
        <div className="mapper-stats">
          <div className="stat">
            <strong>{getTotalWordCount()}</strong>
            <span>Words</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-box">
          <p>❌ {error}</p>
        </div>
      )}

      <div className="mapper-container">
        {/* Transcription Panel (Right) */}
        <div className="transcription-panel">
          <h3>📝 Original Transcription</h3>
          <div className="transcription-content">
            <p>{transcript || "No transcription available"}</p>
          </div>
          <button
            className="btn btn-small"
            onClick={() => {
              navigator.clipboard.writeText(transcript);
            }}
          >
            📋 Copy All
          </button>
        </div>

        {/* Mapping Panel (Left) */}
        <div className="mapping-panel">
          <h3>✍️ Template Sections</h3>
          <div className="sections-mapping">
            {template.sections.map((section) => (
              <div key={section.id} className="section-mapping">
                <div className="section-title">
                  <h4>{section.name}</h4>
                  {section.prompt && (
                    <p className="section-prompt">{section.prompt}</p>
                  )}
                </div>

                <textarea
                  value={mappedContent[section.id]}
                  onChange={(e) =>
                    handleSectionChange(section.id, e.target.value)
                  }
                  placeholder="Enter content for this section..."
                  className="section-textarea"
                  rows="6"
                />

                <div className="section-footer">
                  <span className="word-count">
                    {getWordCount(mappedContent[section.id])} words
                  </span>
                  <button
                    className="btn btn-tiny danger"
                    onClick={() => handleSectionChange(section.id, "")}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mapper-actions">
        <button
          className="btn btn-secondary"
          onClick={onBack}
          disabled={isSaving}
        >
          ← Back to Edit
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSaveMapping}
          disabled={isSaving}
        >
          {isSaving ? "Processing..." : "Review & Save"}
        </button>
      </div>
    </div>
  );
};

export default TemplateMapper;
