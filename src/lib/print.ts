function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function printElement(element: HTMLElement | null, title: string): boolean {
  if (!element) return false;
  const popup = window.open("", "_blank", "width=900,height=900");
  if (!popup) return false;

  const printable = element.cloneNode(true) as HTMLElement;
  printable.querySelectorAll("[data-print-exclude]").forEach((node) => node.remove());
  printable.removeAttribute("id");

  popup.document.open();
  popup.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; color: #111827; background: #fff; font: 14px/1.5 Arial, sans-serif; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 9px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  th:last-child, td:last-child { text-align: right; }
  .totals { width: min(100%, 340px); margin-left: auto; }
  img { max-width: 100%; object-fit: contain; }
  [data-print-exclude] { display: none !important; }
  @media print { body { padding: 0; } }
</style></head><body>${printable.outerHTML}</body></html>`);
  popup.document.close();
  const runPrint = () => { popup.focus(); popup.print(); };
  if (popup.document.readyState === "complete") runPrint();
  else popup.addEventListener("load", runPrint, { once: true });
  return true;
}
