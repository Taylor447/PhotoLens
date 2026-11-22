import { analyzePixels } from '../core/metrics.js';

self.onmessage = (event) => {
  const { bitmap, fileSize, id } = event.data;
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const metrics = analyzePixels({ data: imageData.data, width: bitmap.width, height: bitmap.height, fileSize });
    bitmap.close();
    self.postMessage({ id, metrics });
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Không đọc được dữ liệu ảnh.' });
  }
};
