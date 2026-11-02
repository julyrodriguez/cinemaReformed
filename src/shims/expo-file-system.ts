export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
} as const;

export const documentDirectory = 'memory://documents/';
export const cacheDirectory = 'memory://cache/';

const memoryFiles = new Map<string, { content: string; encoding: string }>();

export async function readAsStringAsync(
  fileUri: string,
  options?: { encoding?: string }
): Promise<string> {
  if (memoryFiles.has(fileUri)) {
    return memoryFiles.get(fileUri)!.content;
  }
  const res = await fetch(fileUri);
  if (options?.encoding === EncodingType.Base64) {
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  return await res.text();
}

export async function writeAsStringAsync(
  fileUri: string,
  contents: string,
  options?: { encoding?: string }
): Promise<void> {
  memoryFiles.set(fileUri, {
    content: contents,
    encoding: options?.encoding || EncodingType.UTF8,
  });
}

export async function downloadAsync(
  uri: string,
  fileUri: string
): Promise<{ uri: string; status: number }> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  memoryFiles.set(fileUri, { content: objectUrl, encoding: 'blob-url' });
  return { uri: fileUri, status: res.status };
}

export function getMemoryFile(fileUri: string) {
  return memoryFiles.get(fileUri);
}

export default {
  EncodingType,
  documentDirectory,
  cacheDirectory,
  readAsStringAsync,
  writeAsStringAsync,
  downloadAsync,
};
