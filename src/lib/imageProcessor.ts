export class ImageProcessor {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    // 只在客戶端環境中建立 canvas
    if (typeof window !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d')!;
    }
  }

  // 預處理：調整圖片大小和標準化
  preprocess(image: HTMLImageElement, targetSize: number = 224): ImageData {
    if (!this.canvas || !this.ctx) {
      throw new Error('Canvas not initialized');
    }

    this.canvas.width = targetSize;
    this.canvas.height = targetSize;
    
    // 計算縮放比例以保持寬高比
    const scale = Math.min(targetSize / image.width, targetSize / image.height);
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;
    
    // 居中繪製圖片
    const x = (targetSize - scaledWidth) / 2;
    const y = (targetSize - scaledHeight) / 2;
    
    this.ctx.clearRect(0, 0, targetSize, targetSize);
    this.ctx.drawImage(image, x, y, scaledWidth, scaledHeight);
    
    return this.ctx.getImageData(0, 0, targetSize, targetSize);
  }

  // 後處理：將遮罩與原圖合併
  postprocess(originalImage: HTMLImageElement, mask: ImageData, tolerance: number = 0.5): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    
    // 繪製原圖
    ctx.drawImage(originalImage, 0, 0);
    
    // 獲取原圖的像素資料
    const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const originalPixels = originalData.data;
    
    // 調整遮罩大小以匹配原圖
    const resizedMask = this.resizeMask(mask, canvas.width, canvas.height);
    const maskPixels = resizedMask.data;
    
    // 合併原圖和遮罩
    for (let i = 0; i < originalPixels.length; i += 4) {
      const alpha = maskPixels[i] > tolerance * 255 ? 255 : 0;
      originalPixels[i + 3] = alpha; // 設定 alpha 通道
    }
    
    ctx.putImageData(originalData, 0, 0);
    return canvas;
  }

  // 調整遮罩大小
  private resizeMask(mask: ImageData, targetWidth: number, targetHeight: number): ImageData {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    
    tempCanvas.width = mask.width;
    tempCanvas.height = mask.height;
    tempCtx.putImageData(mask, 0, 0);
    
    const resizedCanvas = document.createElement('canvas');
    const resizedCtx = resizedCanvas.getContext('2d')!;
    resizedCanvas.width = targetWidth;
    resizedCanvas.height = targetHeight;
    
    resizedCtx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
    return resizedCtx.getImageData(0, 0, targetWidth, targetHeight);
  }

  // 魔術棒選擇功能
  magicWand(imageData: ImageData, x: number, y: number, tolerance: number = 32): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // 獲取目標像素的顏色
    const targetIndex = (y * width + x) * 4;
    const targetR = data[targetIndex];
    const targetG = data[targetIndex + 1];
    const targetB = data[targetIndex + 2];
    
    // 建立遮罩
    const mask = new Uint8ClampedArray(width * height);
    const visited = new Set<number>();
    const stack: [number, number][] = [[x, y]];
    
    while (stack.length > 0) {
      const [currentX, currentY] = stack.pop()!;
      const currentIndex = currentY * width + currentX;
      
      if (visited.has(currentIndex)) continue;
      visited.add(currentIndex);
      
      const pixelIndex = currentIndex * 4;
      const currentR = data[pixelIndex];
      const currentG = data[pixelIndex + 1];
      const currentB = data[pixelIndex + 2];
      
      // 計算顏色差異
      const diff = Math.sqrt(
        Math.pow(currentR - targetR, 2) +
        Math.pow(currentG - targetG, 2) +
        Math.pow(currentB - targetB, 2)
      );
      
      if (diff <= tolerance) {
        mask[currentIndex] = 255;
        
        // 檢查相鄰像素
        const neighbors = [
          [currentX + 1, currentY],
          [currentX - 1, currentY],
          [currentX, currentY + 1],
          [currentX, currentY - 1]
        ];
        
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const neighborIndex = ny * width + nx;
            if (!visited.has(neighborIndex)) {
              stack.push([nx, ny]);
            }
          }
        }
      }
    }
    
    // 建立結果 ImageData
    const result = new ImageData(width, height);
    for (let i = 0; i < mask.length; i++) {
      const pixelIndex = i * 4;
      result.data[pixelIndex] = mask[i];     // R
      result.data[pixelIndex + 1] = mask[i]; // G
      result.data[pixelIndex + 2] = mask[i]; // B
      result.data[pixelIndex + 3] = mask[i]; // A
    }
    
    return result;
  }

  // 顏色選擇功能（滴水工具）
  colorPicker(imageData: ImageData, targetColor: [number, number, number], tolerance: number = 32): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const [targetR, targetG, targetB] = targetColor;
    
    const result = new ImageData(width, height);
    
    for (let i = 0; i < data.length; i += 4) {
      const currentR = data[i];
      const currentG = data[i + 1];
      const currentB = data[i + 2];
      
      // 計算顏色差異
      const diff = Math.sqrt(
        Math.pow(currentR - targetR, 2) +
        Math.pow(currentG - targetG, 2) +
        Math.pow(currentB - targetB, 2)
      );
      
      const alpha = diff <= tolerance ? 255 : 0;
      result.data[i] = alpha;     // R
      result.data[i + 1] = alpha; // G
      result.data[i + 2] = alpha; // B
      result.data[i + 3] = alpha; // A
    }
    
    return result;
  }

  // 下載圖片
  downloadImage(canvas: HTMLCanvasElement, filename: string = 'removed-background.png'): void {
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  }
} 