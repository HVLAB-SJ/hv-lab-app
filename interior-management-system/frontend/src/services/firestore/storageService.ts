/**
 * Firebase Storage 공통 서비스
 * 모든 이미지 업로드를 Firebase Storage로 처리
 */

import { storage } from '../../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export type ImageCategory =
  | 'site_logs'        // 현장일지
  | 'additional_works' // 추가공사
  | 'execution_records'// 실행기록
  | 'finish_check'     // 마감체크
  | 'payments'         // 지출결의
  | 'drawings'         // 도면
  | 'specbook';        // 스펙북 (기존)

/**
 * Base64 이미지인지 확인
 */
export function isBase64Image(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  if (str.startsWith('http://') || str.startsWith('https://')) return false;
  if (str.startsWith('data:image')) return true;
  // 긴 문자열은 Base64로 간주 (1KB 이상)
  if (str.length > 1000) return true;
  return false;
}

/**
 * Base64에서 content type 추출
 */
function getContentType(base64Data: string): string {
  if (base64Data.startsWith('data:')) {
    const match = base64Data.match(/data:([^;]+);/);
    if (match) return match[1];
  }
  return 'image/jpeg';
}

/**
 * Content type에서 확장자 추출
 */
function getExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf'
  };
  return map[contentType] || 'jpg';
}

/**
 * Base64 데이터를 Blob으로 변환
 */
function base64ToBlob(base64Data: string): Blob {
  let pureBase64 = base64Data;
  let contentType = 'image/jpeg';

  if (base64Data.includes(',')) {
    const parts = base64Data.split(',');
    pureBase64 = parts[1];
    const match = parts[0].match(/data:([^;]+);/);
    if (match) contentType = match[1];
  }

  const byteCharacters = atob(pureBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

/**
 * 이미지를 Firebase Storage에 업로드
 * @param category 이미지 카테고리 (컬렉션 이름)
 * @param documentId 문서 ID
 * @param imageData Base64 이미지 데이터
 * @param imageIndex 이미지 인덱스 (여러 이미지인 경우)
 * @returns Firebase Storage URL
 */
export async function uploadImageToStorage(
  category: ImageCategory,
  documentId: string,
  imageData: string,
  imageIndex?: number
): Promise<string> {
  // 이미 URL인 경우 그대로 반환
  if (!isBase64Image(imageData)) {
    return imageData;
  }

  const contentType = getContentType(imageData);
  const ext = getExtension(contentType);
  const fileName = imageIndex !== undefined
    ? `image_${imageIndex}.${ext}`
    : `main.${ext}`;

  const storagePath = `${category}/${documentId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  const blob = base64ToBlob(imageData);

  await uploadBytes(storageRef, blob, {
    contentType
  });

  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

/**
 * 여러 이미지를 Firebase Storage에 업로드
 * @param category 이미지 카테고리
 * @param documentId 문서 ID
 * @param images 이미지 배열 (Base64 또는 URL)
 * @returns Firebase Storage URL 배열
 */
export async function uploadImagesToStorage(
  category: ImageCategory,
  documentId: string,
  images: string[]
): Promise<string[]> {
  const uploadedUrls: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const url = await uploadImageToStorage(category, documentId, image, i);
    uploadedUrls.push(url);
  }

  return uploadedUrls;
}

/**
 * Firebase Storage에서 이미지 삭제
 * @param imageUrl Storage URL
 */
export async function deleteImageFromStorage(imageUrl: string): Promise<void> {
  // Firebase Storage URL이 아닌 경우 무시
  if (!imageUrl.includes('firebasestorage.googleapis.com')) {
    return;
  }

  try {
    // URL에서 경로 추출
    const match = imageUrl.match(/\/o\/(.+)\?/);
    if (match) {
      const path = decodeURIComponent(match[1]);
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    }
  } catch (error) {
    console.warn('이미지 삭제 실패:', error);
    // 삭제 실패해도 무시 (이미 삭제되었을 수 있음)
  }
}

/**
 * 여러 이미지를 Firebase Storage에서 삭제
 * @param imageUrls Storage URL 배열
 */
export async function deleteImagesFromStorage(imageUrls: string[]): Promise<void> {
  await Promise.all(imageUrls.map(url => deleteImageFromStorage(url)));
}

export default {
  uploadImageToStorage,
  uploadImagesToStorage,
  deleteImageFromStorage,
  deleteImagesFromStorage,
  isBase64Image
};
