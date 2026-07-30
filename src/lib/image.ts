export async function fileToSquareDataUrl(
  file: File,
  size = 200,
  quality = 0.85,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 올릴 수 있어요.');
  }

  const bitmap = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없어요.');

  // 짧은 변 기준으로 정사각 크롭 (센터 크롭)
  const src = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - src) / 2;
  const sy = (bitmap.height - src) / 2;

  ctx.drawImage(bitmap, sx, sy, src, src, 0, 0, size, size);

  return canvas.toDataURL('image/jpeg', quality);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 불러오지 못했어요.'));
    };
    img.src = url;
  });
}
