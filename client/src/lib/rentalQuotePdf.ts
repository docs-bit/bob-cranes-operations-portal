import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { drawBobDocumentLogo, embedBobFullLogo } from "./pdfBrand";

type RentalQuoteBrief = {
  id: string;
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  projectLocation: string;
  equipmentInterest: string;
  rentalDuration?: string | null;
  liftDetails: string;
  createdAt: Date | string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

function wrapLine(text: string, maxChars = 78) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrappedText(page: any, text: string, x: number, y: number, font: any, size: number, color: ReturnType<typeof rgb>, maxChars = 78) {
  const lines = wrapLine(text || "—", maxChars);
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * (size + 4), font, size, color }));
  return y - lines.length * (size + 4);
}

function drawLabelValue(page: any, label: string, value: string, x: number, y: number, bold: any, regular: any) {
  page.drawText(label.toUpperCase(), { x, y, font: bold, size: 7.5, color: rgb(0.32, 0.38, 0.4) });
  drawWrappedText(page, value, x, y - 15, regular, 10, rgb(0.08, 0.12, 0.14), 33);
}

/**
 * Generate an enquiry-backed quote brief. It intentionally contains no fabricated rates,
 * commercial terms, or availability promises; Sales must validate those before issuing a formal quotation.
 */
export async function generateRentalQuotePdf(input: {
  enquiry: RentalQuoteBrief;
  generatedBy: string;
  onProgress?: (progress: number, label: string) => void;
}) {
  input.onProgress?.(15, "Creating the rental quote brief");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.enquiry.companyName} Rental Quote Brief`);
  pdf.setAuthor("BOB Cranes Operations Portal");
  pdf.setSubject("Rental quotation requirements for Sales review");

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  input.onProgress?.(38, "Applying BOB document branding");
  const logo = await embedBobFullLogo(pdf);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ink = rgb(0.08, 0.12, 0.14);
  const slate = rgb(0.32, 0.38, 0.4);
  const orange = rgb(0.86, 0.38, 0.15);

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 116, width: PAGE_WIDTH, height: 116, color: rgb(0.99, 0.97, 0.94) });
  const logoWidth = drawBobDocumentLogo({ page, logo, bold, x: MARGIN, y: PAGE_HEIGHT - 93 });
  const titleX = MARGIN + logoWidth + 18;
  page.drawText("RENTAL QUOTE BRIEF", { x: titleX, y: PAGE_HEIGHT - 57, font: bold, size: 13, color: ink });
  page.drawText("Sales validation required before commercial issue", { x: titleX, y: PAGE_HEIGHT - 75, font: regular, size: 7.5, color: orange });
  page.drawText(`Prepared ${new Date().toLocaleString("en-GB")}`, { x: PAGE_WIDTH - 176, y: PAGE_HEIGHT - 94, font: regular, size: 7.5, color: slate });

  let y = PAGE_HEIGHT - 152;
  page.drawText(input.enquiry.id, { x: MARGIN, y, font: bold, size: 18, color: ink });
  y = drawWrappedText(page, `${input.enquiry.companyName} · ${input.enquiry.projectLocation}`, MARGIN, y - 24, regular, 11, slate) - 18;

  page.drawRectangle({ x: MARGIN, y: y - 106, width: PAGE_WIDTH - MARGIN * 2, height: 106, color: rgb(1, 1, 1), borderColor: rgb(0.9, 0.86, 0.81), borderWidth: 0.8 });
  drawLabelValue(page, "Contact", input.enquiry.contactName, MARGIN + 14, y - 18, bold, regular);
  drawLabelValue(page, "Company", input.enquiry.companyName, MARGIN + 190, y - 18, bold, regular);
  drawLabelValue(page, "Equipment / duration", `${input.enquiry.equipmentInterest} · ${input.enquiry.rentalDuration ?? "To be confirmed"}`, MARGIN + 370, y - 18, bold, regular);
  drawLabelValue(page, "Email", input.enquiry.email, MARGIN + 14, y - 67, bold, regular);
  drawLabelValue(page, "Phone", input.enquiry.phone, MARGIN + 190, y - 67, bold, regular);
  drawLabelValue(page, "Received", new Date(input.enquiry.createdAt).toLocaleDateString("en-GB"), MARGIN + 370, y - 67, bold, regular);
  y -= 138;

  page.drawText("Project and lift requirements", { x: MARGIN, y, font: bold, size: 14, color: ink });
  y = drawWrappedText(page, input.enquiry.liftDetails, MARGIN, y - 23, regular, 10, slate, 82) - 16;
  page.drawRectangle({ x: MARGIN, y: y - 72, width: PAGE_WIDTH - MARGIN * 2, height: 72, color: rgb(1, 0.975, 0.94), borderColor: rgb(0.94, 0.78, 0.61), borderWidth: 0.8 });
  page.drawText("SALES REVIEW NOTE", { x: MARGIN + 14, y: y - 18, font: bold, size: 8, color: orange });
  drawWrappedText(page, "This enquiry summary is not a commercial quotation. Confirm crane selection, crew, lifting gear, availability, pricing, and commercial terms before sending a formal quote to the client.", MARGIN + 14, y - 35, regular, 9, ink, 83);

  page.drawText(`Prepared by ${input.generatedBy} · BOB Cranes rental quotation workflow`, { x: MARGIN, y: 42, font: regular, size: 7.5, color: slate });
  input.onProgress?.(82, "Finalizing quote brief download");
  const bytes = await pdf.save();
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${input.enquiry.id.replace(/[^a-zA-Z0-9-]+/g, "-")}-rental-quote-brief.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  input.onProgress?.(100, "Quote brief ready");
  return anchor.download;
}
