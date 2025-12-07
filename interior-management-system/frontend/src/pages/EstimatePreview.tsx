import React, { useState, useEffect } from 'react';
import { Download, FileText, Plus, Trash2, Eye, Clock, Settings } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface EstimateForm {
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
}

interface EstimateResult {
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

interface SavedEstimate extends EstimateForm, EstimateResult {
  id: number;
  created_at: string;
  created_by_name?: string;
}

type TabView = 'form' | 'history' | 'settings';

const EstimatePreview: React.FC = () => {
  const { user } = useAuth();

  // 권한 체크 - admin 또는 manager만 접근 가능
  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return <Navigate to="/dashboard" replace />;
  }

  const [form, setForm] = useState<EstimateForm>({
    projectName: '',
    clientName: '',
    areaSize: 0,
    residenceType: [],
    grade: [],
    finishType: '',
    bathroomCount: [],
    ceilingHeight: [],
    expansionWork: [],
    livingRoomExpansion: false,
    roomExpansion: false,
    roomExpansionCount: 0,
    kitchenExpansion: false,
    floorMaterial: [],
    wallMaterial: [],
    ceilingMaterial: [],
    furnitureWork: [],
    furnitureHardwareGrade: [],
    kitchenCountertop: [],
    switchPublic: [],
    switchRoom: [],
    lightingType: [],
    indirectLightingPublic: [],
    indirectLightingRoom: [],
    bathroomCeiling: [],
    bathroomTileGrade: [],
    bathroomFaucet: [],
    bathroomTile: [],
    bathroomGrout: [],
    moldingPublic: [],
    moldingRoom: [],
    includeSash: false,
    includeGrooving: false,
    includeBangtong: false,
    includeAircon: false,
    airconCount: 1,
    airconType: []
  });

  const [result, setResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>([]);
  const [activeTab, setActiveTab] = useState<TabView>('form');
  const [selectedEstimate, setSelectedEstimate] = useState<SavedEstimate | null>(null);
  const [priceSettings, setPriceSettings] = useState<any>({
    floor: {},
    wall: {},
    furniture: {},
    countertop: {},
    switch: {},
    lighting: {},
    indirectLighting: {},
    molding: {},
    bathroom: {
      ceiling: {},
      faucet: {},
      tile: {},
      grout: {}
    },
    expansion: {}
  });

  useEffect(() => {
    loadEstimateHistory();
    loadPriceSettings();
  }, []);

  // 폼 변경 시 자동으로 견적 계산 (debounce 적용)
  useEffect(() => {
    // 필수 항목이 모두 입력되었는지 확인
    if (!form.areaSize || form.areaSize <= 0 || form.grade.length === 0) {
      setResult(null); // 필수 항목이 없으면 결과 초기화
      return;
    }

    // debounce: 500ms 후에 계산 실행
    const timeoutId = setTimeout(() => {
      calculateEstimateAuto();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form]);

  // 가격 설정 변경 시 자동 저장 (debounce 적용)
  useEffect(() => {
    // 초기 로드 시에는 저장하지 않음
    if (!priceSettings.floor || Object.keys(priceSettings.floor).length === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      savePriceSettings();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [priceSettings]);

  const loadEstimateHistory = async () => {
    try {
      const response = await api.get('/estimate-preview/list');
      setSavedEstimates(response.data);
    } catch (error) {
      console.error('가견적서 목록 로드 실패:', error);
    }
  };

  const loadPriceSettings = async () => {
    try {
      const response = await api.get('/estimate-preview/settings/prices');
      if (response.data && response.data.settings && Object.keys(response.data.settings).length > 0) {
        setPriceSettings(response.data.settings);
      }
    } catch (error) {
      console.error('가격 설정 로드 실패:', error);
    }
  };

  const savePriceSettings = async () => {
    try {
      await api.post('/estimate-preview/settings/prices', { settings: priceSettings });
      // 조용히 저장 (toast 없이)
    } catch (error) {
      console.error('가격 설정 저장 실패:', error);
    }
  };

  const handlePriceChange = (category: string, item: string, type: 'min' | 'max', value: string) => {
    setPriceSettings((prev: any) => {
      const newSettings = { ...prev };
      if (!newSettings[category]) {
        newSettings[category] = {};
      }
      if (!newSettings[category][item]) {
        newSettings[category][item] = { min: '', max: '' };
      }
      newSettings[category][item][type] = value;
      return newSettings;
    });
  };

  const handleBathroomPriceChange = (subCategory: string, item: string, type: 'min' | 'max', value: string) => {
    setPriceSettings((prev: any) => {
      const newSettings = { ...prev };
      if (!newSettings.bathroom[subCategory]) {
        newSettings.bathroom[subCategory] = {};
      }
      if (!newSettings.bathroom[subCategory][item]) {
        newSettings.bathroom[subCategory][item] = { min: '', max: '' };
      }
      newSettings.bathroom[subCategory][item][type] = value;
      return newSettings;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'areaSize' || name === 'bathroomCount' || name === 'airconCount' || name === 'roomExpansionCount') {
      setForm(prev => ({ ...prev, [name]: Number(value) || 0 }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMaterialCheckbox = (category: keyof EstimateForm, value: string) => {
    const currentValues = form[category];
    if (Array.isArray(currentValues)) {
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      setForm(prev => ({ ...prev, [category]: newValues }));
    }
  };

  const calculateEstimate = async () => {
    // 유효성 검사
    if (!form.projectName) {
      toast.error('프로젝트명을 입력해주세요');
      return;
    }
    if (!form.areaSize || form.areaSize <= 0) {
      toast.error('평수를 올바르게 입력해주세요');
      return;
    }
    if (form.grade.length === 0) {
      toast.error('등급을 선택해주세요');
      return;
    }

    setLoading(true);
    try {
      // 배열 필드들을 JSON 문자열로 변환
      const formData = {
        ...form,
        residenceType: JSON.stringify(form.residenceType),
        grade: JSON.stringify(form.grade),
        bathroomCount: JSON.stringify(form.bathroomCount),
        ceilingHeight: JSON.stringify(form.ceilingHeight),
        expansionWork: JSON.stringify(form.expansionWork),
        floorMaterial: JSON.stringify(form.floorMaterial),
        wallMaterial: JSON.stringify(form.wallMaterial),
        ceilingMaterial: JSON.stringify(form.ceilingMaterial),
        furnitureWork: JSON.stringify(form.furnitureWork),
        furnitureHardwareGrade: JSON.stringify(form.furnitureHardwareGrade),
        kitchenCountertop: JSON.stringify(form.kitchenCountertop),
        switchPublic: JSON.stringify(form.switchPublic),
        switchRoom: JSON.stringify(form.switchRoom),
        lightingType: JSON.stringify(form.lightingType),
        indirectLightingPublic: JSON.stringify(form.indirectLightingPublic),
        indirectLightingRoom: JSON.stringify(form.indirectLightingRoom),
        bathroomCeiling: JSON.stringify(form.bathroomCeiling),
        bathroomTileGrade: JSON.stringify(form.bathroomTileGrade),
        bathroomFaucet: JSON.stringify(form.bathroomFaucet),
        bathroomTile: JSON.stringify(form.bathroomTile),
        bathroomGrout: JSON.stringify(form.bathroomGrout),
        moldingPublic: JSON.stringify(form.moldingPublic),
        moldingRoom: JSON.stringify(form.moldingRoom)
      };

      const response = await api.post('/estimate-preview/create', formData);
      setResult(response.data);
      toast.success('견적이 계산되었습니다');
      loadEstimateHistory(); // 저장 후 목록 새로고침
    } catch (error) {
      console.error('견적 계산 실패:', error);
      toast.error('견적 계산에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 자동 계산 함수 (저장하지 않고 미리보기만)
  const calculateEstimateAuto = async () => {
    setLoading(true);
    try {
      // 배열 필드들을 JSON 문자열로 변환
      const formData = {
        ...form,
        projectName: form.projectName || '미리보기',
        clientName: form.clientName || '미리보기',
        residenceType: JSON.stringify(form.residenceType),
        grade: JSON.stringify(form.grade),
        bathroomCount: JSON.stringify(form.bathroomCount),
        ceilingHeight: JSON.stringify(form.ceilingHeight),
        expansionWork: JSON.stringify(form.expansionWork),
        floorMaterial: JSON.stringify(form.floorMaterial),
        wallMaterial: JSON.stringify(form.wallMaterial),
        ceilingMaterial: JSON.stringify(form.ceilingMaterial),
        furnitureWork: JSON.stringify(form.furnitureWork),
        furnitureHardwareGrade: JSON.stringify(form.furnitureHardwareGrade),
        kitchenCountertop: JSON.stringify(form.kitchenCountertop),
        switchPublic: JSON.stringify(form.switchPublic),
        switchRoom: JSON.stringify(form.switchRoom),
        lightingType: JSON.stringify(form.lightingType),
        indirectLightingPublic: JSON.stringify(form.indirectLightingPublic),
        indirectLightingRoom: JSON.stringify(form.indirectLightingRoom),
        bathroomCeiling: JSON.stringify(form.bathroomCeiling),
        bathroomTileGrade: JSON.stringify(form.bathroomTileGrade),
        bathroomFaucet: JSON.stringify(form.bathroomFaucet),
        bathroomTile: JSON.stringify(form.bathroomTile),
        bathroomGrout: JSON.stringify(form.bathroomGrout),
        moldingPublic: JSON.stringify(form.moldingPublic),
        moldingRoom: JSON.stringify(form.moldingRoom)
      };

      const response = await api.post('/estimate-preview/calculate', formData);
      setResult(response.data);
    } catch (error) {
      console.error('자동 견적 계산 실패:', error);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const loadEstimate = async (id: number) => {
    try {
      const response = await api.get(`/estimate-preview/${id}`);
      const data = response.data;

      // 폼 데이터 설정
      setForm({
        projectName: data.project_name,
        clientName: data.client_name,
        areaSize: data.area_size,
        residenceType: data.residence_type ? JSON.parse(data.residence_type) : [],
        grade: data.grade,
        finishType: data.finish_type || '',
        bathroomCount: data.bathroom_count ? JSON.parse(data.bathroom_count) : [],
        ceilingHeight: data.ceiling_height ? JSON.parse(data.ceiling_height) : [],
        includeSash: data.include_sash === 1,
        includeGrooving: data.include_grooving === 1,
        includeBangtong: data.include_bangtong === 1,
        includeAircon: data.include_aircon === 1,
        airconCount: data.aircon_count || 1,
        airconType: data.aircon_type ? JSON.parse(data.aircon_type) : [],
        floorMaterial: data.floor_material ? JSON.parse(data.floor_material) : [],
        wallMaterial: data.wall_material ? JSON.parse(data.wall_material) : [],
        ceilingMaterial: data.ceiling_material ? JSON.parse(data.ceiling_material) : [],
        furnitureWork: data.furniture_work ? JSON.parse(data.furniture_work) : [],
        furnitureHardwareGrade: data.furniture_hardware_grade ? JSON.parse(data.furniture_hardware_grade) : [],
        kitchenCountertop: data.kitchen_countertop ? JSON.parse(data.kitchen_countertop) : [],
        switchPublic: data.switch_public ? JSON.parse(data.switch_public) : [],
        switchRoom: data.switch_room ? JSON.parse(data.switch_room) : [],
        lightingType: data.lighting_type ? JSON.parse(data.lighting_type) : [],
        indirectLightingPublic: data.indirect_lighting_public ? JSON.parse(data.indirect_lighting_public) : [],
        indirectLightingRoom: data.indirect_lighting_room ? JSON.parse(data.indirect_lighting_room) : [],
        bathroomCeiling: data.bathroom_ceiling ? JSON.parse(data.bathroom_ceiling) : [],
        bathroomTileGrade: data.bathroom_tile_grade ? JSON.parse(data.bathroom_tile_grade) : [],
        bathroomFaucet: data.bathroom_faucet ? JSON.parse(data.bathroom_faucet) : [],
        bathroomTile: data.bathroom_tile ? JSON.parse(data.bathroom_tile) : [],
        bathroomGrout: data.bathroom_grout ? JSON.parse(data.bathroom_grout) : [],
        moldingPublic: data.molding_public ? JSON.parse(data.molding_public) : [],
        moldingRoom: data.molding_room ? JSON.parse(data.molding_room) : []
      });

      // 결과 데이터 설정
      setResult({
        baseConstructionCost: data.base_construction_cost,
        fixtureCost: data.fixture_cost,
        sashCost: data.sash_cost,
        heatingCost: data.heating_cost,
        airconCost: data.aircon_cost,
        totalMinCost: data.total_min_cost,
        totalMaxCost: data.total_max_cost,
        detailBreakdown: data.detail_breakdown
      });

      setSelectedEstimate(data);
      setActiveTab('form');
      toast.success('가견적서를 불러왔습니다');
    } catch (error) {
      console.error('가견적서 로드 실패:', error);
      toast.error('가견적서를 불러오는데 실패했습니다');
    }
  };

  const deleteEstimate = async (id: number) => {
    if (!window.confirm('이 가견적서를 삭제하시겠습니까?')) return;

    try {
      await api.delete(`/estimate-preview/${id}`);
      toast.success('가견적서가 삭제되었습니다');
      loadEstimateHistory();
    } catch (error) {
      console.error('가견적서 삭제 실패:', error);
      toast.error('가견적서 삭제에 실패했습니다');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0
    }).format(value);
  };

  const resetForm = () => {
    setForm({
      projectName: '',
      clientName: '',
      areaSize: 0,
      residenceType: [],
      grade: [],
      finishType: '',
      bathroomCount: [],
      ceilingHeight: [],
      includeSash: false,
      includeGrooving: false,
      includeBangtong: false,
      includeAircon: false,
      airconCount: 1,
      airconType: [],
      livingRoomExpansion: false,
      roomExpansion: false,
      roomExpansionCount: 0,
      kitchenExpansion: false,
      floorMaterial: [],
      wallMaterial: [],
      ceilingMaterial: [],
      furnitureWork: [],
      furnitureHardwareGrade: [],
      kitchenCountertop: [],
      switchPublic: [],
      switchRoom: [],
      lightingType: [],
      indirectLightingPublic: [],
      indirectLightingRoom: [],
      bathroomCeiling: [],
      bathroomTileGrade: [],
      bathroomFaucet: [],
      bathroomTile: [],
      bathroomGrout: [],
      moldingPublic: [],
      moldingRoom: []
    });
    setResult(null);
    setSelectedEstimate(null);
  };

  const downloadPDF = () => {
    // PDF 다운로드 기능 구현 (추후 구현)
    toast.info('PDF 다운로드 기능은 준비 중입니다');
  };

  const stats = {
    total: savedEstimates.length,
    thisMonth: savedEstimates.filter(e => {
      const date = new Date(e.created_at);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length
  };

  return (
    <div className="space-y-2">
      {/* Tabs */}
      <div className="border-b border-gray-200 flex items-center justify-between">
        <nav className="flex space-x-4 md:space-x-8">
          {[
            { id: 'form' as TabView, label: '견적 작성' },
            { id: 'history' as TabView, label: '저장된 견적', count: stats.total, icon: Clock },
            { id: 'settings' as TabView, label: '항목별 설정', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap flex items-center gap-2',
                activeTab === tab.id
                  ? 'border-gray-700 text-gray-700'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.icon && <tab.icon className="h-4 w-4" />}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={clsx(
                  'ml-1 py-0.5 px-1.5 rounded-full text-[10px] md:text-xs font-semibold',
                  activeTab === tab.id ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button
          onClick={resetForm}
          className="px-3 md:px-4 py-2 bg-gray-700 text-white text-xs md:text-sm rounded hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">새 견적</span>
        </button>
      </div>

      {activeTab === 'form' && (
        <div className="estimate-container grid grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
          {/* 입력 폼 */}
          <div className="estimate-form bg-white rounded-lg border border-gray-200 p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 기본 정보 섹션 */}
              <div className="md:col-span-2">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        프로젝트명 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="projectName"
                        value={form.projectName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                        placeholder="예: 강남 오피스텔"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        평수 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="areaSize"
                        value={form.areaSize || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                        placeholder="예: 25"
                        min="1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        주거 형태
                      </label>
                      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
                        {['아파트', '빌라', '오피스텔', '단독주택', '주상복합'].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={form.residenceType.includes(item)}
                              onChange={() => handleMaterialCheckbox('residenceType', item)}
                              className="mr-1 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        등급 <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 md:flex gap-2 md:gap-3">
                        {['알뜰', '기본', '고급', '하이엔드'].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={form.grade.includes(item)}
                              onChange={() => handleMaterialCheckbox('grade', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 마감재 섹션 */}
              <div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      바닥재
                    </label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 md:flex gap-2 md:gap-4">
                        {['장판', '데코타일', '강마루', '원목마루'].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={form.floorMaterial.includes(item)}
                              onChange={() => handleMaterialCheckbox('floorMaterial', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:flex gap-2 md:gap-4">
                        {['600각 타일', '800-900각 타일', '1200각 타일'].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={form.floorMaterial.includes(item)}
                              onChange={() => handleMaterialCheckbox('floorMaterial', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      벽재 / 천장재
                    </label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                          '합지도배',
                          '실크도배(일반)',
                          '실크도배(고급)',
                          '도장(전체)',
                          '필름',
                          '대형타일',
                          '박판타일',
                          '무늬목'
                        ].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={form.wallMaterial.includes(item)}
                              onChange={() => handleMaterialCheckbox('wallMaterial', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-1">
                        <label className="flex items-center text-xs md:text-sm">
                          <input
                            type="checkbox"
                            checked={form.wallMaterial.includes('도장(공용부)+실크도배(방)')}
                            onChange={() => handleMaterialCheckbox('wallMaterial', '도장(공용부)+실크도배(방)')}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700 break-keep">도장(공용부)+실크도배(방)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* 공사 범위 섹션 */}
              <div>
                <div className="space-y-3">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        화장실 개수
                      </label>
                      <div className="flex gap-2 md:gap-3">
                        {['0', '1', '2', '3', '4'].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm">
                            <input
                              type="checkbox"
                              checked={form.bathroomCount.includes(item)}
                              onChange={() => handleMaterialCheckbox('bathroomCount', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        층고
                      </label>
                      <div className="flex gap-2 md:gap-3">
                        {['2400이하', '2400~2600', '2600이상'].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={form.ceilingHeight.includes(item)}
                              onChange={() => handleMaterialCheckbox('ceilingHeight', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      확장 공사
                    </label>
                    <div className="grid grid-cols-1 md:flex gap-2 md:gap-4 md:flex-wrap">
                      <label className="flex items-center text-xs md:text-sm whitespace-nowrap">
                        <input
                          type="checkbox"
                          name="livingRoomExpansion"
                          checked={form.livingRoomExpansion}
                          onChange={handleInputChange}
                          className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                        />
                        <span className="text-gray-700">거실 확장</span>
                      </label>
                      <label className="flex items-center text-xs md:text-sm whitespace-nowrap">
                        <input
                          type="checkbox"
                          name="kitchenExpansion"
                          checked={form.kitchenExpansion}
                          onChange={handleInputChange}
                          className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                        />
                        <span className="text-gray-700">주방 확장</span>
                      </label>
                      <div className="flex items-center">
                        <label className="flex items-center text-xs md:text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            name="roomExpansion"
                            checked={form.roomExpansion}
                            onChange={handleInputChange}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700">방 확장</span>
                        </label>
                        {form.roomExpansion && (
                          <select
                            name="roomExpansionCount"
                            value={form.roomExpansionCount}
                            onChange={handleInputChange}
                            className="ml-2 px-2 py-1 text-xs md:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                          >
                            <option value={0}>선택</option>
                            <option value={1}>1개</option>
                            <option value={2}>2개</option>
                            <option value={3}>3개</option>
                            <option value={4}>4개</option>
                          </select>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      기타 공사
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center text-xs md:text-sm">
                        <input
                          type="checkbox"
                          name="includeSash"
                          checked={form.includeSash}
                          onChange={handleInputChange}
                          className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                        />
                        <span className="text-gray-700">샤시 공사</span>
                      </label>
                      <label className="flex items-center text-xs md:text-sm">
                        <input
                          type="checkbox"
                          name="includeGrooving"
                          checked={form.includeGrooving}
                          onChange={handleInputChange}
                          className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                        />
                        <span className="text-gray-700 break-keep">홈파기(바닥난방+수도배관)공사</span>
                      </label>
                      <label className="flex items-center text-xs md:text-sm">
                        <input
                          type="checkbox"
                          name="includeBangtong"
                          checked={form.includeBangtong}
                          onChange={handleInputChange}
                          className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                        />
                        <span className="text-gray-700 break-keep">방통(바닥단열+바닥난방+수도배관)공사</span>
                      </label>
                      <div>
                        <div className="flex items-center flex-wrap gap-2">
                          <label className="flex items-center text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              name="includeAircon"
                              checked={form.includeAircon}
                              onChange={handleInputChange}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">에어컨 공사</span>
                          </label>
                          {form.includeAircon && (
                            <select
                              name="airconCount"
                              value={form.airconCount}
                              onChange={handleInputChange}
                              className="px-2 py-1 text-xs md:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                <option key={num} value={num}>{num}대</option>
                              ))}
                            </select>
                          )}
                        </div>
                        {form.includeAircon && (
                          <div className="ml-0 md:ml-6 mt-2 flex gap-2 md:gap-3">
                            {['2 in 1', '시스템 에어컨'].map(item => (
                              <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={form.airconType.includes(item)}
                                  onChange={() => handleMaterialCheckbox('airconType', item)}
                                  className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                                />
                                <span className="text-gray-700">{item}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 가구 공사 섹션 */}
              <div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      가구 공사 범위
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center text-xs md:text-sm whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={form.furnitureWork.includes('전체')}
                          onChange={() => handleMaterialCheckbox('furnitureWork', '전체')}
                          className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                        />
                        <span className="text-gray-700">전체</span>
                      </label>
                      <label className="flex items-center text-xs md:text-sm whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={form.furnitureWork.includes('공용부')}
                          onChange={() => handleMaterialCheckbox('furnitureWork', '공용부')}
                          className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                        />
                        <span className="text-gray-700">공용부</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      하드웨어 등급
                    </label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center text-xs md:text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={form.furnitureHardwareGrade.includes('전체 BLUM(블룸)')}
                            onChange={() => handleMaterialCheckbox('furnitureHardwareGrade', '전체 BLUM(블룸)')}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700">전체 BLUM(블룸)</span>
                        </label>
                        <label className="flex items-center text-xs md:text-sm">
                          <input
                            type="checkbox"
                            checked={form.furnitureHardwareGrade.includes('경첩(일반)+서랍(일반)')}
                            onChange={() => handleMaterialCheckbox('furnitureHardwareGrade', '경첩(일반)+서랍(일반)')}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700 break-keep">경첩(일반)+서랍(일반)</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-1">
                        <label className="flex items-center text-xs md:text-sm">
                          <input
                            type="checkbox"
                            checked={form.furnitureHardwareGrade.includes('경첩 BLUM(블룸)+서랍(일반)')}
                            onChange={() => handleMaterialCheckbox('furnitureHardwareGrade', '경첩 BLUM(블룸)+서랍(일반)')}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700 break-keep">경첩 BLUM(블룸)+서랍(일반)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      주방 상판
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {['세라믹', '칸스톤', '천연대리석', '인조대리석', '스테인리스'].map(item => (
                        <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={form.kitchenCountertop.includes(item)}
                            onChange={() => handleMaterialCheckbox('kitchenCountertop', item)}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 전기/조명 섹션 */}
              <div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      스위치/콘센트 (공용부)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['융스위치(메탈)', '융스위치(일반)', '르그랑 아테오', '르그랑 아펠라'].map(item => (
                        <label key={item} className="flex items-center text-xs md:text-sm">
                          <input
                            type="checkbox"
                            checked={form.switchPublic.includes(item)}
                            onChange={() => handleMaterialCheckbox('switchPublic', item)}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700 whitespace-nowrap">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      스위치/콘센트 (방)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['융스위치(메탈)', '융스위치(일반)', '르그랑 아테오', '르그랑 아펠라'].map(item => (
                        <label key={item} className="flex items-center text-xs md:text-sm">
                          <input
                            type="checkbox"
                            checked={form.switchRoom.includes(item)}
                            onChange={() => handleMaterialCheckbox('switchRoom', item)}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700 whitespace-nowrap">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      조명
                    </label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {['마그네틱조명', '라인조명'].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={form.lightingType.includes(item)}
                              onChange={() => handleMaterialCheckbox('lightingType', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {['매입조명(일반)', '매입조명(고급)'].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={form.lightingType.includes(item)}
                              onChange={() => handleMaterialCheckbox('lightingType', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center text-xs md:text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={form.lightingType.includes('매입조명(하이엔드)')}
                            onChange={() => handleMaterialCheckbox('lightingType', '매입조명(하이엔드)')}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700">매입조명(하이엔드)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        간접조명 (공용부)
                      </label>
                      <div className="flex gap-3">
                        {['LED', 'T3 조명'].map(item => (
                          <label key={item} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={form.indirectLightingPublic.includes(item)}
                              onChange={() => handleMaterialCheckbox('indirectLightingPublic', item)}
                              className="mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        간접조명 (방)
                      </label>
                      <div className="flex gap-3">
                        {['LED', 'T3 조명'].map(item => (
                          <label key={item} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={form.indirectLightingRoom.includes(item)}
                              onChange={() => handleMaterialCheckbox('indirectLightingRoom', item)}
                              className="mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 기타 마감 섹션 */}
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      몰딩 (공용부)
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {['무걸레받이+마이너스몰딩', '무걸레받이+무몰딩', '걸레받이+무몰딩', '걸레받이+천장몰딩'].map(item => (
                        <label key={item} className="flex items-center text-xs md:text-sm">
                          <input
                            type="checkbox"
                            checked={form.moldingPublic.includes(item)}
                            onChange={() => handleMaterialCheckbox('moldingPublic', item)}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700 break-keep">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      몰딩 (방)
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {['무걸레받이+마이너스몰딩', '무걸레받이+무몰딩', '걸레받이+무몰딩', '걸레받이+천장몰딩'].map(item => (
                        <label key={item} className="flex items-center text-xs md:text-sm">
                          <input
                            type="checkbox"
                            checked={form.moldingRoom.includes(item)}
                            onChange={() => handleMaterialCheckbox('moldingRoom', item)}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700 break-keep">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 화장실 상세 섹션 */}
              <div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      화장실 천장
                    </label>
                    <div className="grid grid-cols-2 md:flex gap-2 md:gap-3">
                      {['SMC', '도장', '이노솔'].map(item => (
                        <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={form.bathroomCeiling.includes(item)}
                            onChange={() => handleMaterialCheckbox('bathroomCeiling', item)}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      화장실 수전
                    </label>
                    <div className="grid grid-cols-2 md:flex gap-2 md:gap-3">
                      {['일반수전', '매립수전'].map(item => (
                        <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={form.bathroomFaucet.includes(item)}
                            onChange={() => handleMaterialCheckbox('bathroomFaucet', item)}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      타일 등급
                    </label>
                    <div className="grid grid-cols-2 md:flex gap-2 md:gap-3">
                      {['유럽산(고급)', '중국산(중급)', '중국산(기본)'].map(item => (
                        <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={form.bathroomTileGrade.includes(item)}
                            onChange={() => handleMaterialCheckbox('bathroomTileGrade', item)}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      화장실 타일
                    </label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          '600각(덧방)',
                          '600각(올철거)',
                          '750x1500',
                          '박판타일'
                        ].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={form.bathroomTile.includes(item)}
                              onChange={() => handleMaterialCheckbox('bathroomTile', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          '300x600(벽)+300각(바닥)',
                          '600x1200 or 800각(올철거)'
                        ].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm">
                            <input
                              type="checkbox"
                              checked={form.bathroomTile.includes(item)}
                              onChange={() => handleMaterialCheckbox('bathroomTile', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700 break-keep">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      줄눈
                    </label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-1">
                        <label className="flex items-center text-xs md:text-sm">
                          <input
                            type="checkbox"
                            checked={form.bathroomGrout.includes('스트라이크에보(친환경 에폭시)')}
                            onChange={() => handleMaterialCheckbox('bathroomGrout', '스트라이크에보(친환경 에폭시)')}
                            className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                          />
                          <span className="text-gray-700 break-keep">스트라이크에보(친환경 에폭시)</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {['케라폭시(에폭시)', '푸가벨라'].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={form.bathroomGrout.includes(item)}
                              onChange={() => handleMaterialCheckbox('bathroomGrout', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700">{item}</span>
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {['FG8(수입 고탄성 줄눈)', 'FG4(아덱스 줄눈)'].map(item => (
                          <label key={item} className="flex items-center text-xs md:text-sm">
                            <input
                              type="checkbox"
                              checked={form.bathroomGrout.includes(item)}
                              onChange={() => handleMaterialCheckbox('bathroomGrout', item)}
                              className="mr-1.5 md:mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400 flex-shrink-0"
                            />
                            <span className="text-gray-700 break-keep">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              <button
                onClick={calculateEstimate}
                disabled={loading}
                className="md:col-span-2 w-full py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base transition-colors"
              >
                {loading ? '계산 중...' : '견적 계산'}
              </button>
            </div>
          </div>

          {/* 결과 표시 */}
          <div className="estimate-result bg-white rounded-lg border border-gray-200 p-4 md:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base md:text-lg font-semibold text-gray-800">견적 결과</h2>
              {result && (
                <button
                  onClick={downloadPDF}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 flex items-center gap-1 text-xs md:text-sm transition-colors"
                >
                  <Download className="h-3 w-3 md:h-4 md:w-4" />
                  PDF
                </button>
              )}
            </div>

            {result ? (
              <div className="space-y-4">
                {/* 총 예상 견적 */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-center">
                    <p className="text-xs md:text-sm text-gray-600 mb-2">예상 견적 범위</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">
                      {formatCurrency(result.totalMinCost)} ~ {formatCurrency(result.totalMaxCost)}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">(±15% 범위)</p>
                  </div>
                </div>

                {/* 상세 내역 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs md:text-sm font-medium text-gray-700">항목</th>
                        <th className="px-4 py-2 text-right text-xs md:text-sm font-medium text-gray-700">금액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-2 text-xs md:text-sm text-gray-900">기본 공사비</td>
                        <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(result.baseConstructionCost)}
                        </td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-4 py-2 text-xs md:text-sm text-gray-900 font-semibold">집기류 ({form.grade.join(', ')})</td>
                        <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-semibold">
                          {result.fixtureCostMin !== undefined && result.fixtureCostMax !== undefined
                            ? `${formatCurrency(result.fixtureCostMin)} ~ ${formatCurrency(result.fixtureCostMax)}`
                            : formatCurrency(result.fixtureCost)}
                        </td>
                      </tr>
                      {/* 집기류 항목별 상세 */}
                      {result.detailBreakdown?.fixtureItems?.map((item: any, idx: number) => (
                        <tr key={idx} className="bg-white">
                          <td className="px-4 py-1.5 text-xs text-gray-600 pl-8">
                            └ {item.category} × {item.quantity}개
                          </td>
                          <td className="px-4 py-1.5 text-xs text-gray-600 text-right">
                            {formatCurrency(item.minTotal)} ~ {formatCurrency(item.maxTotal)}
                          </td>
                        </tr>
                      ))}
                      {result.detailBreakdown?.itemDetails?.floor > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">바닥재</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.floor)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.wall > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">벽재</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.wall)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.ceiling > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">천장재</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.ceiling)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.furniture > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">가구 공사</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.furniture)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.countertop > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">주방 상판</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.countertop)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.switchPublic > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">스위치/콘센트 (공용부)</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.switchPublic)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.switchRoom > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">스위치/콘센트 (방)</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.switchRoom)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.lighting > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">조명</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.lighting)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.indirectPublic > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">간접조명 (공용부)</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.indirectPublic)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.indirectRoom > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">간접조명 (방)</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.indirectRoom)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.moldingPublic > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">몰딩 (공용부)</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.moldingPublic)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.moldingRoom > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">몰딩 (방)</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.moldingRoom)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.bathroomCeiling > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">화장실 천장</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.bathroomCeiling)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.bathroomFaucet > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">화장실 수전</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.bathroomFaucet)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.bathroomTile > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">화장실 타일</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.bathroomTile)}
                          </td>
                        </tr>
                      )}
                      {result.detailBreakdown?.itemDetails?.bathroomGrout > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">화장실 줄눈</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.detailBreakdown.itemDetails.bathroomGrout)}
                          </td>
                        </tr>
                      )}
                      {result.sashCost > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">샤시 공사</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.sashCost)}
                          </td>
                        </tr>
                      )}
                      {result.heatingCost > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">바닥난방배관</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.heatingCost)}
                          </td>
                        </tr>
                      )}
                      {result.airconCost > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900">에어컨 공사</td>
                          <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(result.airconCost)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-4 py-2 text-xs md:text-sm font-semibold text-gray-900">합계</td>
                        <td className="px-4 py-2 text-xs md:text-sm font-bold text-gray-900 text-right">
                          {formatCurrency(
                            result.baseConstructionCost +
                            result.fixtureCost +
                            (result.settingsBasedCost || 0) +
                            result.sashCost +
                            result.heatingCost +
                            result.airconCost
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="text-xs md:text-sm text-gray-500 text-center mt-4">
                  * 실제 견적은 현장 상황에 따라 달라질 수 있습니다.
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <FileText className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3" />
                <p className="text-sm md:text-base">견적 정보를 입력하고 계산 버튼을 클릭하세요</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 md:p-6 border-b border-gray-200">
            <h2 className="text-base md:text-lg font-semibold text-gray-800">저장된 가견적서 ({stats.total})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">프로젝트명</th>
                  <th className="px-4 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">평수</th>
                  <th className="px-4 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">등급</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">예상 금액</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작성일</th>
                  <th className="px-4 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {savedEstimates.map((estimate) => (
                  <tr key={estimate.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {estimate.project_name}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">
                      {estimate.area_size}평
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-center">
                      <span className={clsx(
                        'inline-flex px-2 py-1 text-xs font-medium rounded border',
                        estimate.grade === '알뜰' && 'bg-gray-50 text-gray-700 border-gray-300',
                        estimate.grade === '기본' && 'bg-gray-100 text-gray-800 border-gray-400',
                        estimate.grade === '고급' && 'bg-gray-200 text-gray-900 border-gray-500',
                        estimate.grade === '하이엔드' && 'bg-gray-800 text-white border-gray-800'
                      )}>
                        {estimate.grade}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{formatCurrency(estimate.total_min_cost)}</div>
                        <div className="text-xs text-gray-500">~ {formatCurrency(estimate.total_max_cost)}</div>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {new Date(estimate.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => loadEstimate(estimate.id)}
                          className="text-gray-600 hover:text-gray-900 transition-colors"
                          title="보기"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteEstimate(estimate.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-6">
            항목별 단가 범위 설정
          </h2>

          <div className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
              <p className="text-sm text-gray-700">
                <strong>💡 참고:</strong> 각 항목의 최소~최대 가격 범위를 설정하세요. 견적 계산 시 이 범위 내에서 자동 계산됩니다.
              </p>
            </div>

            {/* 바닥재, 벽재/천장재, 가구 공사, 주방 상판, 스위치/콘센트 - 5열 배치 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 border-b pb-6">
              {/* 바닥재 */}
              <div>
                <h3 className="text-md font-semibold text-gray-700 mb-4">바닥재 (평당)</h3>
                <div className="space-y-3">
                  {['장판', '데코타일', '강마루', '원목마루', '600각 타일', '800-900각 타일', '1200각 타일'].map(item => (
                    <div key={item} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">{item}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="최소"
                          value={priceSettings.floor[item]?.min || ''}
                          onChange={(e) => handlePriceChange('floor', item, 'min', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                        <span className="text-gray-500 text-sm">~</span>
                        <input
                          type="number"
                          placeholder="최대"
                          value={priceSettings.floor[item]?.max || ''}
                          onChange={(e) => handlePriceChange('floor', item, 'max', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 벽재/천장재 */}
              <div>
                <h3 className="text-md font-semibold text-gray-700 mb-4">벽재/천장재 (평당)</h3>
                <div className="space-y-3">
                  {['합지도배', '실크도배(일반)', '실크도배(고급)', '도장(전체)', '필름', '대형타일', '박판타일', '무늬목', '도장(공용부)+실크도배(방)'].map(item => (
                    <div key={item} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">{item}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="최소"
                          value={priceSettings.wall[item]?.min || ''}
                          onChange={(e) => handlePriceChange('wall', item, 'min', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                        <span className="text-gray-500 text-sm">~</span>
                        <input
                          type="number"
                          placeholder="최대"
                          value={priceSettings.wall[item]?.max || ''}
                          onChange={(e) => handlePriceChange('wall', item, 'max', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 가구 공사 */}
              <div>
                <h3 className="text-md font-semibold text-gray-700 mb-4">가구 공사</h3>
                <div className="space-y-3">
                  {['전체', '공용부'].map(item => (
                    <div key={item} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">가구({item})</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="최소"
                          value={priceSettings.furniture[`가구(${item})`]?.min || ''}
                          onChange={(e) => handlePriceChange('furniture', `가구(${item})`, 'min', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                        <span className="text-gray-500 text-sm">~</span>
                        <input
                          type="number"
                          placeholder="최대"
                          value={priceSettings.furniture[`가구(${item})`]?.max || ''}
                          onChange={(e) => handlePriceChange('furniture', `가구(${item})`, 'max', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                      </div>
                    </div>
                  ))}
                  {['전체 BLUM(블룸)', '경첩(일반)+서랍(일반)', '경첩 BLUM(블룸)+서랍(일반)'].map(item => (
                    <div key={item} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">{item}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="최소"
                          value={priceSettings.furniture[item]?.min || ''}
                          onChange={(e) => handlePriceChange('furniture', item, 'min', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                        <span className="text-gray-500 text-sm">~</span>
                        <input
                          type="number"
                          placeholder="최대"
                          value={priceSettings.furniture[item]?.max || ''}
                          onChange={(e) => handlePriceChange('furniture', item, 'max', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 주방 상판 */}
              <div>
                <h3 className="text-md font-semibold text-gray-700 mb-4">주방 상판</h3>
                <div className="space-y-3">
                  {['세라믹', '칸스톤', '천연대리석', '인조대리석', '스테인리스'].map(item => (
                    <div key={item} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">{item}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="최소"
                          value={priceSettings.countertop[item]?.min || ''}
                          onChange={(e) => handlePriceChange('countertop', item, 'min', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                        <span className="text-gray-500 text-sm">~</span>
                        <input
                          type="number"
                          placeholder="최대"
                          value={priceSettings.countertop[item]?.max || ''}
                          onChange={(e) => handlePriceChange('countertop', item, 'max', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 스위치/콘센트 */}
              <div>
                <h3 className="text-md font-semibold text-gray-700 mb-4">스위치/콘센트 (개당)</h3>
                <div className="space-y-3">
                  {['융스위치(메탈)', '융스위치(일반)', '르그랑 아테오', '르그랑 아펠라'].map(item => (
                    <div key={item} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">{item}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="최소"
                          value={priceSettings.switch[item]?.min || ''}
                          onChange={(e) => handlePriceChange('switch', item, 'min', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                        <span className="text-gray-500 text-sm">~</span>
                        <input
                          type="number"
                          placeholder="최대"
                          value={priceSettings.switch[item]?.max || ''}
                          onChange={(e) => handlePriceChange('switch', item, 'max', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 조명, 간접조명, 몰딩 - 5열 배치 (처음 3열만 사용) */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 border-b pb-6">
              {/* 조명 */}
              <div>
                <h3 className="text-md font-semibold text-gray-700 mb-4">조명 (개당)</h3>
                <div className="space-y-3">
                  {['마그네틱조명', '라인조명', '매입조명(일반)', '매입조명(고급)', '매입조명(하이엔드)'].map(item => (
                    <div key={item} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">{item}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="최소"
                          value={priceSettings.lighting[item]?.min || ''}
                          onChange={(e) => handlePriceChange('lighting', item, 'min', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                        <span className="text-gray-500 text-sm">~</span>
                        <input
                          type="number"
                          placeholder="최대"
                          value={priceSettings.lighting[item]?.max || ''}
                          onChange={(e) => handlePriceChange('lighting', item, 'max', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 간접조명 */}
              <div>
                <h3 className="text-md font-semibold text-gray-700 mb-4">간접조명 (미터당)</h3>
                <div className="space-y-3">
                  {['LED', 'T3 조명'].map(item => (
                    <div key={item} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">{item}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="최소"
                          value={priceSettings.indirectLighting[item]?.min || ''}
                          onChange={(e) => handlePriceChange('indirectLighting', item, 'min', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                        <span className="text-gray-500 text-sm">~</span>
                        <input
                          type="number"
                          placeholder="최대"
                          value={priceSettings.indirectLighting[item]?.max || ''}
                          onChange={(e) => handlePriceChange('indirectLighting', item, 'max', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 몰딩 */}
              <div>
                <h3 className="text-md font-semibold text-gray-700 mb-4">몰딩 (미터당)</h3>
                <div className="space-y-3">
                  {['무걸레받이+마이너스몰딩', '무걸레받이+무몰딩', '걸레받이+무몰딩', '걸레받이+천장몰딩'].map(item => (
                    <div key={item} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">{item}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="최소"
                          value={priceSettings.molding[item]?.min || ''}
                          onChange={(e) => handlePriceChange('molding', item, 'min', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                        <span className="text-gray-500 text-sm">~</span>
                        <input
                          type="number"
                          placeholder="최대"
                          value={priceSettings.molding[item]?.max || ''}
                          onChange={(e) => handlePriceChange('molding', item, 'max', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div></div> {/* 빈 공간 */}
              <div></div> {/* 빈 공간 */}
            </div>

            {/* 화장실 */}
            <div className="border-b pb-6">
              <h3 className="text-md font-semibold text-gray-700 mb-4">화장실</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-3">천장</h4>
                  <div className="space-y-3">
                    {['SMC', '도장', '이노솔'].map(item => (
                      <div key={item} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">{item}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="최소"
                            value={priceSettings.bathroom.ceiling[item]?.min || ''}
                            onChange={(e) => handleBathroomPriceChange('ceiling', item, 'min', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                          />
                          <span className="text-gray-500 text-sm">~</span>
                          <input
                            type="number"
                            placeholder="최대"
                            value={priceSettings.bathroom.ceiling[item]?.max || ''}
                            onChange={(e) => handleBathroomPriceChange('ceiling', item, 'max', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-3">수전</h4>
                  <div className="space-y-3">
                    {['일반수전', '매립수전'].map(item => (
                      <div key={item} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">{item}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="최소"
                            value={priceSettings.bathroom.faucet[item]?.min || ''}
                            onChange={(e) => handleBathroomPriceChange('faucet', item, 'min', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                          />
                          <span className="text-gray-500 text-sm">~</span>
                          <input
                            type="number"
                            placeholder="최대"
                            value={priceSettings.bathroom.faucet[item]?.max || ''}
                            onChange={(e) => handleBathroomPriceChange('faucet', item, 'max', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-3">타일 등급</h4>
                  <div className="space-y-3">
                    {['유럽산(고급)', '중국산(중급)', '중국산(기본)'].map(item => (
                      <div key={item} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">{item}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="최소"
                            value={priceSettings.bathroom.tile[item]?.min || ''}
                            onChange={(e) => handleBathroomPriceChange('tile', item, 'min', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                          />
                          <span className="text-gray-500 text-sm">~</span>
                          <input
                            type="number"
                            placeholder="최대"
                            value={priceSettings.bathroom.tile[item]?.max || ''}
                            onChange={(e) => handleBathroomPriceChange('tile', item, 'max', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-3">타일 규격</h4>
                  <div className="space-y-3">
                    {['600각(덧방)', '600각(올철거)', '750x1500', '박판타일', '300x600(벽)+300각(바닥)', '600x1200 or 800각(올철거)'].map(item => (
                      <div key={item} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">{item}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="최소"
                            value={priceSettings.bathroom.tile[item]?.min || ''}
                            onChange={(e) => handleBathroomPriceChange('tile', item, 'min', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                          />
                          <span className="text-gray-500 text-sm">~</span>
                          <input
                            type="number"
                            placeholder="최대"
                            value={priceSettings.bathroom.tile[item]?.max || ''}
                            onChange={(e) => handleBathroomPriceChange('tile', item, 'max', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-3">줄눈</h4>
                  <div className="space-y-3">
                    {['스트라이크에보(친환경 에폭시)', '케라폭시(에폭시)', '푸가벨라'].map(item => (
                      <div key={item} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">{item}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="최소"
                            value={priceSettings.bathroom.grout[item]?.min || ''}
                            onChange={(e) => handleBathroomPriceChange('grout', item, 'min', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                          />
                          <span className="text-gray-500 text-sm">~</span>
                          <input
                            type="number"
                            placeholder="최대"
                            value={priceSettings.bathroom.grout[item]?.max || ''}
                            onChange={(e) => handleBathroomPriceChange('grout', item, 'max', e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 확장 및 기타 공사 - 단독 섹션 */}
            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-4">확장 및 기타 공사</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-x-6 gap-y-3">
                {[
                  { label: '거실 확장 (평당)', key: 'livingRoom' },
                  { label: '주방 확장 (평당)', key: 'kitchen' },
                  { label: '방 확장 (개당)', key: 'room' },
                  { label: '샤시 공사 (평당)', key: 'sash' },
                  { label: '홈파기 공사 (평당)', key: 'grooving' },
                  { label: '방통 공사 (평당)', key: 'bangtong' },
                  { label: '에어컨 (2 in 1) - 1대', key: 'aircon2in1' },
                  { label: '에어컨 (시스템) - 1대', key: 'airconSystem' }
                ].map(item => (
                  <div key={item.key} className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">{item.label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="최소"
                        value={priceSettings.expansion[item.key]?.min || ''}
                        onChange={(e) => handlePriceChange('expansion', item.key, 'min', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                      />
                      <span className="text-gray-500 text-sm">~</span>
                      <input
                        type="number"
                        placeholder="최대"
                        value={priceSettings.expansion[item.key]?.max || ''}
                        onChange={(e) => handlePriceChange('expansion', item.key, 'max', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstimatePreview;