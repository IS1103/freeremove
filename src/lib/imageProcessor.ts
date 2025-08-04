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

  // 後處理：將遮罩與原圖合併 - 修正邏輯：選取的部分刪除（變透明），未選取的部分保留
  postprocess(originalImage: HTMLImageElement, mask: ImageData, tolerance: number = 0.5, blurRadius: number = 0): HTMLCanvasElement {
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
    
    // 合併原圖和遮罩 - 修正邏輯：選取的部分刪除（變透明），未選取的部分保留
    for (let i = 0; i < originalPixels.length; i += 4) {
      // 如果遮罩像素值大於閾值，表示該像素被選取（要刪除）
      const isSelected = maskPixels[i] > tolerance * 255;
      // 選取的部分變透明，未選取的部分保持原來的 alpha 值
      originalPixels[i + 3] = isSelected ? 0 : originalPixels[i + 3];
    }
    
    ctx.putImageData(originalData, 0, 0);
    
    // 應用模糊效果
    if (blurRadius > 0) {
      this.applyBlur(canvas, blurRadius);
    }
    
    return canvas;
  }

  // 應用模糊效果
  private applyBlur(canvas: HTMLCanvasElement, radius: number): void {
    const ctx = canvas.getContext('2d')!;
    const width = canvas.width;
    const height = canvas.height;
    
    // 獲取像素資料
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // 建立高斯模糊核心
    const kernel = this.createGaussianKernel(radius);
    const kernelSize = kernel.length;
    const halfKernel = Math.floor(kernelSize / 2);
    
    // 水平模糊
    const tempData = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let weightSum = 0;
        
        for (let i = 0; i < kernelSize; i++) {
          const sampleX = Math.max(0, Math.min(width - 1, x + i - halfKernel));
          const pixelIndex = (y * width + sampleX) * 4;
          const weight = kernel[i];
          
          r += tempData[pixelIndex] * weight;
          g += tempData[pixelIndex + 1] * weight;
          b += tempData[pixelIndex + 2] * weight;
          a += tempData[pixelIndex + 3] * weight;
          weightSum += weight;
        }
        
        const resultIndex = (y * width + x) * 4;
        data[resultIndex] = r / weightSum;
        data[resultIndex + 1] = g / weightSum;
        data[resultIndex + 2] = b / weightSum;
        data[resultIndex + 3] = a / weightSum;
      }
    }
    
    // 垂直模糊
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let weightSum = 0;
        
        for (let i = 0; i < kernelSize; i++) {
          const sampleY = Math.max(0, Math.min(height - 1, y + i - halfKernel));
          const pixelIndex = (sampleY * width + x) * 4;
          const weight = kernel[i];
          
          r += data[pixelIndex] * weight;
          g += data[pixelIndex + 1] * weight;
          b += data[pixelIndex + 2] * weight;
          a += data[pixelIndex + 3] * weight;
          weightSum += weight;
        }
        
        const resultIndex = (y * width + x) * 4;
        data[resultIndex] = r / weightSum;
        data[resultIndex + 1] = g / weightSum;
        data[resultIndex + 2] = b / weightSum;
        data[resultIndex + 3] = a / weightSum;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  // 建立高斯模糊核心
  private createGaussianKernel(radius: number): number[] {
    const size = Math.ceil(radius * 2 + 1);
    const kernel = new Array(size);
    const sigma = radius / 3;
    let sum = 0;
    
    for (let i = 0; i < size; i++) {
      const x = i - Math.floor(size / 2);
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      sum += kernel[i];
    }
    
    // 正規化核心
    for (let i = 0; i < size; i++) {
      kernel[i] /= sum;
    }
    
    return kernel;
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

  // 魔術棒選擇功能 - 選取要刪除的部分，並添加模糊邊緣
  magicWand(imageData: ImageData, x: number, y: number, tolerance: number = 32): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // 獲取目標像素的顏色
    const targetIndex = (y * width + x) * 4;
    const targetR = data[targetIndex];
    const targetG = data[targetIndex + 1];
    const targetB = data[targetIndex + 2];
    
    // 建立遮罩 - 255 表示選取（要刪除），0 表示未選取（要保留）
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
        mask[currentIndex] = 255; // 選取這個像素（要刪除）
        
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
    
    // 應用邊緣模糊效果
    const blurredMask = this.applyMaskBlur(mask, width, height, 2);
    
    // 建立結果 ImageData
    const result = new ImageData(width, height);
    for (let i = 0; i < blurredMask.length; i++) {
      const pixelIndex = i * 4;
      result.data[pixelIndex] = blurredMask[i];     // R
      result.data[pixelIndex + 1] = blurredMask[i]; // G
      result.data[pixelIndex + 2] = blurredMask[i]; // B
      result.data[pixelIndex + 3] = blurredMask[i]; // A
    }
    
    return result;
  }

  // 顏色選擇功能（滴水工具）- 選取要刪除的部分，並添加模糊邊緣
  colorPicker(imageData: ImageData, targetColor: [number, number, number], tolerance: number = 32): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const [targetR, targetG, targetB] = targetColor;
    
    // 建立初始遮罩
    const mask = new Uint8ClampedArray(width * height);
    
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
      
      // 如果顏色相似，則選取（要刪除），否則不選取（要保留）
      const pixelIndex = Math.floor(i / 4);
      mask[pixelIndex] = diff <= tolerance ? 255 : 0;
    }
    
    // 應用邊緣模糊效果
    const blurredMask = this.applyMaskBlur(mask, width, height, 2);
    
    // 建立結果 ImageData
    const result = new ImageData(width, height);
    for (let i = 0; i < blurredMask.length; i++) {
      const pixelIndex = i * 4;
      result.data[pixelIndex] = blurredMask[i];     // R
      result.data[pixelIndex + 1] = blurredMask[i]; // G
      result.data[pixelIndex + 2] = blurredMask[i]; // B
      result.data[pixelIndex + 3] = blurredMask[i]; // A
    }
    
    return result;
  }

  // 對遮罩應用模糊效果，產生柔和的邊緣
  private applyMaskBlur(mask: Uint8ClampedArray, width: number, height: number, blurRadius: number = 2): Uint8ClampedArray {
    const blurredMask = new Uint8ClampedArray(mask.length);
    
    // 建立高斯模糊核心
    const kernel = this.createGaussianKernel(blurRadius);
    const kernelSize = kernel.length;
    const halfKernel = Math.floor(kernelSize / 2);
    
    // 水平模糊
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let i = 0; i < kernelSize; i++) {
          const sampleX = Math.max(0, Math.min(width - 1, x + i - halfKernel));
          const sampleIndex = y * width + sampleX;
          const weight = kernel[i];
          
          sum += mask[sampleIndex] * weight;
          weightSum += weight;
        }
        
        const resultIndex = y * width + x;
        blurredMask[resultIndex] = sum / weightSum;
      }
    }
    
    // 垂直模糊
    const tempMask = new Uint8ClampedArray(blurredMask);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let i = 0; i < kernelSize; i++) {
          const sampleY = Math.max(0, Math.min(height - 1, y + i - halfKernel));
          const sampleIndex = sampleY * width + x;
          const weight = kernel[i];
          
          sum += tempMask[sampleIndex] * weight;
          weightSum += weight;
        }
        
        const resultIndex = y * width + x;
        blurredMask[resultIndex] = sum / weightSum;
      }
    }
    
    return blurredMask;
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