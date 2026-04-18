import React, { useState } from "react";
import { generatePDF, arrayBufferToBlob } from "../utils/pdfGenerator";
import "./TemplateReview.css";

const TemplateReview = ({
  patientId,
  template,
  mappedContent,
  onConfirmSave,
  onBack,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  const handleConfirmSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      if (!window.electron) {
        throw new Error("Electron API not available");
      }

      // Show file save dialog
      console.log("📁 Opening file save dialog...");
      const dialogResult = await window.electron.showSaveDialog({
        patientId,
      });

      if (dialogResult.canceled) {
        console.log("User cancelled save dialog");
        setIsSaving(false);
        return;
      }

      const selectedFilePath = dialogResult.filePath;
      console.log("User selected path:", selectedFilePath);

      // Generate PDF
      console.log("🖨️ Generating PDF...");
      const pdfArrayBuffer = generatePDF({
        patientId,
        template,
        mappedContent,
      });

      // Convert to array for IPC transfer
      const pdfArray = Array.from(new Uint8Array(pdfArrayBuffer));

      console.log("💾 Saving PDF via IPC...");
      // Call save-dictation-pdf IPC with PDF data and selected path
      const result = await window.electron.saveDictationPDF({
        patientId,
        template,
        mappedContent,
        pdfData: pdfArray, // Pass PDF data to save
        filePath: selectedFilePath, // Pass user-selected file path
      });

      console.log("✅ Save result:", result);
      setSuccessMessage(result.message);
      setTimeout(() => {
        if (onConfirmSave) {
          onConfirmSave();
        }
      }, 1500);
    } catch (err) {
      console.error("❌ Error saving:", err);
      setError(`Error saving: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatContent = (text) => {
    return text
      .split("\n")
      .map((line, index) => <p key={index}>{line || "\u00a0"}</p>);
  };

  const getTotalWords = () => {
    return Object.values(mappedContent).reduce((sum, content) => {
      return (
        sum +
        content
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0).length
      );
    }, 0);
  };

  return (
    <div className="template-review">
      <div className="review-header">
        <h2>📄 Review & Save Dictation</h2>
        <p>Verify the content before saving as PDF</p>
      </div>

      {error && (
        <div className="error-box">
          <p>❌ {error}</p>
          <button className="btn btn-small" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="success-box">
          <p>✅ {successMessage}</p>
          <p style={{ fontSize: "12px", marginTop: "10px" }}>
            Redirecting to home...
          </p>
        </div>
      )}

      <div className="review-container">
        {/* Summary Panel */}
        <div className="review-summary">
          <div className="summary-card">
            <h4>📋 Dictation Details</h4>
            <div className="summary-row">
              <span className="label">Patient ID:</span>
              <span className="value">{patientId}</span>
            </div>
            <div className="summary-row">
              <span className="label">Template:</span>
              <span className="value">{template.name}</span>
            </div>
            <div className="summary-row">
              <span className="label">Sections:</span>
              <span className="value">{template.sections.length}</span>
            </div>
            <div className="summary-row">
              <span className="label">Total Words:</span>
              <span className="value">{getTotalWords()}</span>
            </div>
            <div className="summary-row">
              <span className="label">Date:</span>
              <span className="value">{new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Content Preview Panel */}
        <div className="review-content">
          <h3>📖 Content Preview</h3>
          <div className="content-preview">
            {template.sections.map((section, index) => {
              const content = mappedContent[section.id] || "";
              const hasContent = content.trim().length > 0;

              return (
                <div key={section.id} className="preview-section">
                  <div className="section-header">
                    <h4>{section.name}</h4>
                    <span
                      className={`status ${hasContent ? "filled" : "empty"}`}
                    >
                      {hasContent
                        ? `${content.trim().split(/\s+/).length} words`
                        : "Empty"}
                    </span>
                  </div>

                  <div
                    className={`section-content ${hasContent ? "" : "empty"}`}
                  >
                    {hasContent ? (
                      formatContent(content)
                    ) : (
                      <p className="placeholder">No content provided</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="review-actions">
        <button
          className="btn btn-secondary"
          onClick={onBack}
          disabled={isSaving || successMessage}
        >
          ← Edit Content
        </button>
        <button
          className="btn btn-primary"
          onClick={handleConfirmSave}
          disabled={isSaving || successMessage}
        >
          {isSaving ? (
            <>
              <span>💾 Saving...</span>
            </>
          ) : (
            "💾 Save as PDF"
          )}
        </button>
      </div>
    </div>
  );
};

export default TemplateReview;
