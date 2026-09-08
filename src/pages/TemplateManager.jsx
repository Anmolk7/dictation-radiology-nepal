import React, { useState, useEffect } from "react";
import { parseHtmlTemplate } from "../utils/htmlTemplateImporter";
import "./TemplateManager.css";

const TemplateManager = ({
  onCreateNew,
  onEditTemplate,
  onImportTemplate,
  onBack,
}) => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importHtml, setImportHtml] = useState("");
  const [importError, setImportError] = useState("");
  const [importWarnings, setImportWarnings] = useState([]);
  const [isImportLoading, setIsImportLoading] = useState(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!window.electron) {
        throw new Error("Electron API not available");
      }

      const result = await window.electron.listTemplates();
      // Sort by date, newest first
      const sorted = result.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
      setTemplates(sorted);
    } catch (err) {
      setError(`Error loading templates: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      if (!window.electron) {
        throw new Error("Electron API not available");
      }

      await window.electron.deleteTemplate(templateId);
      setDeleteConfirm(null);
      await loadTemplates();
    } catch (err) {
      setError(`Error deleting template: ${err.message}`);
    }
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString();
  };

  const handleParseImport = (html, sourceUrl = "") => {
    try {
      setImportError("");
      const result = parseHtmlTemplate(html, { sourceUrl });
      setImportWarnings(result.warnings);
      onImportTemplate(result.template);
    } catch (err) {
      setImportError(err.message);
    }
  };

  const handleFetchUrl = async () => {
    try {
      setIsImportLoading(true);
      setImportError("");
      const result = await window.electron.fetchTemplateHTML(importUrl);
      handleParseImport(result.html, result.finalUrl || importUrl);
    } catch (err) {
      setImportError(`Could not fetch template: ${err.message}`);
    } finally {
      setIsImportLoading(false);
    }
  };

  return (
    <div className="template-manager">
      <div className="manager-container">
        <div className="manager-header">
          <div>
            <h2>📚 Template Manager</h2>
            <p>Manage your dictation templates</p>
          </div>
          <div className="manager-header-actions">
            <button className="btn btn-primary" onClick={onCreateNew}>
              + New Template
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setIsImporting(true);
                setImportError("");
                setImportWarnings([]);
              }}
            >
              Import HTML
            </button>
          </div>
        </div>

        {error && (
          <div className="error-box">
            <p>❌ {error}</p>
            <button className="btn btn-small" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {isImporting && (
          <div className="import-panel">
            <div className="import-panel-header">
              <div>
                <h3>Import Radiology Template</h3>
                <p>Use a RadReport URL or paste downloaded HTML.</p>
              </div>
              <button
                className="btn btn-secondary-small"
                onClick={() => setIsImporting(false)}
              >
                Cancel
              </button>
            </div>

            <div className="import-url-row">
              <input
                type="url"
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
                placeholder="https://radreport.org/home/..."
              />
              <button
                className="btn btn-primary"
                onClick={handleFetchUrl}
                disabled={!importUrl.trim() || isImportLoading}
              >
                {isImportLoading ? "Fetching..." : "Fetch URL"}
              </button>
            </div>

            <textarea
              className="import-html-input"
              value={importHtml}
              onChange={(event) => setImportHtml(event.target.value)}
              placeholder="Or paste the downloaded template HTML here..."
              rows="6"
            />
            <button
              className="btn btn-secondary"
              onClick={() => handleParseImport(importHtml, importUrl)}
              disabled={!importHtml.trim()}
            >
              Parse Pasted HTML
            </button>

            {importError && <div className="error">{importError}</div>}
            {importWarnings.length > 0 && (
              <div className="import-warning">
                {importWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="loading">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="empty-state">
            <p>📭 No templates created yet.</p>
            <button className="btn btn-primary" onClick={onCreateNew}>
              Create Your First Template
            </button>
          </div>
        ) : (
          <div className="templates-grid">
            {templates.map((template) => (
              <div key={template.id} className="template-card">
                <div className="card-header">
                  <h3>{template.name}</h3>
                  <span className="section-count">
                    {template.sections.length} sections
                  </span>
                </div>

                {template.description && (
                  <p className="card-description">{template.description}</p>
                )}

                <div className="card-meta">
                  <small>
                    Created: {formatDate(template.createdAt)}
                    {template.updatedAt !== template.createdAt && (
                      <>
                        <br />
                        Updated: {formatDate(template.updatedAt)}
                      </>
                    )}
                  </small>
                </div>

                <div className="sections-preview">
                  <strong>Template sections</strong>
                  <ul>
                    {template.sections.map((section, index) => (
                      <li key={section.id}>
                        <span className="section-preview-name">
                          {index + 1}.{" "}
                          {section.prompt || section.name || "Untitled section"}
                        </span>
                        {section.description?.trim() && (
                          <span className="section-preview-description">
                            {section.description.trim()}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="card-actions">
                  <button
                    className="btn btn-secondary-small"
                    onClick={() => onEditTemplate(template)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn btn-danger-small"
                    onClick={() => setDeleteConfirm(template.id)}
                  >
                    🗑️ Delete
                  </button>
                </div>

                {deleteConfirm === template.id && (
                  <div className="delete-confirm">
                    <p>Are you sure you want to delete this template?</p>
                    <div className="confirm-buttons">
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        Delete
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="manager-footer">
          <button className="btn btn-secondary" onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateManager;
