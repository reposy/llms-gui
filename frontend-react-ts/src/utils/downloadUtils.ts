/**
 * Triggers a browser download for the given content.
 *
 * @param content The string content to download.
 * @param filename The desired name for the downloaded file.
 * @param mimeType The MIME type of the content (e.g., 'text/plain', 'application/json').
 */
export const downloadFile = (content: string, filename: string, mimeType: string) => {
  // Create a Blob from the content
  const blob = new Blob([content], { type: mimeType });

  // Create an object URL for the Blob
  const url = URL.createObjectURL(blob);

  // Create a temporary anchor element
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;

  // Programmatically click the anchor to trigger the download
  document.body.appendChild(a);
  a.click();

  // Clean up by removing the anchor and revoking the object URL
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}; 