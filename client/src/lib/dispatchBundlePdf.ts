import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DocumentItem } from "@shared/bookingRules";

type DispatchBundleBooking = {
  id: string;
  client: string;
  project: string;
  crane: string;
  site: string;
  mob: string;
  offHire: string;
  pm: string;
  priority: string;
};

type DispatchBundleCrew = { name: string; role: string; cert?: string };

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

function wrapLine(text: string, maxChars = 76) {
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

function drawWrappedText(
  page: any,
  text: string,
  x: number,
  y: number,
  font: any,
  size: number,
  color: ReturnType<typeof rgb>,
  maxChars = 76
) {
  const lines = wrapLine(text, maxChars);
  lines.forEach((line, index) =>
    page.drawText(line, { x, y: y - index * (size + 4), font, size, color })
  );
  return y - lines.length * (size + 4);
}

function drawLabelValue(
  page: any,
  label: string,
  value: string,
  x: number,
  y: number,
  labelFont: any,
  bodyFont: any
) {
  page.drawText(label.toUpperCase(), {
    x,
    y,
    font: labelFont,
    size: 7.5,
    color: rgb(0.32, 0.38, 0.4),
  });
  drawWrappedText(
    page,
    value || "—",
    x,
    y - 15,
    bodyFont,
    10,
    rgb(0.08, 0.12, 0.14),
    33
  );
}

export async function generateDispatchBundlePdf(input: {
  booking: DispatchBundleBooking;
  documents: DocumentItem[];
  crew: DispatchBundleCrew[];
  generatedBy: string;
  onProgress?: (progress: number, label: string) => void;
}) {
  input.onProgress?.(12, "Creating the controlled document");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.booking.id} Dispatch Bundle`);
  pdf.setAuthor("BOB Cranes Operations Portal");
  pdf.setSubject("Final dispatch dossier");

  input.onProgress?.(30, "Embedding document fonts");
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const mint = rgb(0.08, 0.55, 0.44);
  const ink = rgb(0.08, 0.12, 0.14);
  const slate = rgb(0.32, 0.38, 0.4);

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 116,
    width: PAGE_WIDTH,
    height: 116,
    color: rgb(0.94, 0.98, 0.97),
  });
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - 75,
    width: 30,
    height: 30,
    color: mint,
  });
  page.drawText("B", {
    x: MARGIN + 10,
    y: PAGE_HEIGHT - 65,
    font: bold,
    size: 15,
    color: rgb(1, 1, 1),
  });
  page.drawText("BOB CRANES", {
    x: MARGIN + 42,
    y: PAGE_HEIGHT - 57,
    font: bold,
    size: 15,
    color: ink,
  });
  page.drawText("FINAL DISPATCH BUNDLE", {
    x: MARGIN + 42,
    y: PAGE_HEIGHT - 75,
    font: bold,
    size: 8,
    color: mint,
  });
  page.drawText("Controlled operational document", {
    x: PAGE_WIDTH - 190,
    y: PAGE_HEIGHT - 57,
    font: regular,
    size: 8,
    color: slate,
  });
  page.drawText(`Generated ${new Date().toLocaleString("en-GB")}`, {
    x: PAGE_WIDTH - 190,
    y: PAGE_HEIGHT - 75,
    font: regular,
    size: 8,
    color: slate,
  });

  let y = PAGE_HEIGHT - 152;
  page.drawText(input.booking.id, {
    x: MARGIN,
    y,
    font: bold,
    size: 22,
    color: ink,
  });
  y =
    drawWrappedText(
      page,
      `${input.booking.client} · ${input.booking.project}`,
      MARGIN,
      y - 25,
      regular,
      11,
      slate,
      78
    ) - 18;

  page.drawRectangle({
    x: MARGIN,
    y: y - 104,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 104,
    color: rgb(0.985, 0.99, 0.99),
    borderColor: rgb(0.85, 0.9, 0.89),
    borderWidth: 0.8,
  });
  drawLabelValue(
    page,
    "Crane",
    input.booking.crane,
    MARGIN + 14,
    y - 18,
    bold,
    regular
  );
  drawLabelValue(
    page,
    "Site",
    input.booking.site,
    MARGIN + 190,
    y - 18,
    bold,
    regular
  );
  drawLabelValue(
    page,
    "Priority",
    input.booking.priority,
    MARGIN + 370,
    y - 18,
    bold,
    regular
  );
  drawLabelValue(
    page,
    "Mobilization",
    input.booking.mob,
    MARGIN + 14,
    y - 67,
    bold,
    regular
  );
  drawLabelValue(
    page,
    "Off-hire",
    input.booking.offHire,
    MARGIN + 190,
    y - 67,
    bold,
    regular
  );
  drawLabelValue(
    page,
    "Project manager",
    input.booking.pm,
    MARGIN + 370,
    y - 67,
    bold,
    regular
  );
  y -= 136;

  page.drawText("Approved document register", {
    x: MARGIN,
    y,
    font: bold,
    size: 14,
    color: ink,
  });
  page.drawText("Included in the controlled dispatch package", {
    x: MARGIN,
    y: y - 15,
    font: regular,
    size: 8.5,
    color: slate,
  });
  y -= 35;
  const includedDocuments = input.documents.filter(
    document => document.required
  );
  includedDocuments.forEach((document, index) => {
    const rowY = y - index * 28;
    page.drawRectangle({
      x: MARGIN,
      y: rowY - 6,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 22,
      color: index % 2 ? rgb(0.98, 0.99, 0.99) : rgb(1, 1, 1),
    });
    page.drawCircle({
      x: MARGIN + 10,
      y: rowY + 5,
      size: 4,
      color: ["Uploaded", "Approved"].includes(document.state)
        ? mint
        : rgb(0.86, 0.38, 0.15),
    });
    page.drawText(document.name, {
      x: MARGIN + 22,
      y: rowY + 1,
      font: regular,
      size: 9,
      color: ink,
    });
    page.drawText(`${document.departmentCode} · ${document.state}`, {
      x: PAGE_WIDTH - MARGIN - 112,
      y: rowY + 1,
      font: regular,
      size: 8,
      color: slate,
    });
  });
  y -= Math.max(includedDocuments.length * 28, 28) + 18;

  if (y < 190) {
    const continuation = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - 70;
    continuation.drawText("BOB CRANES · DISPATCH BUNDLE", {
      x: MARGIN,
      y,
      font: bold,
      size: 10,
      color: mint,
    });
    y -= 34;
    continuation.drawText("Crew manifest", {
      x: MARGIN,
      y,
      font: bold,
      size: 14,
      color: ink,
    });
    drawCrewManifest(
      continuation,
      input.crew,
      y - 26,
      bold,
      regular,
      ink,
      slate,
      mint
    );
  } else {
    page.drawText("Crew manifest", {
      x: MARGIN,
      y,
      font: bold,
      size: 14,
      color: ink,
    });
    drawCrewManifest(page, input.crew, y - 26, bold, regular, ink, slate, mint);
  }

  input.onProgress?.(68, "Compiling documents and crew manifest");
  const finalPage = pdf.getPages().at(-1)!;
  finalPage.drawText(
    `Generated by ${input.generatedBy} · Internal distribution controlled by BOB Cranes`,
    { x: MARGIN, y: 42, font: regular, size: 7.5, color: slate }
  );
  input.onProgress?.(84, "Finalizing secure PDF download");
  const bytes = await pdf.save();
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${input.booking.id.replace(/[^a-zA-Z0-9-]+/g, "-")}-dispatch-bundle.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  input.onProgress?.(100, "Dispatch bundle ready");
  return anchor.download;
}

function drawCrewManifest(
  page: any,
  crew: DispatchBundleCrew[],
  y: number,
  bold: any,
  regular: any,
  ink: ReturnType<typeof rgb>,
  slate: ReturnType<typeof rgb>,
  mint: ReturnType<typeof rgb>
) {
  page.drawRectangle({
    x: MARGIN,
    y: y - 2,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 22,
    color: rgb(0.94, 0.98, 0.97),
  });
  page.drawText("CREW MEMBER", {
    x: MARGIN + 12,
    y: y + 6,
    font: bold,
    size: 7.5,
    color: slate,
  });
  page.drawText("DESIGNATION", {
    x: MARGIN + 250,
    y: y + 6,
    font: bold,
    size: 7.5,
    color: slate,
  });
  page.drawText("COMPLIANCE", {
    x: MARGIN + 410,
    y: y + 6,
    font: bold,
    size: 7.5,
    color: slate,
  });
  crew.forEach((member, index) => {
    const rowY = y - 26 - index * 24;
    page.drawText(member.name, {
      x: MARGIN + 12,
      y: rowY + 5,
      font: regular,
      size: 9,
      color: ink,
    });
    page.drawText(member.role, {
      x: MARGIN + 250,
      y: rowY + 5,
      font: regular,
      size: 9,
      color: ink,
    });
    page.drawText(member.cert ?? "Included", {
      x: MARGIN + 410,
      y: rowY + 5,
      font: regular,
      size: 8,
      color: mint,
    });
  });
}
