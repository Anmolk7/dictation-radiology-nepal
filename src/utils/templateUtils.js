/**
 * Template Utilities
 * Handles template schema, validation, and file path management
 */

// Template schema definition
export const TEMPLATE_SCHEMA = {
  id: "", // e.g., "cect-abdomen-2026"
  name: "", // e.g., "CECT Abdomen"
  description: "", // e.g., "CT abdomen with contrast"
  sections: [], // Array of sections
  createdAt: "", // ISO timestamp
  updatedAt: "", // ISO timestamp
};

// Section schema
export const SECTION_SCHEMA = {
  id: "", // unique id within template (auto-generated or uuid)
  prompt: "", // e.g., "Describe liver size, attenuation, focal lesions"
  description: "", // optional guidance text (renamed from prompt)
  type: "text", // future support for: checkbox, multiline, dropdown
};

/**
 * Validate template structure
 * @param {Object} template - Template object to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export const validateTemplate = (template) => {
  const errors = [];

  if (!template.id || typeof template.id !== "string") {
    errors.push("Template ID is required and must be a string");
  }

  if (!template.name || typeof template.name !== "string") {
    errors.push("Template name is required and must be a string");
  }

  if (!Array.isArray(template.sections)) {
    errors.push("Sections must be an array");
  } else {
    if (template.sections.length === 0) {
      errors.push("Template must have at least one section");
    }

    template.sections.forEach((section, index) => {
      if (!section.id) {
        errors.push(`Section ${index} is missing an ID`);
      }
      if (!section.prompt) {
        errors.push(`Section ${index} is missing a prompt`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Generate a unique template ID from name
 * @param {string} templateName - Human-readable template name
 * @returns {string} slugified ID
 */
export const generateTemplateId = (templateName) => {
  const timestamp = Date.now().toString(36); // base36 encoding for shorter IDs
  const slug = templateName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 30);
  return `${slug}-${timestamp}`;
};

/**
 * Generate a unique section ID
 * @returns {string} UUID-like ID
 */
export const generateSectionId = () => {
  return `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new template object with defaults
 * @param {string} name - Template name
 * @param {string} description - Template description
 * @param {Array} sections - Array of sections
 * @returns {Object} Template object
 */
export const createTemplate = (name, description = "", sections = []) => {
  const now = new Date().toISOString();
  return {
    id: generateTemplateId(name),
    name,
    description,
    sections,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Create a new section object
 * @param {string} prompt - Section prompt (what to dictate)
 * @param {string} description - Optional guidance description
 * @returns {Object} Section object
 */
export const createSection = (prompt, description = "", type = "text") => {
  return {
    id: generateSectionId(),
    prompt,
    description,
    type,
  };
};

/**
 * Serialize template to JSON string
 * @param {Object} template - Template object
 * @returns {string} JSON string
 */
export const serializeTemplate = (template) => {
  return JSON.stringify(template, null, 2);
};

/**
 * Deserialize template from JSON string
 * @param {string} jsonString - JSON string
 * @returns {Object} Template object
 */
export const deserializeTemplate = (jsonString) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Failed to parse template JSON: ${error.message}`);
  }
};
