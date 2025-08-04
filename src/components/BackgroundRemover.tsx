'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ImageProcessor } from '@/lib/imageProcessor';

export default function BackgroundRemover() {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [processedImage, setProcessedImage] = useState<HTMLCanvasElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTool, setSelectedTool] = useState<'magicWand' | 'colorPicker'>('magicWand');
  const [tolerance, setTolerance] = useState(32);
  const [blurRadius, setBlurRadius] = useState(0);
  const [selectedColor, setSelectedColor] = useState<[number, number, number]>([255, 255, 255]);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [currentMask, setCurrentMask] = useState<ImageData | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageProcessor = useRef(new ImageProcessor());

  // 建立高斯模糊核心
  const createGaussianKernel = useCallback((radius: number): number[] => {
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
  }, []);

  // 處理圖片上傳
  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
        
        // 建立 canvas 來獲取 ImageData
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        setImageData(ctx.getImageData(0, 0, img.width, img.height));
        
        // 設定 canvas 顯示
        if (canvasRef.current) {
          const displayCtx = canvasRef.current.getContext('2d')!;
          canvasRef.current.width = img.width;
          canvasRef.current.height = img.height;
          displayCtx.drawImage(img, 0, 0);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  // 更新顯示
  const updateDisplay = useCallback(() => {
    if (!originalImage || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    // 計算顯示尺寸，保持比例
    const maxWidth = 800; // 最大寬度
    const maxHeight = 600; // 最大高度
    
    let displayWidth = originalImage.width;
    let displayHeight = originalImage.height;
    
    // 計算縮放比例
    const scaleX = maxWidth / originalImage.width;
    const scaleY = maxHeight / originalImage.height;
    const scale = Math.min(scaleX, scaleY, 1); // 不放大超過原尺寸
    
    // 設定 canvas 顯示尺寸
    displayWidth = originalImage.width * scale;
    displayHeight = originalImage.height * scale;
    
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    
    // 清除 canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    // 繪製原圖（不包含選區邊框）
    ctx.drawImage(originalImage, 0, 0, displayWidth, displayHeight);
  }, [originalImage]);

  // 當選區改變時更新顯示
  useEffect(() => {
    updateDisplay();
  }, [updateDisplay]);

  // 處理魔術棒點擊
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageData || !originalImage) return;

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    
    // 計算縮放比例
    const maxWidth = 800;
    const maxHeight = 600;
    const scaleX = maxWidth / originalImage.width;
    const scaleY = maxHeight / originalImage.height;
    const scale = Math.min(scaleX, scaleY, 1);
    
    // 計算點擊位置（轉換到原圖座標）
    const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    // 轉換到原圖座標
    const x = Math.floor(canvasX / scale);
    const y = Math.floor(canvasY / scale);

    if (selectedTool === 'magicWand') {
      setIsProcessing(true);
      
      // 使用 Web Worker 來避免阻塞主執行緒
      setTimeout(() => {
        const mask = imageProcessor.current.magicWand(imageData, x, y, tolerance);
        setCurrentMask(mask);
        
        const result = imageProcessor.current.postprocess(originalImage, mask, tolerance / 255, blurRadius);
        setProcessedImage(result);
        setIsProcessing(false);
      }, 0);
    } else if (selectedTool === 'colorPicker') {
      // 獲取點擊位置的顏色
      const pixelIndex = (y * imageData.width + x) * 4;
      const r = imageData.data[pixelIndex];
      const g = imageData.data[pixelIndex + 1];
      const b = imageData.data[pixelIndex + 2];
      setSelectedColor([r, g, b]);
    }
  }, [imageData, originalImage, selectedTool, tolerance, blurRadius]);

  // 處理顏色選擇器
  const handleColorPicker = useCallback(() => {
    if (!imageData || !originalImage) return;

    setIsProcessing(true);
    
    setTimeout(() => {
      const mask = imageProcessor.current.colorPicker(imageData, selectedColor, tolerance);
      setCurrentMask(mask);
      
      const result = imageProcessor.current.postprocess(originalImage, mask, tolerance / 255, blurRadius);
      setProcessedImage(result);
      setIsProcessing(false);
    }, 0);
  }, [imageData, originalImage, selectedColor, tolerance, blurRadius]);

  // 下載處理後的圖片
  const handleDownload = useCallback(() => {
    if (processedImage) {
      imageProcessor.current.downloadImage(processedImage);
    }
  }, [processedImage]);

  // 重置圖片
  const handleReset = useCallback(() => {
    setProcessedImage(null);
    setCurrentMask(null);
    if (originalImage && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(originalImage, 0, 0);
    }
  }, [originalImage]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">AI 去背工具</h1>
        
        {/* 上傳區域 */}
        <div className="mb-8">
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
            >
              選擇圖片
            </button>
            <p className="mt-2 text-gray-400">支援 JPG、PNG 格式</p>
          </div>
        </div>

        {originalImage && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 工具控制面板 */}
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">工具選擇</h3>
                
                {/* 工具選擇 */}
                <div className="flex space-x-4 mb-6">
                  <button
                    onClick={() => setSelectedTool('magicWand')}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      selectedTool === 'magicWand'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    魔術棒
                  </button>
                  <button
                    onClick={() => setSelectedTool('colorPicker')}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      selectedTool === 'colorPicker'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    滴水工具
                  </button>
                </div>

                {/* 容差調整 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">
                    容差: {tolerance}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* 模糊強度調整 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">
                    模糊強度: {blurRadius}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={blurRadius}
                    onChange={(e) => setBlurRadius(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* 顏色選擇器（滴水工具） */}
                {selectedTool === 'colorPicker' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">選擇顏色</label>
                    <div className="flex items-center space-x-4">
                      <div
                        className="w-12 h-12 rounded-lg border-2 border-gray-600"
                        style={{
                          backgroundColor: `rgb(${selectedColor[0]}, ${selectedColor[1]}, ${selectedColor[2]})`
                        }}
                      />
                      <button
                        onClick={handleColorPicker}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg font-medium"
                      >
                        {isProcessing ? '處理中...' : '應用顏色選擇'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 操作按鈕 */}
                <div className="flex space-x-4">
                  <button
                    onClick={handleReset}
                    className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg font-medium"
                  >
                    重置
                  </button>
                  {processedImage && (
                    <button
                      onClick={handleDownload}
                      className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium"
                    >
                      下載結果
                    </button>
                  )}
                </div>
              </div>

              {/* 使用說明 */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">使用說明</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p><strong>魔術棒：</strong>點擊圖片上要刪除的區域，會自動選取相似顏色的區域</p>
                  <p><strong>滴水工具：</strong>點擊圖片來選擇要刪除的顏色，然後點擊「應用顏色選擇」</p>
                  <p><strong>容差：</strong>調整顏色匹配的寬鬆程度，數值越大選擇範圍越廣</p>
                  <p><strong>模糊強度：</strong>調整最終圖片的模糊程度，讓邊緣更自然</p>
                  <p><strong>選區顯示：</strong>綠色虛線顯示當前選中的區域</p>
                  <p><strong>注意：</strong>選取的部分會被刪除（變透明），未選取的部分會保留</p>
                </div>
              </div>
            </div>

            {/* 圖片顯示區域 */}
            <div className="space-y-4">
              {/* 原圖區塊 */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">原圖</h3>
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className={`border-2 border-gray-600 rounded-lg max-w-full ${
                      selectedTool === 'magicWand' ? 'cursor-crosshair' : 'cursor-pointer'
                    }`}
                  />
                  {selectedTool === 'magicWand' && (
                    <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                      點擊選擇區域
                    </div>
                  )}
                </div>
              </div>

              {/* 選取部分區塊 */}
              {currentMask && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">選取的部分</h3>
                  <div className="relative">
                    <canvas
                      ref={(canvas) => {
                        if (canvas && originalImage && currentMask) {
                          const ctx = canvas.getContext('2d')!;
                          
                          // 計算顯示尺寸，保持比例
                          const maxWidth = 800;
                          const maxHeight = 600;
                          const scaleX = maxWidth / originalImage.width;
                          const scaleY = maxHeight / originalImage.height;
                          const scale = Math.min(scaleX, scaleY, 1);
                          
                          const displayWidth = originalImage.width * scale;
                          const displayHeight = originalImage.height * scale;
                          
                          canvas.width = displayWidth;
                          canvas.height = displayHeight;
                          
                          // 繪製原圖
                          ctx.drawImage(originalImage, 0, 0, displayWidth, displayHeight);
                          
                          // 創建縮放後的選區
                          const scaledMask = new ImageData(displayWidth, displayHeight);
                          const scaledData = scaledMask.data;
                          const originalData = currentMask.data;
                          
                          // 簡單的最近鄰插值縮放
                          for (let y = 0; y < displayHeight; y++) {
                            for (let x = 0; x < displayWidth; x++) {
                              const srcX = Math.floor(x / scale);
                              const srcY = Math.floor(y / scale);
                              
                              if (srcX < currentMask.width && srcY < currentMask.height) {
                                const srcIndex = (srcY * currentMask.width + srcX) * 4;
                                const dstIndex = (y * displayWidth + x) * 4;
                                
                                scaledData[dstIndex] = originalData[srcIndex];
                                scaledData[dstIndex + 1] = originalData[srcIndex + 1];
                                scaledData[dstIndex + 2] = originalData[srcIndex + 2];
                                scaledData[dstIndex + 3] = originalData[srcIndex + 3];
                              }
                            }
                          }
                          
                          // 獲取畫布像素資料
                          const imageData = ctx.getImageData(0, 0, displayWidth, displayHeight);
                          const pixels = imageData.data;
                          
                          // 根據選區遮罩，將選中的區域變為半透明綠色，並添加模糊邊緣
                          for (let i = 0; i < pixels.length; i += 4) {
                            const maskIndex = i / 4;
                            const maskValue = scaledData[maskIndex * 4];
                            
                            if (maskValue > 200) {
                              // 選中的區域變為半透明綠色
                              pixels[i] = 0;     // R
                              pixels[i + 1] = 255; // G (綠色)
                              pixels[i + 2] = 0; // B
                              pixels[i + 3] = 150; // A (半透明)
                            } else if (maskValue > 50) {
                              // 模糊邊緣區域 - 根據遮罩值調整透明度和顏色
                              const intensity = maskValue / 255;
                              const alpha = intensity * 100; // 較低的透明度
                              const greenIntensity = Math.floor(255 * intensity);
                              pixels[i] = 0;     // R
                              pixels[i + 1] = greenIntensity; // G (漸變綠色)
                              pixels[i + 2] = 0; // B
                              pixels[i + 3] = alpha; // A
                            }
                            // 未選中的區域保持原圖
                          }
                          
                          // 將修改後的像素資料放回畫布
                          ctx.putImageData(imageData, 0, 0);
                          
                          // 應用模糊效果
                          if (blurRadius > 0) {
                            // 獲取當前畫布的像素資料
                            const currentImageData = ctx.getImageData(0, 0, displayWidth, displayHeight);
                            const currentData = currentImageData.data;
                            
                            // 建立高斯模糊核心
                            const kernel = createGaussianKernel(blurRadius);
                            const kernelSize = kernel.length;
                            const halfKernel = Math.floor(kernelSize / 2);
                            
                            // 只對選中的區域應用模糊
                            for (let y = 0; y < displayHeight; y++) {
                              for (let x = 0; x < displayWidth; x++) {
                                const pixelIndex = (y * displayWidth + x) * 4;
                                const maskIndex = pixelIndex / 4;
                                const maskValue = scaledData[maskIndex * 4];
                                
                                // 只對選中的區域應用模糊
                                if (maskValue > 128) {
                                  let r = 0, g = 0, b = 0, a = 0;
                                  let weightSum = 0;
                                  
                                  // 水平模糊
                                  for (let i = 0; i < kernelSize; i++) {
                                    const sampleX = Math.max(0, Math.min(displayWidth - 1, x + i - halfKernel));
                                    const samplePixelIndex = (y * displayWidth + sampleX) * 4;
                                    const weight = kernel[i];
                                    
                                    r += currentData[samplePixelIndex] * weight;
                                    g += currentData[samplePixelIndex + 1] * weight;
                                    b += currentData[samplePixelIndex + 2] * weight;
                                    a += currentData[samplePixelIndex + 3] * weight;
                                    weightSum += weight;
                                  }
                                  
                                  currentData[pixelIndex] = r / weightSum;
                                  currentData[pixelIndex + 1] = g / weightSum;
                                  currentData[pixelIndex + 2] = b / weightSum;
                                  currentData[pixelIndex + 3] = a / weightSum;
                                }
                              }
                            }
                            
                            // 垂直模糊（只對選中的區域）
                            for (let y = 0; y < displayHeight; y++) {
                              for (let x = 0; x < displayWidth; x++) {
                                const pixelIndex = (y * displayWidth + x) * 4;
                                const maskIndex = pixelIndex / 4;
                                const maskValue = scaledData[maskIndex * 4];
                                
                                // 只對選中的區域應用模糊
                                if (maskValue > 128) {
                                  let r = 0, g = 0, b = 0, a = 0;
                                  let weightSum = 0;
                                  
                                  for (let i = 0; i < kernelSize; i++) {
                                    const sampleY = Math.max(0, Math.min(displayHeight - 1, y + i - halfKernel));
                                    const samplePixelIndex = (sampleY * displayWidth + x) * 4;
                                    const weight = kernel[i];
                                    
                                    r += currentData[samplePixelIndex] * weight;
                                    g += currentData[samplePixelIndex + 1] * weight;
                                    b += currentData[samplePixelIndex + 2] * weight;
                                    a += currentData[samplePixelIndex + 3] * weight;
                                    weightSum += weight;
                                  }
                                  
                                  currentData[pixelIndex] = r / weightSum;
                                  currentData[pixelIndex + 1] = g / weightSum;
                                  currentData[pixelIndex + 2] = b / weightSum;
                                  currentData[pixelIndex + 3] = a / weightSum;
                                }
                              }
                            }
                            
                            ctx.putImageData(currentImageData, 0, 0);
                          }
                        }
                      }}
                      className="border-2 border-gray-600 rounded-lg max-w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 