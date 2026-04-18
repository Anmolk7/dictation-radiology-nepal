import React, { useState } from "react";
import {
  createTemplate,
  createSection,
  validateTemplate,
} from "../utils/templateUtils";
import "./TemplateBuilder.css";

const TemplateBuilder = ({ onSave, onCancel, initialTemplate = null }) => {
  const [templateName, setTemplateName] = useState(initialTemplate?.name || "");
  const [templateDescription, setTemplateDescription] = useState(
    initialTemplate?.description || "",
  );
  const [sections, setSections] = useState(initialTemplate?.sections || []);
  const [errors, setErrors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleAddSection = () => {
    const newSection = createSection("", "");
    setSections([...sections, newSection]);
  };

  const handleUpdateSection = (sectionId, field, value) => {
    setSections(
      sections.map((section) =>
        section.id === sectionId ? { ...section, [field]: value } : section,
      ),
    );
  };

  const handleRemoveSection = (sectionId) => {
    setSections(sections.filter((section) => section.id !== sectionId));
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setErrors([]);
    setSuccessMessage("");

    if (!templateName.trim()) {
      setErrors(["Template name is required"]);
      return;
    }

    if (sections.length === 0) {
      setErrors(["At least one section is required"]);
      return;
    }

    try {
      setIsSaving(true);

      // Create or update template object
      let template;
      if (initialTemplate) {
        template = {
          ...initialTemplate,
          name: templateName,
          description: templateDescription,
          sections,
          updatedAt: new Date().toISOString(),
        };
      } else {
        template = createTemplate(templateName, templateDescription, sections);
      }

      // Validate
      const { isValid, errors: validationErrors } = validateTemplate(template);
      if (!isValid) {
        setErrors(validationErrors);
        return;
      }

      // Save via Electron IPC
      if (!window.electron) {
        throw new Error(
          "Electron API not available. Make sure you are running in Electron.",
        );
      }

      const ipcMethod = initialTemplate ? "updateTemplate" : "createTemplate";
      const result = await window.electron[ipcMethod](template);

      setSuccessMessage(result.message);
      setTimeout(() => {
        if (onSave) {
          onSave(template);
        }
      }, 1000);
    } catch (err) {
      setErrors([`Error saving template: ${err.message}`]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="template-builder">
      <div className="builder-container">
        <div className="builder-header">
          <h2>{initialTemplate ? "Edit Template" : "Create New Template"}</h2>
          <p>Design your dictation template by adding sections</p>
        </div>

        {errors.length > 0 && (
          <div className="error-box">
            {errors.map((error, index) => (
              <p key={index}>❌ {error}</p>
            ))}
          </div>
        )}

        {successMessage && (
          <div className="success-box">
            <p>✅ {successMessage}</p>
          </div>
        )}

        <form onSubmit={handleSaveTemplate}>
          {/* Template Header */}
          <div className="form-group">
            <label htmlFor="templateName">Template Name:</label>
            <input
              id="templateName"
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., CECT Abdomen"
              disabled={isSaving}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="templateDescription">Description:</label>
            <textarea
              id="templateDescription"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Optional: Describe what this template is used for"
              disabled={isSaving}
              rows="3"
            />
          </div>

          {/* Sections */}
          <div className="sections-container">
            <div className="sections-header">
              <h3>📋 Template Sections</h3>
            </div>

            {sections.length === 0 ? (
              <p className="no-sections">
                No sections yet. Click "Add Section" to get started.
              </p>
            ) : (
              <div className="sections-list">
                {sections.map((section, index) => (
                  <div key={section.id} className="section-card">
                    <div className="section-number">Section {index + 1}</div>

                    <div className="form-group">
                      <label>Section:</label>
                      <input
                        type="text"
                        value={section.prompt}
                        onChange={(e) =>
                          handleUpdateSection(
                            section.id,
                            "prompt",
                            e.target.value,
                          )
                        }
                        placeholder="e.g., Lung, Liver, Heart,"
                        disabled={isSaving}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Description (optional):</label>
                      <textarea
                        value={section.description}
                        onChange={(e) =>
                          handleUpdateSection(
                            section.id,
                            "description",
                            e.target.value,
                          )
                        }
                        placeholder="e.g., Include measurements, enhancement patterns, and any abnormalities"
                        disabled={isSaving}
                        rows="3"
                      />
                    </div>

                    <button
                      type="button"
                      className="btn btn-danger-small"
                      onClick={() => handleRemoveSection(section.id)}
                      disabled={isSaving}
                    >
                      🗑️ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="add-section-container">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddSection}
                disabled={isSaving}
              >
                + Add Section
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || sections.length === 0}
            >
              {isSaving
                ? "Saving..."
                : initialTemplate
                  ? "Update Template"
                  : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TemplateBuilder;
