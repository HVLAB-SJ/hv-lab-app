/**
 * 이미지 관련 유틸리티 함수들
 */

/**
 * 이미지를 압축하여 용량을 줄이는 함수
 * @param base64 - Base64 인코딩된 이미지 문자열
 * @param maxWidth - 최대 너비 (기본값: 800px)
 * @param quality - JPEG 품질 (0-1, 기본값: 0.7)
 * @returns 압축된 Base64 이미지 문자열
 */
export const compressImage = (
  base64: string,
  maxWidth: number = 800,
  quality: number = 0.7
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // 최대 너비를 넘으면 비율에 맞게 축소
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
      }

      // JPEG로 압축 (용량 절약)
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };

    img.onerror = () => {
      // 압축 실패 시 원본 반환
      console.warn('이미지 압축 실패, 원본 반환');
      resolve(base64);
    };

    img.src = base64;
  });
};

/**
 * 여러 이미지를 병렬로 압축
 * @param images - Base64 인코딩된 이미지 배열
 * @param maxWidth - 최대 너비
 * @param quality - JPEG 품질
 * @returns 압축된 이미지 배열
 */
export const compressImages = async (
  images: string[],
  maxWidth: number = 800,
  quality: number = 0.7
): Promise<string[]> => {
  const compressionPromises = images.map(image =>
    compressImage(image, maxWidth, quality)
  );
  return Promise.all(compressionPromises);
};

/**
 * 파일을 Base64로 변환
 * @param file - 파일 객체
 * @returns Base64 인코딩된 문자열
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

/**
 * Base64 이미지의 대략적인 크기를 계산 (KB 단위)
 * @param base64 - Base64 인코딩된 이미지
 * @returns 크기 (KB)
 */
export const getBase64Size = (base64: string): number => {
  // Base64는 원본 크기의 약 1.33배
  // 헤더 부분 제거 후 계산
  const base64WithoutHeader = base64.split(',')[1] || base64;
  const sizeInBytes = (base64WithoutHeader.length * 3) / 4;
  return Math.round(sizeInBytes / 1024);
};

/**
 * 이미지 배열의 총 크기 계산 (KB 단위)
 * @param images - Base64 인코딩된 이미지 배열
 * @returns 총 크기 (KB)
 */
export const getTotalImagesSize = (images: string[]): number => {
  return images.reduce((total, image) => total + getBase64Size(image), 0);
};

/**
 * 이미지가 유효한 Base64 형식인지 확인
 * @param base64 - Base64 문자열
 * @returns 유효 여부
 */
export const isValidBase64Image = (base64: string): boolean => {
  if (!base64) return false;

  // 데이터 URI 스키마 확인
  const dataUriRegex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp);base64,/i;
  return dataUriRegex.test(base64);
};

/**
 * 이미지 파일 확장자 검증
 * @param filename - 파일명
 * @returns 이미지 파일 여부
 */
export const isImageFile = (filename: string): boolean => {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
  return imageExtensions.test(filename);
};

/**
 * 이미지 미리보기용 썸네일 생성
 * @param base64 - Base64 인코딩된 이미지
 * @param thumbnailSize - 썸네일 크기 (기본값: 150px)
 * @returns 썸네일 Base64 이미지
 */
export const createThumbnail = (
  base64: string,
  thumbnailSize: number = 150
): Promise<string> => {
  return compressImage(base64, thumbnailSize, 0.8);
};

/**
 * 이미지 로딩 에러 시 대체 이미지 URL 반환
 * @returns 대체 이미지 URL
 */
export const getFallbackImage = (): string => {
  // 1x1 투명 픽셀 이미지
  return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
};