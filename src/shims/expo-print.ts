export async function printAsync(options: { html?: string; uri?: string }): Promise<void> {
  if (!options.html && options.uri) {
    window.open(options.uri, '_blank');
    return;
  }

  const html = options.html || '';
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }

  await new Promise((r) => setTimeout(r, 350));
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  setTimeout(() => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }, 3000);
}

export async function printToFileAsync(options: { html?: string }): Promise<{ uri: string }> {
  await printAsync(options);
  const blob = new Blob([options.html || ''], { type: 'text/html;charset=utf-8' });
  const uri = URL.createObjectURL(blob);
  return { uri };
}

export default {
  printAsync,
  printToFileAsync,
};
