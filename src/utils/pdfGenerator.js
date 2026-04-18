import { jsPDF } from "jspdf";

/**
 * Generate a PDF document from template and mapped content
 * @param {Object} params
 * @param {string} params.patientId - Patient ID
 * @param {Object} params.template - Template object with sections
 * @param {Object} params.mappedContent - Map of sectionId -> content text
 * @returns {ArrayBuffer} PDF as array buffer
 */
export const generatePDF = ({ patientId, template, mappedContent }) => {
  try {
    // Create PDF document (A4, mm)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 12; // 12mm margins
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // Set default font
    pdf.setFont("Helvetica", "normal");

    // Header with patient info
    pdf.setFont("Helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Radiology Dictation Report", margin, yPosition);

    yPosition += 8;
    pdf.setFont("Helvetica", "normal");
    pdf.setFontSize(10);

    const reportDate = new Date().toLocaleString();
    const headerInfo = [
      `Patient ID: ${patientId}`,
      `Template: ${template.name}`,
      `Date: ${reportDate}`,
    ];

    headerInfo.forEach((line) => {
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    });

    // Add separator line
    yPosition += 3;
    pdf.setDrawColor(100, 100, 100);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    // Add sections
    template.sections.forEach((section) => {
      const content = mappedContent[section.id] || "";

      // Check if we need a new page
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = margin;
      }

      // Section heading
      pdf.setFont("Helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(40, 40, 100); // Dark blue for headings
      pdf.text(
        section.prompt || section.name || "Untitled Section",
        margin,
        yPosition,
      );

      yPosition += 6;

      // Section content
      pdf.setFont("Helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0); // Black for content

      if (content.trim()) {
        // Split text into lines that fit the page width
        const lines = pdf.splitTextToSize(content, contentWidth);
        pdf.text(lines, margin, yPosition);
        yPosition += lines.length * 4 + 2;
      } else {
        // Empty section indicator
        pdf.setTextColor(150, 150, 150); // Gray for empty sections
        pdf.text("[No content provided]", margin, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 4;
      }

      // Add spacing between sections
      yPosition += 3;
    });

    // Footer
    pdf.setFont("Helvetica", "italic");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    const footerText = `Generated: ${new Date().toISOString()}`;
    pdf.text(footerText, margin, pageHeight - 8, { align: "left" });

    // Get PDF as array buffer
    const pdfData = pdf.output("arraybuffer");
    return pdfData;
  } catch (err) {
    console.error("Error generating PDF:", err);
    throw new Error(`Failed to generate PDF: ${err.message}`);
  }
};

/**
 * Alternative: Simple text-to-PDF for testing
 * Generates a simpler PDF with just the content
 */
export const generateSimplePDF = ({ patientId, template, mappedContent }) => {
  try {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;
    let yPos = margin;

    // Title
    pdf.setFont("Helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Dictation Report", margin, yPos);
    yPos += 10;

    // Patient info
    pdf.setFont("Helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Patient: ${patientId}`, margin, yPos);
    yPos += 5;
    pdf.text(`Template: ${template.name}`, margin, yPos);
    yPos += 10;

    // Sections
    template.sections.forEach((section) => {
      const content = mappedContent[section.id] || "";

      // Check for page break
      if (yPos > 250) {
        pdf.addPage();
        yPos = margin;
      }

      // Section title
      pdf.setFont("Helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(
        section.prompt || section.name || "Untitled Section",
        margin,
        yPos,
      );
      yPos += 6;

      // Section content
      pdf.setFont("Helvetica", "normal");
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(
        content.trim() || "[Empty]",
        contentWidth,
      );
      pdf.text(lines, margin, yPos);
      yPos += lines.length * 4 + 4;
    });

    return pdf.output("arraybuffer");
  } catch (err) {
    throw new Error(`PDF generation failed: ${err.message}`);
  }
};

/**
 * Convert ArrayBuffer to Blob for downloading/sending
 */
export const arrayBufferToBlob = (arrayBuffer, type = "application/pdf") => {
  return new Blob([arrayBuffer], { type });
};
