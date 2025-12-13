import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { X, Check, RotateCw } from 'lucide-react';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

// 크롭된 이미지를 캔버스로 생성하는 함수
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.crossOrigin = 'anonymous';
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  // 회전 처리
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  // 회전된 이미지의 바운딩 박스 크기 계산
  const rotatedWidth = image.width * cos + image.height * sin;
  const rotatedHeight = image.width * sin + image.height * cos;

  // 캔버스 크기를 크롭 영역 크기로 설정
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // PNG 투명 배경을 위해 흰색 배경 먼저 채우기
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 임시 캔버스에서 회전된 이미지 생성
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    throw new Error('No 2d context');
  }

  tempCanvas.width = rotatedWidth;
  tempCanvas.height = rotatedHeight;

  // 임시 캔버스도 흰색 배경
  tempCtx.fillStyle = '#FFFFFF';
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // 중심으로 이동, 회전, 다시 중심으로 이동
  tempCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
  tempCtx.rotate(radians);
  tempCtx.translate(-image.width / 2, -image.height / 2);
  tempCtx.drawImage(image, 0, 0);

  // 회전된 이미지에서 크롭 영역 추출
  const offsetX = (rotatedWidth - image.width) / 2;
  const offsetY = (rotatedHeight - image.height) / 2;

  ctx.drawImage(
    tempCanvas,
    pixelCrop.x + offsetX,
    pixelCrop.y + offsetY,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Base64로 반환
  return canvas.toDataURL('image/jpeg', 0.9);
}

const ImageCropper = ({
  image,
  onCropComplete,
  onCancel,
  aspectRatio = 1
}: ImageCropperProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = useCallback((newCrop: { x: number; y: number }) => {
    setCrop(newCrop);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropAreaComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
      onCropComplete(croppedImage);
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <button
          onClick={onCancel}
          className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="text-white font-medium">이미지 자르기 (1:1)</span>
        <button
          onClick={handleConfirm}
          className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
        >
          <Check className="w-6 h-6" />
        </button>
      </div>

      {/* 크롭 영역 */}
      <div className="flex-1 relative">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspectRatio}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropAreaComplete}
          cropShape="rect"
          showGrid={true}
          minZoom={0.5}
          maxZoom={3}
          zoomSpeed={0.05}
          style={{
            containerStyle: {
              backgroundColor: '#000'
            }
          }}
        />
      </div>

      {/* 컨트롤 */}
      <div className="p-4 bg-black/50">
        <div className="flex items-center justify-center gap-6">
          {/* 회전 버튼 */}
          <button
            onClick={handleRotate}
            className="p-3 text-white hover:bg-white/20 rounded-full transition-colors"
            title="90도 회전"
          >
            <RotateCw className="w-6 h-6" />
          </button>

          {/* 줌 슬라이더 */}
          <div className="flex items-center gap-3 flex-1 max-w-xs">
            <span className="text-white text-sm">-</span>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <span className="text-white text-sm">+</span>
          </div>
          <span className="text-white text-xs min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
