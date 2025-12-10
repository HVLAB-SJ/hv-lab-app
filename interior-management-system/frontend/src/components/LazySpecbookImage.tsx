import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

interface LazySpecbookImageProps {
  itemId: number;
  alt: string;
  className?: string;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onImageLoad?: (imageUrl: string, subImages: string[]) => void;
}

// 이미지 캐시 (메모리)
const imageCache = new Map<number, { image_url: string | null; sub_images: string[] }>();

// 로딩 중인 요청 추적 (중복 요청 방지)
const loadingRequests = new Map<number, Promise<{ image_url: string | null; sub_images: string[] }>>();

const LazySpecbookImage = ({
  itemId,
  alt,
  className = '',
  onClick,
  onPointerDown,
  onImageLoad
}: LazySpecbookImageProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer로 뷰포트 진입 감지
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect(); // 한 번 보이면 더 이상 관찰 불필요
          }
        });
      },
      {
        rootMargin: '200px', // 뷰포트 200px 전에 미리 로드 시작
        threshold: 0
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // 뷰포트에 들어오면 이미지 로드
  useEffect(() => {
    if (!isInView || imageUrl || isLoading || hasError) return;

    const loadImage = async () => {
      // 캐시 확인
      if (imageCache.has(itemId)) {
        const cached = imageCache.get(itemId)!;
        setImageUrl(cached.image_url);
        if (onImageLoad) {
          onImageLoad(cached.image_url || '', cached.sub_images);
        }
        return;
      }

      // 이미 로딩 중인 요청이 있으면 재사용
      if (loadingRequests.has(itemId)) {
        try {
          const result = await loadingRequests.get(itemId)!;
          setImageUrl(result.image_url);
          if (onImageLoad) {
            onImageLoad(result.image_url || '', result.sub_images);
          }
        } catch {
          setHasError(true);
        }
        return;
      }

      setIsLoading(true);

      // 새 요청 생성
      const requestPromise = api.get(`/specbook/item/${itemId}/image`)
        .then(response => {
          const data = {
            image_url: response.data.image_url,
            sub_images: response.data.sub_images || []
          };
          // 캐시에 저장
          imageCache.set(itemId, data);
          return data;
        });

      loadingRequests.set(itemId, requestPromise);

      try {
        const result = await requestPromise;
        setImageUrl(result.image_url);
        if (onImageLoad) {
          onImageLoad(result.image_url || '', result.sub_images);
        }
      } catch (error) {
        console.error('이미지 로드 실패:', itemId, error);
        setHasError(true);
      } finally {
        setIsLoading(false);
        loadingRequests.delete(itemId);
      }
    };

    loadImage();
  }, [isInView, itemId, imageUrl, isLoading, hasError, onImageLoad]);

  return (
    <div ref={containerRef} className="w-full h-full">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className={className}
          loading="lazy"
          onClick={onClick}
          onPointerDown={onPointerDown}
        />
      ) : isLoading ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : hasError ? (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs bg-gray-100">
          로드 실패
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs bg-gray-100">
          이미지 없음
        </div>
      )}
    </div>
  );
};

// 캐시 초기화 함수 (필요 시 외부에서 호출)
export const clearImageCache = () => {
  imageCache.clear();
};

// 특정 아이템의 캐시 업데이트 함수
export const updateImageCache = (itemId: number, imageUrl: string | null, subImages: string[]) => {
  imageCache.set(itemId, { image_url: imageUrl, sub_images: subImages });
};

// 특정 아이템의 캐시 삭제 함수
export const removeImageCache = (itemId: number) => {
  imageCache.delete(itemId);
};

export default LazySpecbookImage;
