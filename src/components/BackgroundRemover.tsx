'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ImageProcessor } from '@/lib/imageProcessor';

export default function BackgroundRemover() {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [processedImage, setProcessedImage] = useState<HTMLCanvasElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTool, setSelectedTool] = useState<'magicWand' | 'colorPicker'>('magicWand');
  const [tolerance, setTolerance] = useState(32);
  const [selectedColor, setSelectedColor] = useState<[number, number, number]>([255, 255, 255]);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageProcessor = useRef(new ImageProcessor());

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

  // 處理魔術棒點擊
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageData || !originalImage) return;

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((event.clientY - rect.top) * (canvas.height / rect.height));

    if (selectedTool === 'magicWand') {
      setIsProcessing(true);
      
      // 使用 Web Worker 來避免阻塞主執行緒
      setTimeout(() => {
        const mask = imageProcessor.current.magicWand(imageData, x, y, tolerance);
        const result = imageProcessor.current.postprocess(originalImage, mask, tolerance / 255);
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
  }, [imageData, originalImage, selectedTool, tolerance]);

  // 處理顏色選擇器
  const handleColorPicker = useCallback(() => {
    if (!imageData || !originalImage) return;

    setIsProcessing(true);
    
    setTimeout(() => {
      const mask = imageProcessor.current.colorPicker(imageData, selectedColor, tolerance);
      const result = imageProcessor.current.postprocess(originalImage, mask, tolerance / 255);
      setProcessedImage(result);
      setIsProcessing(false);
    }, 0);
  }, [imageData, originalImage, selectedColor, tolerance]);

  // 下載處理後的圖片
  const handleDownload = useCallback(() => {
    if (processedImage) {
      imageProcessor.current.downloadImage(processedImage);
    }
  }, [processedImage]);

  // 重置圖片
  const handleReset = useCallback(() => {
    setProcessedImage(null);
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
                  <p><strong>魔術棒：</strong>點擊圖片上的區域來選擇相似顏色的區域</p>
                  <p><strong>滴水工具：</strong>點擊圖片來選擇顏色，然後點擊「應用顏色選擇」</p>
                  <p><strong>容差：</strong>調整顏色匹配的寬鬆程度，數值越大選擇範圍越廣</p>
                </div>
              </div>
            </div>

            {/* 圖片顯示區域 */}
            <div className="space-y-4">
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

              {processedImage && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">處理結果</h3>
                  <canvas
                    ref={(canvas) => {
                      if (canvas && processedImage) {
                        const ctx = canvas.getContext('2d')!;
                        canvas.width = processedImage.width;
                        canvas.height = processedImage.height;
                        ctx.drawImage(processedImage, 0, 0);
                      }
                    }}
                    className="border-2 border-gray-600 rounded-lg max-w-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 