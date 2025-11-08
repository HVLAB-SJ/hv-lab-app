import React, { useState, useEffect } from 'react';
import { Calculator, Download, Save, FileText, Plus, Trash2, Eye, Clock, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '../services/api';

interface EstimateForm {
  projectName: string;
  clientName: string;
  areaSize: number;
  grade: '알뜰' | '기본' | '고급' | '하이엔드' | '';
  finishType: string;
  bathroomCount: number;
  ceilingHeight: '표준' | '높음' | '매우높음';
  includeSash: boolean;
  includeFloorHeating: boolean;
  includeAircon: boolean;
}

interface EstimateResult {
  baseConstructionCost: number;
  fixtureCost: number;
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

type TabView = 'form' | 'history';

const EstimatePreview: React.FC = () => {
  const [form, setForm] = useState<EstimateForm>({
    projectName: '',
    clientName: '',
    areaSize: 0,
    grade: '',
    finishType: '',
    bathroomCount: 1,
    ceilingHeight: '표준',
    includeSash: false,
    includeFloorHeating: false,
    includeAircon: false
  });

  const [result, setResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>([]);
  const [activeTab, setActiveTab] = useState<TabView>('form');
  const [selectedEstimate, setSelectedEstimate] = useState<SavedEstimate | null>(null);

  useEffect(() => {
    loadEstimateHistory();
  }, []);

  const loadEstimateHistory = async () => {
    try {
      const response = await api.get('/estimate-preview/list');
      setSavedEstimates(response.data);
    } catch (error) {
      console.error('가견적서 목록 로드 실패:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'areaSize' || name === 'bathroomCount') {
      setForm(prev => ({ ...prev, [name]: Number(value) || 0 }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const calculateEstimate = async () => {
    // 유효성 검사
    if (!form.projectName || !form.clientName) {
      toast.error('프로젝트명과 고객명을 입력해주세요');
      return;
    }
    if (!form.areaSize || form.areaSize <= 0) {
      toast.error('평수를 올바르게 입력해주세요');
      return;
    }
    if (!form.grade) {
      toast.error('등급을 선택해주세요');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/estimate-preview/create', form);
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

  const loadEstimate = async (id: number) => {
    try {
      const response = await api.get(`/estimate-preview/${id}`);
      const data = response.data;

      // 폼 데이터 설정
      setForm({
        projectName: data.project_name,
        clientName: data.client_name,
        areaSize: data.area_size,
        grade: data.grade,
        finishType: data.finish_type || '',
        bathroomCount: data.bathroom_count,
        ceilingHeight: data.ceiling_height,
        includeSash: data.include_sash === 1,
        includeFloorHeating: data.include_floor_heating === 1,
        includeAircon: data.include_aircon === 1
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
      grade: '',
      finishType: '',
      bathroomCount: 1,
      ceilingHeight: '표준',
      includeSash: false,
      includeFloorHeating: false,
      includeAircon: false
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
    <div className="space-y-3 md:space-y-4">
      {/* Tabs */}
      <div className="border-b border-gray-200 flex items-center justify-between">
        <nav className="flex space-x-4 md:space-x-8">
          {[
            { id: 'form' as TabView, label: '견적 작성', icon: Calculator },
            { id: 'history' as TabView, label: '저장된 견적', count: stats.total, icon: Clock }
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
              <tab.icon className="h-4 w-4" />
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

      {activeTab === 'form' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* 입력 폼 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-500" />
              견적 정보 입력
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
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
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    고객명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="clientName"
                    value={form.clientName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                    placeholder="예: 홍길동"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
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
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    등급 <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="grade"
                    value={form.grade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  >
                    <option value="">선택하세요</option>
                    <option value="알뜰">알뜰</option>
                    <option value="기본">기본</option>
                    <option value="고급">고급</option>
                    <option value="하이엔드">하이엔드</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    마감재 종류
                  </label>
                  <input
                    type="text"
                    name="finishType"
                    value={form.finishType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                    placeholder="예: 타일, 마루"
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    화장실 개수
                  </label>
                  <input
                    type="number"
                    name="bathroomCount"
                    value={form.bathroomCount}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  층고
                </label>
                <select
                  name="ceilingHeight"
                  value={form.ceilingHeight}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                >
                  <option value="표준">표준</option>
                  <option value="높음">높음 (+10%)</option>
                  <option value="매우높음">매우높음 (+20%)</option>
                </select>
              </div>

              <div className="border-t pt-4">
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                  추가 공사 항목
                </label>
                <div className="space-y-2">
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      name="includeSash"
                      checked={form.includeSash}
                      onChange={handleInputChange}
                      className="mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400"
                    />
                    <span className="text-gray-700">샤시 공사 포함</span>
                  </label>
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      name="includeFloorHeating"
                      checked={form.includeFloorHeating}
                      onChange={handleInputChange}
                      className="mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400"
                    />
                    <span className="text-gray-700">바닥난방배관 공사</span>
                  </label>
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      name="includeAircon"
                      checked={form.includeAircon}
                      onChange={handleInputChange}
                      className="mr-2 rounded border-gray-300 text-gray-600 focus:ring-gray-400"
                    />
                    <span className="text-gray-700">에어컨 공사</span>
                  </label>
                </div>
              </div>

              <button
                onClick={calculateEstimate}
                disabled={loading}
                className="w-full py-3 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base transition-colors"
              >
                <Calculator className="h-4 w-4 md:h-5 md:w-5" />
                {loading ? '계산 중...' : '견적 계산'}
              </button>
            </div>
          </div>

          {/* 결과 표시 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
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
                      <tr>
                        <td className="px-4 py-2 text-xs md:text-sm text-gray-900">집기류 ({form.grade})</td>
                        <td className="px-4 py-2 text-xs md:text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(result.fixtureCost)}
                        </td>
                      </tr>
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
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 md:p-6 border-b border-gray-200">
            <h2 className="text-base md:text-lg font-semibold text-gray-800">저장된 가견적서 ({stats.total})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">프로젝트명</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">고객명</th>
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
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {estimate.client_name}
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
    </div>
  );
};

export default EstimatePreview;