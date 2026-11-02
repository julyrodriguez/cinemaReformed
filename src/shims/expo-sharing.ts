import { getMemoryFile, EncodingType } from './expo-file-system';

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export async function shareAsync(
  url: string,
  options?: { mimeType?: string; dialogTitle?: string; UTI?: string }
): Promise<void> {
  const fileName = url.split('/').pop() || 'archivo_descargado';
  const mem = getMemoryFile(url);

  let href = url;
  if (mem) {
    if (mem.encoding === 'blob-url') {
      href = mem.content;
    } else if (mem.encoding === EncodingType.Base64) {
      const byteCharacters = atob(mem.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: options?.mimeType || 'application/octet-stream',
      });
      href = URL.createObjectURL(blob);
    } else {
      const blob = new Blob([mem.content], {
        type: options?.mimeType || 'text/html;charset=utf-8',
      });
      href = URL.createObjectURL(blob);
    }
  }

  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default {
  isAvailableAsync,
  shareAsync,
};
