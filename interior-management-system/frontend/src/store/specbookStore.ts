import { create } from 'zustand';
import api from '../services/api';

export interface SpecBookItem {
  id: number;
  name: string;
  category: string;
  brand: string;
  price: string;
  image_url: string | null;
  sub_images?: string[];
  description: string;
  project_id: number | null;
  is_library: number;
  display_order?: number;
  grade?: string;
  created_at: string;
  updated_at: string;
}

interface SpecbookStore {
  // 라이브러리 데이터
  libraryItems: SpecBookItem[];
  libraryLoaded: boolean;
  libraryLoading: boolean;
  libraryLoadedAt: number | null;

  // 카테고리 데이터
  categories: string[];
  categoriesLoaded: boolean;

  // 프로젝트별 데이터 캐시
  projectItemsCache: Map<number, SpecBookItem[]>;

  // 로딩 함수
  preloadLibrary: () => Promise<void>;
  preloadCategories: () => Promise<void>;
  preloadAll: () => Promise<void>;

  // 데이터 가져오기 함수
  getLibraryItems: (category?: string, grades?: string[]) => SpecBookItem[];
  getProjectItems: (projectId: number) => SpecBookItem[] | null;
  loadProjectItems: (projectId: number) => Promise<SpecBookItem[]>;

  // 캐시 무효화
  invalidateLibrary: () => void;
  invalidateProject: (projectId: number) => void;
  invalidateAll: () => void;

  // 아이템 추가/수정/삭제 후 캐시 업데이트
  addItemToCache: (item: SpecBookItem) => void;
  updateItemInCache: (item: SpecBookItem) => void;
  removeItemFromCache: (itemId: number, isLibrary: boolean, projectId?: number) => void;
}

// 캐시 유효 시간: 10분
const CACHE_TTL = 10 * 60 * 1000;

export const useSpecbookStore = create<SpecbookStore>((set, get) => ({
  libraryItems: [],
  libraryLoaded: false,
  libraryLoading: false,
  libraryLoadedAt: null,
  categories: [],
  categoriesLoaded: false,
  projectItemsCache: new Map(),

  preloadLibrary: async () => {
    const state = get();

    // 이미 로딩 중이면 스킵
    if (state.libraryLoading) return;

    // 캐시가 유효하면 스킵
    if (state.libraryLoaded && state.libraryLoadedAt) {
      const age = Date.now() - state.libraryLoadedAt;
      if (age < CACHE_TTL) {
        console.log('[SpecbookStore] 라이브러리 캐시 유효, 스킵');
        return;
      }
    }

    set({ libraryLoading: true });

    try {
      console.log('[SpecbookStore] 라이브러리 사전 로딩 시작...');
      const response = await api.get('/specbook/library/meta');

      set({
        libraryItems: response.data,
        libraryLoaded: true,
        libraryLoading: false,
        libraryLoadedAt: Date.now()
      });

      console.log('[SpecbookStore] 라이브러리 로딩 완료:', response.data.length, '개 아이템');
    } catch (error) {
      console.error('[SpecbookStore] 라이브러리 로딩 실패:', error);
      set({ libraryLoading: false });
    }
  },

  preloadCategories: async () => {
    const state = get();
    if (state.categoriesLoaded) return;

    try {
      const response = await api.get('/specbook/categories');
      set({
        categories: response.data,
        categoriesLoaded: true
      });
      console.log('[SpecbookStore] 카테고리 로딩 완료:', response.data.length, '개');
    } catch (error) {
      console.error('[SpecbookStore] 카테고리 로딩 실패:', error);
    }
  },

  preloadAll: async () => {
    const { preloadLibrary, preloadCategories } = get();
    await Promise.all([preloadLibrary(), preloadCategories()]);
  },

  getLibraryItems: (category?: string, grades?: string[]) => {
    const { libraryItems } = get();

    let filtered = libraryItems;

    // 카테고리 필터
    if (category && category !== '전체') {
      filtered = filtered.filter(item => item.category === category);
    }

    // 등급 필터
    if (grades && grades.length > 0) {
      filtered = filtered.filter(item => {
        if (!item.grade) return false;
        const itemGrades = item.grade.split(',').map(g => g.trim());
        return grades.some(g => itemGrades.includes(g));
      });
    }

    return filtered;
  },

  getProjectItems: (projectId: number) => {
    const { projectItemsCache } = get();
    return projectItemsCache.get(projectId) || null;
  },

  loadProjectItems: async (projectId: number) => {
    const state = get();

    // 캐시에 있으면 반환
    const cached = state.projectItemsCache.get(projectId);
    if (cached) {
      return cached;
    }

    try {
      const response = await api.get(`/specbook/project/${projectId}/meta`);
      const items = response.data;

      // 캐시에 저장
      set(state => {
        const newCache = new Map(state.projectItemsCache);
        newCache.set(projectId, items);
        return { projectItemsCache: newCache };
      });

      return items;
    } catch (error) {
      console.error('[SpecbookStore] 프로젝트 아이템 로딩 실패:', error);
      return [];
    }
  },

  invalidateLibrary: () => {
    set({
      libraryItems: [],
      libraryLoaded: false,
      libraryLoadedAt: null
    });
  },

  invalidateProject: (projectId: number) => {
    set(state => {
      const newCache = new Map(state.projectItemsCache);
      newCache.delete(projectId);
      return { projectItemsCache: newCache };
    });
  },

  invalidateAll: () => {
    set({
      libraryItems: [],
      libraryLoaded: false,
      libraryLoadedAt: null,
      categories: [],
      categoriesLoaded: false,
      projectItemsCache: new Map()
    });
  },

  addItemToCache: (item: SpecBookItem) => {
    if (item.is_library) {
      set(state => ({
        libraryItems: [item, ...state.libraryItems]
      }));
    } else if (item.project_id) {
      set(state => {
        const newCache = new Map(state.projectItemsCache);
        const projectItems = newCache.get(item.project_id!) || [];
        newCache.set(item.project_id!, [item, ...projectItems]);
        return { projectItemsCache: newCache };
      });
    }
  },

  updateItemInCache: (item: SpecBookItem) => {
    if (item.is_library) {
      set(state => ({
        libraryItems: state.libraryItems.map(i => i.id === item.id ? item : i)
      }));
    } else if (item.project_id) {
      set(state => {
        const newCache = new Map(state.projectItemsCache);
        const projectItems = newCache.get(item.project_id!);
        if (projectItems) {
          newCache.set(item.project_id!, projectItems.map(i => i.id === item.id ? item : i));
        }
        return { projectItemsCache: newCache };
      });
    }
  },

  removeItemFromCache: (itemId: number, isLibrary: boolean, projectId?: number) => {
    if (isLibrary) {
      set(state => ({
        libraryItems: state.libraryItems.filter(i => i.id !== itemId)
      }));
    } else if (projectId) {
      set(state => {
        const newCache = new Map(state.projectItemsCache);
        const projectItems = newCache.get(projectId);
        if (projectItems) {
          newCache.set(projectId, projectItems.filter(i => i.id !== itemId));
        }
        return { projectItemsCache: newCache };
      });
    }
  }
}));
