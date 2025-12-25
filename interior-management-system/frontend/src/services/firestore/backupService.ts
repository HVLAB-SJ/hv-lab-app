/**
 * Firebase Firestore 백업 서비스
 * 모든 컬렉션을 JSON으로 내보내기/가져오기
 */
import { db } from '../../config/firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { COLLECTIONS } from './index';

// 백업할 컬렉션 목록
const BACKUP_COLLECTIONS = [
  COLLECTIONS.PROJECTS,
  COLLECTIONS.PAYMENTS,
  COLLECTIONS.SCHEDULES,
  COLLECTIONS.CONTRACTORS,
  COLLECTIONS.EXECUTION_RECORDS,
  COLLECTIONS.AS_REQUESTS,
  COLLECTIONS.ADDITIONAL_WORKS,
  COLLECTIONS.CONSTRUCTION_PAYMENTS,
  COLLECTIONS.SITE_LOGS,
  COLLECTIONS.DRAWINGS,
  COLLECTIONS.WORK_REQUESTS,
  COLLECTIONS.QUOTE_INQUIRIES,
  COLLECTIONS.FINISH_CHECK_SPACES,
  COLLECTIONS.FINISH_CHECK_ITEMS,
  COLLECTIONS.SPECBOOK_ITEMS,
  COLLECTIONS.SPECBOOK_CATEGORIES,
  COLLECTIONS.SPECBOOK_PROJECT_ITEMS,
  COLLECTIONS.PROCESSES,
  COLLECTIONS.USERS,
];

export interface BackupData {
  version: string;
  createdAt: string;
  collections: {
    [collectionName: string]: {
      count: number;
      documents: { id: string; data: Record<string, unknown> }[];
    };
  };
}

export interface BackupProgress {
  currentCollection: string;
  totalCollections: number;
  completedCollections: number;
  status: 'idle' | 'backing_up' | 'restoring' | 'completed' | 'error';
  error?: string;
}

const backupService = {
  /**
   * 모든 Firestore 컬렉션을 JSON으로 백업
   */
  createBackup: async (onProgress?: (progress: BackupProgress) => void): Promise<BackupData> => {
    const backup: BackupData = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      collections: {},
    };

    const totalCollections = BACKUP_COLLECTIONS.length;
    let completedCollections = 0;

    for (const collectionName of BACKUP_COLLECTIONS) {
      try {
        onProgress?.({
          currentCollection: collectionName,
          totalCollections,
          completedCollections,
          status: 'backing_up',
        });

        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);

        const documents: { id: string; data: Record<string, unknown> }[] = [];
        snapshot.forEach((doc) => {
          documents.push({
            id: doc.id,
            data: doc.data() as Record<string, unknown>,
          });
        });

        backup.collections[collectionName] = {
          count: documents.length,
          documents,
        };

        completedCollections++;
        console.log(`[Backup] ${collectionName}: ${documents.length}개 문서`);
      } catch (error) {
        console.error(`[Backup] ${collectionName} 백업 실패:`, error);
        // 에러가 발생해도 계속 진행
        backup.collections[collectionName] = {
          count: 0,
          documents: [],
        };
        completedCollections++;
      }
    }

    onProgress?.({
      currentCollection: '',
      totalCollections,
      completedCollections,
      status: 'completed',
    });

    return backup;
  },

  /**
   * 백업 데이터를 JSON 파일로 다운로드
   */
  downloadBackup: (backup: BackupData): void => {
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `hvlab-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * JSON 파일에서 백업 데이터 읽기
   */
  readBackupFile: (file: File): Promise<BackupData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as BackupData;
          if (!data.version || !data.collections) {
            reject(new Error('잘못된 백업 파일 형식입니다.'));
            return;
          }
          resolve(data);
        } catch (error) {
          reject(new Error('백업 파일을 읽을 수 없습니다.'));
        }
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsText(file);
    });
  },

  /**
   * 백업 데이터를 Firestore에 복원 (주의: 기존 데이터 덮어쓰기)
   */
  restoreBackup: async (
    backup: BackupData,
    onProgress?: (progress: BackupProgress) => void
  ): Promise<{ success: boolean; restoredCount: number; errors: string[] }> => {
    const errors: string[] = [];
    let restoredCount = 0;
    const totalCollections = Object.keys(backup.collections).length;
    let completedCollections = 0;

    for (const [collectionName, collectionData] of Object.entries(backup.collections)) {
      try {
        onProgress?.({
          currentCollection: collectionName,
          totalCollections,
          completedCollections,
          status: 'restoring',
        });

        const batch = writeBatch(db);
        let batchCount = 0;

        for (const document of collectionData.documents) {
          const docRef = doc(db, collectionName, document.id);
          batch.set(docRef, document.data);
          batchCount++;
          restoredCount++;

          // Firestore batch는 최대 500개까지
          if (batchCount >= 500) {
            await batch.commit();
            batchCount = 0;
          }
        }

        // 남은 문서 커밋
        if (batchCount > 0) {
          await batch.commit();
        }

        completedCollections++;
        console.log(`[Restore] ${collectionName}: ${collectionData.documents.length}개 복원`);
      } catch (error) {
        console.error(`[Restore] ${collectionName} 복원 실패:`, error);
        errors.push(`${collectionName}: ${(error as Error).message}`);
        completedCollections++;
      }
    }

    onProgress?.({
      currentCollection: '',
      totalCollections,
      completedCollections,
      status: errors.length > 0 ? 'error' : 'completed',
      error: errors.length > 0 ? errors.join(', ') : undefined,
    });

    return {
      success: errors.length === 0,
      restoredCount,
      errors,
    };
  },

  /**
   * 백업 통계 정보
   */
  getBackupStats: (backup: BackupData): { totalDocuments: number; collections: { name: string; count: number }[] } => {
    let totalDocuments = 0;
    const collections: { name: string; count: number }[] = [];

    for (const [name, data] of Object.entries(backup.collections)) {
      totalDocuments += data.count;
      collections.push({ name, count: data.count });
    }

    return { totalDocuments, collections };
  },
};

export default backupService;
