import { createSection, createTemplate } from "./templateUtils";

const IGNORED_HEADING_TEXT = new Set([
  "additional links",
  "radreport template library",
  "add comment",
  "rsna no longer publishing new templates",
]);

const IGNORED_TEXT = /^(download html|submit comment|ok|find out more)$/i;

const cleanText = (value) => value.replace(/\s+/g, " ").trim();

const getTemplateTitle = (document) => {
  const titleCandidates = [
    document.querySelector("meta[property='og:title']")?.content,
    document.querySelector("meta[name='dcterms.title']")?.content,
    document.querySelector("h1")?.textContent,
    document.title,
  ];

  return (
    titleCandidates
      .map((value) => cleanText(value || ""))
      .find((value) => value && !/radreport template library/i.test(value)) ||
    "Imported Radiology Template"
  );
};

const collectBlockText = (heading) => {
  const parts = [];
  let node = heading.nextElementSibling;
  const headingLevel = Number(heading.tagName.slice(1));

  while (node) {
    if (/^H[1-6]$/.test(node.tagName)) {
      const level = Number(node.tagName.slice(1));
      if (level <= headingLevel) {
        break;
      }
    }

    const text = cleanText(node.textContent || "");
    if (text && !IGNORED_TEXT.test(text)) {
      parts.push(text);
    }
    node = node.nextElementSibling;
  }

  return [...new Set(parts)].join(" ");
};

export function parseHtmlTemplate(html, { sourceUrl = "" } = {}) {
  if (!html || typeof html !== "string") {
    throw new Error("HTML content is required");
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  const structuredSections = [
    ...document.querySelectorAll(
      "section.level1[data-section-name], section.level1",
    ),
  ];
  const headings = structuredSections.length
    ? structuredSections.map(
        (section) => section.querySelector(":scope > header") || section,
      )
    : [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")];
  const sectionHeadings = headings.filter((heading) => {
    const text = cleanText(heading.textContent || "");
    return text && !IGNORED_HEADING_TEXT.has(text.toLowerCase());
  });

  const sections = sectionHeadings
    .map((heading) => {
      const prompt = cleanText(heading.textContent || "");
      const structuredSection = heading.closest("section.level1");
      const description = structuredSection
        ? cleanText(structuredSection.textContent || "")
            .replace(prompt, "")
            .trim()
        : collectBlockText(heading);
      return { prompt, description };
    })
    .filter(
      (section, index, allSections) =>
        section.prompt &&
        allSections.findIndex(
          (candidate) =>
            candidate.prompt.toLowerCase() === section.prompt.toLowerCase(),
        ) === index,
    )
    .map((section) => createSection(section.prompt, section.description));

  if (sections.length === 0) {
    throw new Error(
      "No report sections were found. Paste the RadReport template HTML, not the surrounding site page.",
    );
  }

  const attribution = [
    sourceUrl && `Source: ${sourceUrl}`,
    "Imported from RadReport.org.",
    "Review the RSNA RadReport license before using or redistributing imported content.",
  ]
    .filter(Boolean)
    .join("\n");

  const template = createTemplate(
    getTemplateTitle(document),
    attribution,
    sections,
  );
  return {
    template,
    warnings:
      sections.length < 2 ? ["Only one report section was detected."] : [],
  };
}
