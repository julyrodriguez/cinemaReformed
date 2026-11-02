export interface DocumentPickerAsset {
  name: string;
  size?: number;
  uri: string;
  mimeType?: string;
  lastModified?: number;
  file?: File;
}

export interface DocumentPickerResult {
  canceled: boolean;
  assets: DocumentPickerAsset[] | null;
}

export interface DocumentPickerOptions {
  type?: string | string[];
  copyToCacheDirectory?: boolean;
  multiple?: boolean;
}

export async function getDocumentAsync(
  options: DocumentPickerOptions = {}
): Promise<DocumentPickerResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options.multiple) {
      input.multiple = true;
    }
    if (options.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      input.accept = types.join(',');
    }

    let resolved = false;
    const finish = (res: DocumentPickerResult) => {
      if (resolved) return;
      resolved = true;
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
      resolve(res);
    };

    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) {
        finish({ canceled: true, assets: null });
        return;
      }

      const assets: DocumentPickerAsset[] = files.map((file) => ({
        name: file.name,
        size: file.size,
        uri: URL.createObjectURL(file),
        mimeType: file.type || 'application/octet-stream',
        lastModified: file.lastModified,
        file,
      }));

      finish({ canceled: false, assets });
    });

    input.addEventListener('cancel', () => {
      finish({ canceled: true, assets: null });
    });

    input.click();
  });
}

export default {
  getDocumentAsync,
};
