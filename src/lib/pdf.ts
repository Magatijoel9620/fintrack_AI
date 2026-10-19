// Tiny dependency-free PDF writer for invoice/receipt downloads.
function esc(s: string) { return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
export function downloadSimplePdf(filename: string, lines: string[], title = "Document") {
  const safe = lines.map(x => x.length > 100 ? x.slice(0, 97) + "..." : x);
  const cmds = ["BT", "/F1 10 Tf", "40 800 Td"];
  safe.forEach((line, i) => { if (i) cmds.push("0 -14 Td"); cmds.push(`(${esc(line)}) Tj`); }); cmds.push("ET");
  const stream = cmds.join("\n");
  const objs = [
    `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`,
    `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`,
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`,
    `4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  let pdf = `%PDF-1.4\n`; const offsets: number[] = [0];
  for (const obj of objs) { offsets.push(pdf.length); pdf += obj + "\n"; }
  const xref = pdf.length; pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R /Title (${esc(title)}) >>\nstartxref\n${xref}\n%%EOF`;
  const blob = new Blob([pdf], { type: "application/pdf" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
