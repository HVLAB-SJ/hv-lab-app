import { db } from '../../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

export interface EstimateForm {
  projectName: string;
  clientName: string;
  areaSize: number;
  residenceType: string[];
  grade: string[];
  finishType: string;
  bathroomCount: string[];
  ceilingHeight: string[];
  expansionWork: string[];
  livingRoomExpansion?: boolean;
  roomExpansion?: boolean;
  roomExpansionCount?: number;
  kitchenExpansion?: boolean;
  floorMaterial: string[];
  wallMaterial: string[];
  ceilingMaterial: string[];
  furnitureWork: string[];
  furnitureHardwareGrade: string[];
  kitchenCountertop: string[];
  switchPublic: string[];
  switchRoom: string[];
  lightingType: string[];
  indirectLightingPublic: string[];
  indirectLightingRoom: string[];
  bathroomCeiling: string[];
  bathroomTileGrade: string[];
  bathroomFaucet: string[];
  bathroomTile: string[];
  bathroomGrout: string[];
  moldingPublic: string[];
  moldingRoom: string[];
  includeSash?: boolean;
  includeGrooving?: boolean;
  includeBangtong?: boolean;
  includeAircon?: boolean;
  airconCount?: number;
  airconType?: string[];
  ceilingDemolition?: string[];
}

export interface EstimateResult {
  baseConstructionCost: number;
  fixtureCost: number;
  fixtureCostMin?: number;
  fixtureCostMax?: number;
  sashCost: number;
  heatingCost: number;
  airconCost: number;
  totalMinCost: number;
  totalMaxCost: number;
  detailBreakdown?: any;
}

export interface SavedEstimate extends EstimateForm, EstimateResult {
  id: number;
  created_at: string;
  created_by_name?: string;
}

export interface PriceSettings {
  floor?: Record<string, number>;
  wall?: Record<string, number>;
  furniture?: Record<string, number>;
  countertop?: Record<string, number>;
  switch?: Record<string, number>;
  lighting?: Record<string, number>;
  indirectLighting?: Record<string, number>;
  molding?: Record<string, number>;
  bathroom?: {
    ceiling?: Record<string, number>;
    faucet?: Record<string, number>;
    tile?: Record<string, number>;
    grout?: Record<string, number>;
  };
  expansion?: Record<string, number>;
}

// Firestore 타임스탬프를 ISO 문자열로 변환
const timestampToISOString = (timestamp: Timestamp | string | undefined): string => {
  if (!timestamp) return new Date().toISOString();
  if (typeof timestamp === 'string') return timestamp;
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  return new Date().toISOString();
};

const estimatePreviewFirestoreService = {
  // 견적서 목록 조회
  async getList(): Promise<SavedEstimate[]> {
    try {
      const estimatesRef = collection(db, 'estimate_previews');
      const q = query(estimatesRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          ...data,
          id: parseInt(docSnap.id) || 0,
          created_at: timestampToISOString(data.created_at)
        } as SavedEstimate;
      });
    } catch (error: any) {
      console.error('[Firestore] 견적서 목록 조회 실패:', error);
      throw error;
    }
  },

  // 견적서 상세 조회
  async getById(id: number): Promise<SavedEstimate | null> {
    try {
      const docRef = doc(db, 'estimate_previews', String(id));
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        ...data,
        id: parseInt(docSnap.id) || 0,
        created_at: timestampToISOString(data.created_at)
      } as SavedEstimate;
    } catch (error: any) {
      console.error('[Firestore] 견적서 조회 실패:', error);
      throw error;
    }
  },

  // 견적서 생성 및 저장
  async create(formData: EstimateForm, result: EstimateResult, createdByName?: string): Promise<SavedEstimate> {
    try {
      // 새 ID 생성 (기존 최대 ID + 1)
      const estimatesRef = collection(db, 'estimate_previews');
      const snapshot = await getDocs(estimatesRef);
      let maxId = 0;
      snapshot.docs.forEach(docSnap => {
        const id = parseInt(docSnap.id);
        if (!isNaN(id) && id > maxId) maxId = id;
      });
      const newId = maxId + 1;

      const docRef = doc(db, 'estimate_previews', String(newId));
      const now = new Date().toISOString();

      const savedData = {
        ...formData,
        ...result,
        created_by_name: createdByName || null,
        created_at: now,
        updated_at: serverTimestamp()
      };

      await setDoc(docRef, savedData);

      console.log('✅ [Firestore] 견적서 생성 성공:', newId);

      return {
        ...savedData,
        id: newId,
        created_at: now
      } as SavedEstimate;
    } catch (error: any) {
      console.error('[Firestore] 견적서 생성 실패:', error);
      throw new Error(`견적서 생성 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 견적서 삭제
  async delete(id: number): Promise<void> {
    try {
      const docRef = doc(db, 'estimate_previews', String(id));
      await deleteDoc(docRef);
      console.log('✅ [Firestore] 견적서 삭제 성공:', id);
    } catch (error: any) {
      console.error('[Firestore] 견적서 삭제 실패:', error);
      throw new Error(`견적서 삭제 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 가격 설정 조회
  async getPriceSettings(): Promise<{ settings: PriceSettings }> {
    try {
      const docRef = doc(db, 'estimate_preview_settings', 'prices');
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return { settings: {} };
      }

      return { settings: docSnap.data() as PriceSettings };
    } catch (error: any) {
      console.error('[Firestore] 가격 설정 조회 실패:', error);
      throw error;
    }
  },

  // 가격 설정 저장
  async savePriceSettings(settings: PriceSettings): Promise<void> {
    try {
      const docRef = doc(db, 'estimate_preview_settings', 'prices');
      await setDoc(docRef, {
        ...settings,
        updatedAt: serverTimestamp()
      }, { merge: true });
      console.log('✅ [Firestore] 가격 설정 저장 성공');
    } catch (error: any) {
      console.error('[Firestore] 가격 설정 저장 실패:', error);
      throw new Error(`가격 설정 저장 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 견적 계산 (클라이언트 사이드 계산 - 가격 설정 기반)
  async calculate(formData: EstimateForm): Promise<EstimateResult> {
    // 가격 설정 가져오기
    const { settings } = await this.getPriceSettings();

    // 간단한 계산 로직 (실제로는 더 복잡한 로직이 필요할 수 있음)
    const baseConstructionCost = formData.areaSize * 500000; // 평당 기본 공사비
    const fixtureCost = formData.areaSize * 200000; // 평당 자재비
    const sashCost = formData.includeSash ? formData.areaSize * 100000 : 0;
    const heatingCost = formData.areaSize * 50000;
    const airconCost = formData.includeAircon ? (formData.airconCount || 1) * 1500000 : 0;

    const totalMinCost = baseConstructionCost + fixtureCost + sashCost + heatingCost + airconCost;
    const totalMaxCost = totalMinCost * 1.2; // 20% 여유분

    return {
      baseConstructionCost,
      fixtureCost,
      fixtureCostMin: fixtureCost * 0.8,
      fixtureCostMax: fixtureCost * 1.2,
      sashCost,
      heatingCost,
      airconCost,
      totalMinCost,
      totalMaxCost,
      detailBreakdown: settings
    };
  }
};

export default estimatePreviewFirestoreService;
