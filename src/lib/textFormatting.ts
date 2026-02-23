/**
 * Text Formatting Utilities
 * Converts plain text to formatted HTML for display
 */

/**
 * Convert plain text to HTML paragraphs
 * - Double line breaks become paragraph breaks
 * - Single line breaks become <br>
 * - Text wrapped in *asterisks* becomes bold
 */
export function formatTextToHtml(text: string | null | undefined): string {
  if (!text) return '';

  // If already contains HTML tags, return as-is
  if (/<[^>]+>/.test(text)) {
    return text;
  }

  // Convert **text** or *text* to <strong>
  let formatted = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.+?)\*/g, '<strong>$1</strong>');

  // Split by double newlines for paragraphs
  const paragraphs = formatted.split(/\n\s*\n/);

  // Wrap each paragraph in <p> tags, convert single newlines to <br>
  const htmlParagraphs = paragraphs.map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    // Convert single newlines to <br>
    const withBreaks = trimmed.replace(/\n/g, '<br>');
    return `<p class="mb-4">${withBreaks}</p>`;
  }).filter(Boolean);

  return htmlParagraphs.join('\n');
}

/**
 * Convert plain text to simple HTML (just line breaks, no paragraphs)
 * Good for shorter text like subtitles
 */
export function formatLineBreaks(text: string | null | undefined): string {
  if (!text) return '';

  // If already contains HTML tags, return as-is
  if (/<[^>]+>/.test(text)) {
    return text;
  }

  return text.replace(/\n/g, '<br>');
}
