/**
 * Copies text to the clipboard. Uses the modern Clipboard API when available
 * (requires HTTPS / secure context), and falls back to the legacy
 * document.execCommand approach for HTTP or older browsers.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for non-secure contexts (HTTP) or browsers without Clipboard API
  const textarea = document.createElement("textarea");
  textarea.value = text;
  // Prevent scrolling to the bottom of the page
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const success = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!success) {
    throw new Error("Clipboard API er ikke tilgængelig");
  }
}
