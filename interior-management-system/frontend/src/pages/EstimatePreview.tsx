import React, { useState, useEffect } from 'react';
import { Calculator, Download, Save, FileText, Plus, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
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
  const [showHistory, setShowHistory] = useState(false);
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
      setShowHistory(false);
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

  return (
    <div className="p-6 bg-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">가견적서</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            {showHistory ? '입력 폼' : '저장된 견적서'}
          </button>
          <button
            onClick={resetForm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            새 견적서
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">저장된 가견적서 목록</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">프로젝트명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">평수</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">등급</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">예상 금액</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {savedEstimates.map((estimate) => (
                  <tr key={estimate.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{estimate.project_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{estimate.client_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{estimate.area_size}평</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{estimate.grade}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatCurrency(estimate.total_min_cost)} ~ {formatCurrency(estimate.total_max_cost)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(estimate.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadEstimate(estimate.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteEstimate(estimate.id)}
                          className="text-red-600 hover:text-red-800"
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 입력 폼 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">견적 정보 입력</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    프로젝트명 *
                  </label>
                  <input
                    type="text"
                    name="projectName"
                    value={form.projectName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="예: 강남 오피스텔"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    고객명 *
                  </label>
                  <input
                    type="text"
                    name="clientName"
                    value={form.clientName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="예: 홍길동"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    평수 *
                  </label>
                  <input
                    type="number"
                    name="areaSize"
                    value={form.areaSize || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="예: 25"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    등급 *
                  </label>
                  <select
                    name="grade"
                    value={form.grade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">선택하세요</option>
                    <option value="알뜰">알뜰</option>
                    <option value="기본">기본</option>
                    <option value="고급">고급</option>
                    <option value="하이엔드">하이엔드</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    마감재 종류
                  </label>
                  <input
                    type="text"
                    name="finishType"
                    value={form.finishType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="예: 타일, 마루"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    화장실 개수
                  </label>
                  <input
                    type="number"
                    name="bathroomCount"
                    value={form.bathroomCount}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  층고
                </label>
                <select
                  name="ceilingHeight"
                  value={form.ceilingHeight}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="표준">표준</option>
                  <option value="높음">높음 (+10%)</option>
                  <option value="매우높음">매우높음 (+20%)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">추가 공사 항목</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="includeSash"
                      checked={form.includeSash}
                      onChange={handleInputChange}
                      className="mr-2 rounded border-gray-300"
                    />
                    <span className="text-sm">샤시 공사 포함</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="includeFloorHeating"
                      checked={form.includeFloorHeating}
                      onChange={handleInputChange}
                      className="mr-2 rounded border-gray-300"
                    />
                    <span className="text-sm">바닥난방배관 공사</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="includeAircon"
                      checked={form.includeAircon}
                      onChange={handleInputChange}
                      className="mr-2 rounded border-gray-300"
                    />
                    <span className="text-sm">에어컨 공사</span>
                  </label>
                </div>
              </div>

              <button
                onClick={calculateEstimate}
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Calculator className="h-5 w-5" />
                {loading ? '계산 중...' : '견적 계산'}
              </button>
            </div>
          </div>

          {/* 결과 표시 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">견적 결과</h2>
              {result && (
                <button
                  onClick={downloadPDF}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1 text-sm"
                >
                  <Download className="h-4 w-4" />
                  PDF 다운로드
                </button>
              )}
            </div>

            {result ? (
              <div className="space-y-4">
                {/* 총 예상 견적 */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">예상 견적 범위</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(result.totalMinCost)} ~ {formatCurrency(result.totalMaxCost)}
                    </p>
                  </div>
                </div>

                {/* 상세 내역 */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">항목</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">금액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-2 text-sm text-gray-900">기본 공사비</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {formatCurrency(result.baseConstructionCost)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-sm text-gray-900">집기류 ({form.grade})</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {formatCurrency(result.fixtureCost)}
                        </td>
                      </tr>
                      {result.sashCost > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900">샤시 공사</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(result.sashCost)}
                          </td>
                        </tr>
                      )}
                      {result.heatingCost > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900">바닥난방배관</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(result.heatingCost)}
                          </td>
                        </tr>
                      )}
                      {result.airconCost > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900">에어컨 공사</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(result.airconCost)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-4 py-2 text-sm font-semibold text-gray-900">합계</td>
                        <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
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

                <div className="text-sm text-gray-500 text-center mt-4">
                  * 실제 견적은 현장 상황에 따라 달라질 수 있습니다.
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-3" />
                <p>견적 정보를 입력하고 계산 버튼을 클릭하세요</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EstimatePreview;