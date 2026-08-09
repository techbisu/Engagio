"use client";

import * as React from "react";
import { format } from "date-fns";

import { generateQrCodeDataUrl } from "@/lib/cert";
import type { CertTemplate } from "@/types";

/** Canvas dimensions — landscape A4-ish ratio. */
export const CERT_WIDTH = 1200;
export const CERT_HEIGHT = 850;

export interface CertificateRendererProps {
  template: CertTemplate;
  recipientName: string;
  eventName: string;
  orgName?: string | null;
  signeeName?: string | null;
  signeeTitle?: string | null;
  signeeImage?: string | null; // base64 data URL
  logo?: string | null; // base64 data URL
  certificateNumber: string;
  issuedAt: string | Date;
  verificationUrl: string;
  onRendered?: (dataUrl: string) => void;
  /** Optional className applied to the <canvas> wrapper for sizing. */
  className?: string;
}

/** Format an ISO/date as e.g. "October 5, 2026". */
function fmtDate(d: Date): string {
  try {
    return format(d, "MMMM d, yyyy");
  } catch {
    return d.toDateString();
  }
}

/** Load an image (data URL or http URL) — resolves onload, rejects onerror. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/** Wrap text to fit a max-width; returns an array of lines. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Draw multiline centered text. */
function drawCenteredLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  cx: number,
  startY: number,
  lineHeight: number,
) {
  let y = startY;
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += lineHeight;
  }
}

// ============================================================================
// TEMPLATE: CLASSIC
// White bg, thick emerald double-border, serif typography.
// ============================================================================
function drawClassic(
  ctx: CanvasRenderingContext2D,
  p: CertificateRendererProps,
  images: { qr?: HTMLImageElement; logo?: HTMLImageElement; signee?: HTMLImageElement },
) {
  const W = CERT_WIDTH;
  const H = CERT_HEIGHT;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Outer thick emerald border
  ctx.strokeStyle = "#059669";
  ctx.lineWidth = 8;
  ctx.strokeRect(28, 28, W - 56, H - 56);

  // Inner thin border
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 46, W - 92, H - 92);

  // Org logo top-left
  if (images.logo) {
    const logoH = 90;
    const logoW = Math.min(220, images.logo.width * (logoH / images.logo.height));
    ctx.drawImage(images.logo, 80, 80, logoW, logoH);
  }

  // Header text — "CERTIFICATE OF COMPLETION" (serif, emerald, centered)
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#065f46";
  ctx.font = '700 56px Georgia, "Times New Roman", serif';
  ctx.fillText("CERTIFICATE OF COMPLETION", W / 2, 200);

  // Decorative divider under header
  ctx.strokeStyle = "#059669";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 220, 230);
  ctx.lineTo(W / 2 + 220, 230);
  ctx.stroke();

  // "This is to certify that"
  ctx.fillStyle = "#475569";
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText("This is to certify that", W / 2, 290);

  // Recipient name (large, serif)
  ctx.fillStyle = "#0f172a";
  ctx.font = '700 60px Georgia, "Times New Roman", serif';
  const nameLines = wrapText(ctx, p.recipientName, W - 360);
  drawCenteredLines(ctx, nameLines, W / 2, 380, 70);

  // Divider line under name
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 280, 470);
  ctx.lineTo(W / 2 + 280, 470);
  ctx.stroke();

  // "has successfully completed"
  ctx.fillStyle = "#475569";
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText("has successfully completed", W / 2, 520);

  // Event name
  ctx.fillStyle = "#065f46";
  ctx.font = '600 36px Georgia, serif';
  const evLines = wrapText(ctx, p.eventName, W - 360);
  drawCenteredLines(ctx, evLines, W / 2, 575, 44);

  // Issue date (centered, below event)
  ctx.fillStyle = "#475569";
  ctx.font = '20px Georgia, serif';
  ctx.fillText(
    `Issued on ${fmtDate(new Date(p.issuedAt))}`,
    W / 2,
    660,
  );

  // Signature area (bottom-left)
  const sigX = 160;
  const sigY = 740;
  if (images.signee) {
    const sw = 220;
    const sh = Math.min(80, images.signee.height * (sw / images.signee.width));
    ctx.drawImage(images.signee, sigX, sigY - sh, sw, sh);
  }
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sigX, sigY);
  ctx.lineTo(sigX + 220, sigY);
  ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.font = '600 20px Georgia, serif';
  ctx.textAlign = "left";
  ctx.fillText(p.signeeName || "Authorized Signatory", sigX, sigY + 28);
  ctx.fillStyle = "#64748b";
  ctx.font = '16px Georgia, serif';
  ctx.fillText(p.signeeTitle || "", sigX, sigY + 52);

  // Org name (bottom-center)
  if (p.orgName) {
    ctx.fillStyle = "#065f46";
    ctx.font = '600 18px Georgia, serif';
    ctx.textAlign = "center";
    ctx.fillText(p.orgName, W / 2, 720);
  }

  // QR code (bottom-right)
  if (images.qr) {
    const qrSize = 130;
    const qrX = W - 200;
    const qrY = H - 200;
    // Card behind QR
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
    ctx.drawImage(images.qr, qrX, qrY, qrSize, qrSize);
    // Caption
    ctx.fillStyle = "#64748b";
    ctx.font = '11px Georgia, serif';
    ctx.textAlign = "center";
    ctx.fillText("Scan to verify", qrX + qrSize / 2, qrY + qrSize + 22);
  }

  // Certificate number (bottom-center small)
  ctx.fillStyle = "#94a3b8";
  ctx.font = '14px Georgia, serif';
  ctx.textAlign = "center";
  ctx.fillText(`Certificate No: ${p.certificateNumber}`, W / 2, H - 55);
}

// ============================================================================
// TEMPLATE: MODERN
// White bg, emerald accent bar on left edge, sans-serif, minimal layout.
// ============================================================================
function drawModern(
  ctx: CanvasRenderingContext2D,
  p: CertificateRendererProps,
  images: { qr?: HTMLImageElement; logo?: HTMLImageElement; signee?: HTMLImageElement },
) {
  const W = CERT_WIDTH;
  const H = CERT_HEIGHT;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Emerald accent bar (left edge)
  ctx.fillStyle = "#10b981";
  ctx.fillRect(0, 0, 24, H);

  // Teal thin inner accent
  ctx.fillStyle = "#0d9488";
  ctx.fillRect(24, 0, 4, H);

  // Top-right corner accent (small geometric)
  ctx.fillStyle = "#ecfdf5";
  ctx.beginPath();
  ctx.moveTo(W, 0);
  ctx.lineTo(W, 180);
  ctx.lineTo(W - 180, 0);
  ctx.closePath();
  ctx.fill();

  // Logo top-left (offset from accent bar)
  if (images.logo) {
    const logoH = 70;
    const logoW = Math.min(180, images.logo.width * (logoH / images.logo.height));
    ctx.drawImage(images.logo, 80, 70, logoW, logoH);
  }

  // Header — "Certificate of Completion"
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0f172a";
  ctx.font = '600 42px "Segoe UI", system-ui, sans-serif';
  ctx.fillText("Certificate of Completion", 80, 200);

  // Small accent underline
  ctx.fillStyle = "#10b981";
  ctx.fillRect(80, 220, 80, 4);

  // "This is to certify that"
  ctx.fillStyle = "#64748b";
  ctx.font = '400 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText("This is to certify that", 80, 270);

  // Recipient name — large bold sans-serif
  ctx.fillStyle = "#0f172a";
  ctx.font = '700 64px "Segoe UI", system-ui, sans-serif';
  const nameLines = wrapText(ctx, p.recipientName, W - 460);
  drawLeftLines(ctx, nameLines, 80, 350, 72);

  // Divider under name
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 470);
  ctx.lineTo(280, 470);
  ctx.stroke();

  // "has successfully completed"
  ctx.fillStyle = "#64748b";
  ctx.font = '400 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText("has successfully completed", 80, 510);

  // Event name
  ctx.fillStyle = "#065f46";
  ctx.font = '600 32px "Segoe UI", system-ui, sans-serif';
  const evLines = wrapText(ctx, p.eventName, W - 460);
  drawLeftLines(ctx, evLines, 80, 560, 40);

  // Issue date
  ctx.fillStyle = "#475569";
  ctx.font = '400 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(
    `Issued on ${fmtDate(new Date(p.issuedAt))}`,
    80,
    660,
  );

  // Signature area (bottom-left)
  const sigX = 80;
  const sigY = 740;
  if (images.signee) {
    const sw = 200;
    const sh = Math.min(70, images.signee.height * (sw / images.signee.width));
    ctx.drawImage(images.signee, sigX, sigY - sh, sw, sh);
  }
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sigX, sigY);
  ctx.lineTo(sigX + 200, sigY);
  ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.font = '600 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(p.signeeName || "Authorized Signatory", sigX, sigY + 26);
  ctx.fillStyle = "#64748b";
  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(p.signeeTitle || "", sigX, sigY + 48);

  // QR bottom-right
  if (images.qr) {
    const qrSize = 140;
    const qrX = W - 200;
    const qrY = H - 220;
    ctx.drawImage(images.qr, qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = "#64748b";
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = "left";
    ctx.fillText("Scan to verify", qrX, qrY + qrSize + 20);
  }

  // Certificate number bottom-left
  ctx.fillStyle = "#94a3b8";
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(`Certificate No: ${p.certificateNumber}`, 80, H - 50);
}

function drawLeftLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number,
) {
  let y = startY;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
}

// ============================================================================
// TEMPLATE: ELEGANT
// Cream/ivory bg, gold accent border, formal serif typography, ornamental dividers.
// ============================================================================
function drawElegant(
  ctx: CanvasRenderingContext2D,
  p: CertificateRendererProps,
  images: { qr?: HTMLImageElement; logo?: HTMLImageElement; signee?: HTMLImageElement },
) {
  const W = CERT_WIDTH;
  const H = CERT_HEIGHT;

  // Cream background
  ctx.fillStyle = "#fdfbf7";
  ctx.fillRect(0, 0, W, H);

  // Gold ornamental border
  ctx.strokeStyle = "#b8860b";
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  // Inner thin gold border
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1;
  ctx.strokeRect(50, 50, W - 100, H - 100);

  // Ornamental corner flourishes (simple decorative corner squares)
  ctx.fillStyle = "#d4af37";
  const cornerSize = 8;
  [[36, 36], [W - 36 - cornerSize, 36], [36, H - 36 - cornerSize], [W - 36 - cornerSize, H - 36 - cornerSize]].forEach(
    ([x, y]) => {
      ctx.fillRect(x, y, cornerSize, cornerSize);
    },
  );

  // Logo top-center
  if (images.logo) {
    const logoH = 80;
    const logoW = Math.min(200, images.logo.width * (logoH / images.logo.height));
    ctx.drawImage(images.logo, (W - logoW) / 2, 90, logoW, logoH);
  }

  // Header — "CERTIFICATE OF ACHIEVEMENT" formal serif
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#92400e";
  ctx.font = '700 50px Georgia, "Times New Roman", serif';
  ctx.fillText("CERTIFICATE OF ACHIEVEMENT", W / 2, 240);

  // Ornamental divider — three centered lines with diamond
  drawOrnamentalDivider(ctx, W / 2, 270, 280, "#d4af37");

  // "This is to certify that"
  ctx.fillStyle = "#57534e";
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText("This is to certify that", W / 2, 320);

  // Recipient name — large formal serif
  ctx.fillStyle = "#1c1917";
  ctx.font = '700 60px Georgia, "Times New Roman", serif';
  const nameLines = wrapText(ctx, p.recipientName, W - 360);
  drawCenteredLines(ctx, nameLines, W / 2, 410, 70);

  // Ornamental divider after name
  drawOrnamentalDivider(ctx, W / 2, 510, 220, "#d4af37");

  // "has successfully completed"
  ctx.fillStyle = "#57534e";
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText("has successfully completed", W / 2, 555);

  // Event name
  ctx.fillStyle = "#92400e";
  ctx.font = '600 30px Georgia, serif';
  const evLines = wrapText(ctx, p.eventName, W - 360);
  drawCenteredLines(ctx, evLines, W / 2, 605, 38);

  // Issue date
  ctx.fillStyle = "#57534e";
  ctx.font = '18px Georgia, serif';
  ctx.fillText(
    `Issued on this ${formatDay(new Date(p.issuedAt))} day of ${fmtMonthYear(new Date(p.issuedAt))}`,
    W / 2,
    685,
  );

  // Signature area (bottom-left)
  const sigX = 180;
  const sigY = 760;
  if (images.signee) {
    const sw = 200;
    const sh = Math.min(70, images.signee.height * (sw / images.signee.width));
    ctx.drawImage(images.signee, sigX, sigY - sh, sw, sh);
  }
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sigX, sigY);
  ctx.lineTo(sigX + 200, sigY);
  ctx.stroke();
  ctx.fillStyle = "#1c1917";
  ctx.font = '600 18px Georgia, serif';
  ctx.textAlign = "left";
  ctx.fillText(p.signeeName || "Authorized Signatory", sigX, sigY + 26);
  ctx.fillStyle = "#78716c";
  ctx.font = '14px Georgia, serif';
  ctx.fillText(p.signeeTitle || "", sigX, sigY + 48);

  // Org name (bottom-right area)
  if (p.orgName) {
    ctx.fillStyle = "#92400e";
    ctx.font = '600 16px Georgia, serif';
    ctx.textAlign = "right";
    ctx.fillText(p.orgName, W - 350, sigY + 26);
    ctx.fillStyle = "#78716c";
    ctx.font = '12px Georgia, serif';
    ctx.fillText("Organization", W - 350, sigY + 48);
  }

  // QR (bottom-right, in small white card)
  if (images.qr) {
    const qrSize = 110;
    const qrX = W - 200;
    const qrY = H - 200;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 1;
    ctx.strokeRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
    ctx.drawImage(images.qr, qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = "#78716c";
    ctx.font = '10px Georgia, serif';
    ctx.textAlign = "center";
    ctx.fillText("Verify", qrX + qrSize / 2, qrY + qrSize + 22);
  }

  // Certificate number (small, centered bottom)
  ctx.fillStyle = "#a8a29e";
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = "center";
  ctx.fillText(`Certificate No: ${p.certificateNumber}`, W / 2, H - 60);
}

/** Draw an ornamental divider: line — diamond — line. */
function drawOrnamentalDivider(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  totalWidth: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  const halfLine = (totalWidth - 16) / 2;
  ctx.beginPath();
  ctx.moveTo(cx - totalWidth / 2, y);
  ctx.lineTo(cx - 8, y);
  ctx.moveTo(cx + 8, y);
  ctx.lineTo(cx + totalWidth / 2, y);
  ctx.stroke();
  // Diamond
  ctx.beginPath();
  ctx.moveTo(cx, y - 5);
  ctx.lineTo(cx + 5, y);
  ctx.lineTo(cx, y + 5);
  ctx.lineTo(cx - 5, y);
  ctx.closePath();
  ctx.fill();
}

function formatDay(d: Date): string {
  const day = d.getDate();
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function fmtMonthYear(d: Date): string {
  try {
    return format(d, "MMMM yyyy");
  } catch {
    return d.toLocaleDateString();
  }
}

// ============================================================================
// TEMPLATE: BOLD
// Dark slate bg, white text, large bold name, emerald accent, modern geometric.
// ============================================================================
function drawBold(
  ctx: CanvasRenderingContext2D,
  p: CertificateRendererProps,
  images: { qr?: HTMLImageElement; logo?: HTMLImageElement; signee?: HTMLImageElement },
) {
  const W = CERT_WIDTH;
  const H = CERT_HEIGHT;

  // Dark slate background
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, W, H);

  // Emerald accent stripe at top
  ctx.fillStyle = "#10b981";
  ctx.fillRect(0, 0, W, 12);

  // Emerald accent stripe at bottom
  ctx.fillStyle = "#10b981";
  ctx.fillRect(0, H - 12, W, 12);

  // Right-side emerald triangle accent
  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.moveTo(W, 12);
  ctx.lineTo(W, 250);
  ctx.lineTo(W - 250, 12);
  ctx.closePath();
  ctx.fill();

  // Left-side teal triangle accent
  ctx.fillStyle = "#0d9488";
  ctx.beginPath();
  ctx.moveTo(0, H - 12);
  ctx.lineTo(0, H - 250);
  ctx.lineTo(250, H - 12);
  ctx.closePath();
  ctx.fill();

  // Logo top-left
  if (images.logo) {
    const logoH = 70;
    const logoW = Math.min(180, images.logo.width * (logoH / images.logo.height));
    // White card behind logo for visibility on dark bg
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(70, 70, logoW + 24, logoH + 24);
    ctx.drawImage(images.logo, 82, 82, logoW, logoH);
  }

  // Header — "CERTIFICATE OF COMPLETION"
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#10b981";
  ctx.font = '800 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText("CERTIFICATE OF COMPLETION", 80, 220);

  // Accent line under header
  ctx.fillStyle = "#10b981";
  ctx.fillRect(80, 240, 60, 4);

  // "This is to certify that"
  ctx.fillStyle = "#cbd5e1";
  ctx.font = '400 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText("This is to certify that", 80, 290);

  // Recipient name — large bold white
  ctx.fillStyle = "#ffffff";
  ctx.font = '800 68px "Segoe UI", system-ui, sans-serif';
  const nameLines = wrapText(ctx, p.recipientName, W - 360);
  drawLeftLines(ctx, nameLines, 80, 370, 78);

  // "has successfully completed"
  ctx.fillStyle = "#cbd5e1";
  ctx.font = '400 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText("has successfully completed", 80, 530);

  // Event name — emerald accent
  ctx.fillStyle = "#34d399";
  ctx.font = '700 32px "Segoe UI", system-ui, sans-serif';
  const evLines = wrapText(ctx, p.eventName, W - 460);
  drawLeftLines(ctx, evLines, 80, 580, 40);

  // Issue date
  ctx.fillStyle = "#94a3b8";
  ctx.font = '400 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(
    `Issued on ${fmtDate(new Date(p.issuedAt))}`,
    80,
    670,
  );

  // Signature area (bottom-left)
  const sigX = 80;
  const sigY = 750;
  if (images.signee) {
    const sw = 200;
    const sh = Math.min(70, images.signee.height * (sw / images.signee.width));
    ctx.drawImage(images.signee, sigX, sigY - sh, sw, sh);
  }
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sigX, sigY);
  ctx.lineTo(sigX + 200, sigY);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = '600 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(p.signeeName || "Authorized Signatory", sigX, sigY + 26);
  ctx.fillStyle = "#94a3b8";
  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(p.signeeTitle || "", sigX, sigY + 48);

  // QR in white card (bottom-right)
  if (images.qr) {
    const cardW = 180;
    const cardH = 180;
    const cardX = W - 220;
    const cardY = H - 250;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cardX, cardY, cardW, cardH);
    const qrSize = 140;
    ctx.drawImage(images.qr, cardX + 20, cardY + 20, qrSize, qrSize);
    ctx.fillStyle = "#1e293b";
    ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("SCAN TO VERIFY", cardX + cardW / 2, cardY + cardH - 8);
  }

  // Certificate number
  ctx.fillStyle = "#64748b";
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(`Certificate No: ${p.certificateNumber}`, 80, H - 40);
}

// ============================================================================
// TEMPLATE: MINIMAL
// Pure white, lots of whitespace, tiny header, thin separators, monochrome.
// ============================================================================
function drawMinimal(
  ctx: CanvasRenderingContext2D,
  p: CertificateRendererProps,
  images: { qr?: HTMLImageElement; logo?: HTMLImageElement; signee?: HTMLImageElement },
) {
  const W = CERT_WIDTH;
  const H = CERT_HEIGHT;

  // Background — pure white
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Tiny header label (top-left)
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0f172a";
  ctx.font = '400 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText("CERTIFICATE", 90, 110);
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("OF COMPLETION", 90, 132);

  // Logo top-right
  if (images.logo) {
    const logoH = 60;
    const logoW = Math.min(160, images.logo.width * (logoH / images.logo.height));
    ctx.drawImage(images.logo, W - 90 - logoW, 90, logoW, logoH);
  }

  // Thin separator
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(90, 160);
  ctx.lineTo(W - 90, 160);
  ctx.stroke();

  // "This is to certify that"
  ctx.fillStyle = "#64748b";
  ctx.font = '300 18px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("This is to certify that", W / 2, 280);

  // Recipient name — large minimal
  ctx.fillStyle = "#0f172a";
  ctx.font = '300 72px "Segoe UI", system-ui, sans-serif';
  const nameLines = wrapText(ctx, p.recipientName, W - 200);
  drawCenteredLines(ctx, nameLines, W / 2, 380, 84);

  // Thin separator under name
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, 480);
  ctx.lineTo(W / 2 + 60, 480);
  ctx.stroke();

  // "has successfully completed"
  ctx.fillStyle = "#64748b";
  ctx.font = '300 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText("has successfully completed", W / 2, 540);

  // Event name
  ctx.fillStyle = "#0f172a";
  ctx.font = '400 28px "Segoe UI", system-ui, sans-serif';
  const evLines = wrapText(ctx, p.eventName, W - 200);
  drawCenteredLines(ctx, evLines, W / 2, 590, 36);

  // Issue date
  ctx.fillStyle = "#64748b";
  ctx.font = '300 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(
    `Issued on ${fmtDate(new Date(p.issuedAt))}`,
    W / 2,
    670,
  );

  // Signature area (bottom-left)
  const sigX = 90;
  const sigY = 740;
  if (images.signee) {
    const sw = 180;
    const sh = Math.min(60, images.signee.height * (sw / images.signee.width));
    ctx.drawImage(images.signee, sigX, sigY - sh, sw, sh);
  }
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sigX, sigY);
  ctx.lineTo(sigX + 180, sigY);
  ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.font = '500 16px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(p.signeeName || "Authorized Signatory", sigX, sigY + 24);
  ctx.fillStyle = "#94a3b8";
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(p.signeeTitle || "", sigX, sigY + 44);

  // QR (bottom-right, no card)
  if (images.qr) {
    const qrSize = 110;
    const qrX = W - 90 - qrSize;
    const qrY = H - 90 - qrSize;
    ctx.drawImage(images.qr, qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = "#94a3b8";
    ctx.font = '300 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = "right";
    ctx.fillText("Scan to verify", qrX + qrSize, qrY + qrSize + 20);
  }

  // Certificate number — small, centered, bottom
  ctx.fillStyle = "#cbd5e1";
  ctx.font = '300 11px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(`NO. ${p.certificateNumber}`, W / 2, H - 60);
}

// ============================================================================
// Main component
// ============================================================================
export const CertificateRenderer = React.forwardRef<
  HTMLCanvasElement | null,
  CertificateRendererProps
>(function CertificateRenderer(props, ref) {
  const {
    template,
    recipientName,
    eventName,
    orgName,
    signeeName,
    signeeTitle,
    signeeImage,
    logo,
    certificateNumber,
    issuedAt,
    verificationUrl,
    onRendered,
    className,
  } = props;

  // Internal canvas ref so we can render even when no external ref is passed.
  const internalRef = React.useRef<HTMLCanvasElement | null>(null);
  const setCanvas = React.useCallback(
    (node: HTMLCanvasElement | null) => {
      internalRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref)
        (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = node;
    },
    [ref],
  );

  // Keep the latest props in a ref so the render effect doesn't depend on each prop.
  const propsRef = React.useRef(props);
  React.useEffect(() => {
    propsRef.current = props;
  });

  // Render the certificate to the canvas whenever inputs change.
  React.useEffect(() => {
    const canvas = internalRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;

    async function render() {
      // Generate QR data URL
      let qrDataUrl: string | undefined;
      try {
        qrDataUrl = await generateQrCodeDataUrl(verificationUrl);
      } catch {
        qrDataUrl = undefined;
      }

      // Load all images in parallel
      const imagePromises: Promise<{ kind: "qr" | "logo" | "signee"; img: HTMLImageElement }>[] = [];
      if (qrDataUrl) imagePromises.push(loadImage(qrDataUrl).then((img) => ({ kind: "qr" as const, img })));
      if (logo) imagePromises.push(loadImage(logo).then((img) => ({ kind: "logo" as const, img })));
      if (signeeImage) imagePromises.push(loadImage(signeeImage).then((img) => ({ kind: "signee" as const, img })));

      const settled = await Promise.allSettled(imagePromises);
      if (cancelled) return;

      const images: {
        qr?: HTMLImageElement;
        logo?: HTMLImageElement;
        signee?: HTMLImageElement;
      } = {};
      for (const r of settled) {
        if (r.status === "fulfilled") {
          images[r.value.kind] = r.value.img;
        }
      }

      // Clear + draw
      ctx.clearRect(0, 0, CERT_WIDTH, CERT_HEIGHT);
      const drawProps = propsRef.current;
      switch (template) {
        case "classic":
          drawClassic(ctx, drawProps, images);
          break;
        case "modern":
          drawModern(ctx, drawProps, images);
          break;
        case "elegant":
          drawElegant(ctx, drawProps, images);
          break;
        case "bold":
          drawBold(ctx, drawProps, images);
          break;
        case "minimal":
          drawMinimal(ctx, drawProps, images);
          break;
        default:
          drawModern(ctx, drawProps, images);
      }

      // Notify parent with the PNG data URL
      try {
        const dataUrl = canvas.toDataURL("image/png");
        onRendered?.(dataUrl);
      } catch {
        // ignore — e.g. tainted canvas (shouldn't happen with data URLs)
      }
    }

    render();

    return () => {
      cancelled = true;
    };
    // We intentionally watch every prop that affects the render. propsRef is
    // updated on every render, so we don't need them as deps — but template /
    // urls / names changing must re-render. Use a stable signature.
  }, [
    template,
    recipientName,
    eventName,
    orgName,
    signeeName,
    signeeTitle,
    signeeImage,
    logo,
    certificateNumber,
    issuedAt,
    verificationUrl,
    onRendered,
  ]);

  return (
    <canvas
      ref={setCanvas}
      width={CERT_WIDTH}
      height={CERT_HEIGHT}
      role="img"
      aria-label={`Certificate for ${recipientName}: ${eventName}`}
      className={className ?? "h-auto w-full"}
      style={{ maxWidth: "100%", height: "auto", display: "block" }}
    />
  );
});

/**
 * Trigger a browser download of the certificate PNG.
 * `dataUrl` should be a base64 PNG from canvas.toDataURL.
 */
export function downloadCertificatePng(
  dataUrl: string,
  certificateNumber: string,
): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `certificate-${certificateNumber}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
