import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";

/** PDF-lib supports PNG/JPEG rather than WebP, so use the lossless derivative of the approved full BOB lockup. */
export const BOB_FULL_LOGO_DOCUMENT_ASSET = "/manus-storage/bob-lifting-your-expectations-document_0520f663.png";

export async function embedBobFullLogo(pdf: { embedPng: (image: ArrayBuffer) => Promise<PDFImage> }) {
  if (typeof fetch !== "function") return null;
  try {
    const response = await fetch(BOB_FULL_LOGO_DOCUMENT_ASSET);
    if (!response.ok) return null;
    return await pdf.embedPng(await response.arrayBuffer());
  } catch {
    // Keep controlled documents downloadable if the brand asset is temporarily unavailable.
    return null;
  }
}

export function drawBobDocumentLogo({
  page,
  logo,
  bold,
  x,
  y,
  maxWidth = 164,
  maxHeight = 74,
}: {
  page: PDFPage;
  logo: PDFImage | null;
  bold: PDFFont;
  x: number;
  y: number;
  maxWidth?: number;
  maxHeight?: number;
}) {
  if (logo) {
    const dimensions = logo.scaleToFit(maxWidth, maxHeight);
    page.drawImage(logo, { x, y, width: dimensions.width, height: dimensions.height });
    return dimensions.width;
  }

  page.drawText("BOB CRANES", { x, y: y + 28, font: bold, size: 14, color: rgb(0.08, 0.12, 0.14) });
  page.drawText("LIFTING YOUR EXPECTATIONS", { x, y: y + 13, font: bold, size: 6.5, color: rgb(0.86, 0.38, 0.15) });
  return 144;
}
