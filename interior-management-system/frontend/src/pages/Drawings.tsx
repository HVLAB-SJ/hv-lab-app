import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFilteredProjects } from '../hooks/useFilteredProjects';
import { FileImage, Trash2, Square, ArrowLeft, X } from 'lucide-react';
import { drawingStorage } from '../utils/drawingStorage';

// 도면 종류
const DRAWING_TYPES = [
  '네이버도면',
  '건축도면',
  '평면도',
  '3D도면',
  '철거도면',
  '전기도면',
  '설비도면',
  '목공도면',
  '타일도면',
  '금속도면',
  '가구도면',
  '세라믹도면',
  '디테일도면',
  '천장도면'
];

// 전기 심볼 종류
const ELECTRIC_SYMBOLS = [
  { id: 'outlet-1', name: '콘센트 1구', symbol: 'C1', count: 1, color: '#ef4444', category: 'outlet' },
  { id: 'outlet-2', name: '콘센트 2구', symbol: 'C2', count: 2, color: '#ef4444', category: 'outlet' },
  { id: 'outlet-3', name: '콘센트 3구', symbol: 'C3', count: 3, color: '#ef4444', category: 'outlet' },
  { id: 'outlet-4', name: '콘센트 4구', symbol: 'C4', count: 4, color: '#ef4444', category: 'outlet' },
  { id: 'switch-1', name: '스위치 1구', symbol: 'S1', count: 1, color: '#3b82f6', category: 'switch' },
  { id: 'switch-2', name: '스위치 2구', symbol: 'S2', count: 2, color: '#3b82f6', category: 'switch' },
  { id: 'switch-3', name: '스위치 3구', symbol: 'S3', count: 3, color: '#3b82f6', category: 'switch' },
  { id: 'switch-4', name: '스위치 4구', symbol: 'S4', count: 4, color: '#3b82f6', category: 'switch' },
  { id: 'switch-5', name: '스위치 5구', symbol: 'S5', count: 5, color: '#3b82f6', category: 'switch' },
  { id: 'switch-6', name: '스위치 6구', symbol: 'S6', count: 6, color: '#3b82f6', category: 'switch' },
  { id: 'switch-7', name: '스위치 7구', symbol: 'S7', count: 7, color: '#3b82f6', category: 'switch' },
  { id: 'switch-8', name: '스위치 8구', symbol: 'S8', count: 8, color: '#3b82f6', category: 'switch' },
  { id: 'light', name: '조명', symbol: '●', count: 1, color: '#f59e0b', category: 'light' }
];

interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Marker {
  id: string;
  x: number;
  y: number;
  roomId: string | null;
  roomX?: number;
  roomY?: number;
  type: string;
  label: string;
  details?: string;
}

interface DrawingData {
  type: string;
  projectId: string;
  imageUrl: string;
  markers: Marker[];
  rooms: Room[];
  lastModified: Date;
  // 네이버도면 전용 필드
  naverTypeSqm?: string;
  naverTypePyeong?: string;
  naverArea?: string;
}

const Drawings = () => {
  const { user } = useAuth();
  const projects = useFilteredProjects();

  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedDrawingType, setSelectedDrawingType] = useState('네이버도면');
  const [selectedSymbol, setSelectedSymbol] = useState(ELECTRIC_SYMBOLS[0].id);
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // 네이버도면 전용 필드
  const [naverTypeSqm, setNaverTypeSqm] = useState<string>(''); // 제곱미터
  const [naverTypePyeong, setNaverTypePyeong] = useState<string>(''); // 평
  const [naverArea, setNaverArea] = useState<string>('');

  // 작업 모드
  const [workMode, setWorkMode] = useState<'marker' | 'room'>('marker');
  const [viewMode, setViewMode] = useState<'full' | 'room'>('full');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [draggedMarkerId, setDraggedMarkerId] = useState<string | null>(null);

  // 영역 그리기 상태
  const [isDrawingRoom, setIsDrawingRoom] = useState(false);
  const [roomDrawStart, setRoomDrawStart] = useState<{x: number, y: number} | null>(null);
  const [roomDrawCurrent, setRoomDrawCurrent] = useState<{x: number, y: number} | null>(null);

  // 영역 이름 입력 모달
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [pendingRoom, setPendingRoom] = useState<Omit<Room, 'id' | 'name'> | null>(null);

  // 이미지 팝업 상태
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 파일 드래그 상태
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoadingRef = useRef(false); // 데이터 로딩 중 플래그
  const hasMigratedRef = useRef(false); // 마이그레이션 완료 플래그
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 저장 디바운스용

  // 로컬 저장소(localStorage/IndexedDB)에서 서버로 데이터 마이그레이션 (최초 1회만)
  useEffect(() => {
    if (user?.id && !hasMigratedRef.current) {
      hasMigratedRef.current = true;
      drawingStorage.migrateFromLocalStorage(user.id).then(count => {
        if (count > 0) {
          console.log(`✅ ${count}개의 도면을 서버로 마이그레이션했습니다.`);
        }
      }).catch(error => {
        console.error('마이그레이션 실패:', error);
      });
    }
  }, [user?.id]);

  // Load from localStorage when user and projects are ready (only if not selected)
  useEffect(() => {
    if (user?.id && projects.length > 0 && !selectedProject) {
      const savedProjectId = localStorage.getItem(`drawings-selected-project-${user.id}`);

      if (savedProjectId) {
        const projectExists = projects.some(p => p.id === savedProjectId);
        if (projectExists) {
          setSelectedProject(savedProjectId);
        }
      }
    }
  }, [user?.id, projects, selectedProject]);

  // Load drawing type from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      const savedDrawingType = localStorage.getItem(`drawings-selected-type-${user.id}`);
      if (savedDrawingType && DRAWING_TYPES.includes(savedDrawingType)) {
        setSelectedDrawingType(savedDrawingType);
      }
    }
  }, [user?.id]);

  // Save selected project to localStorage when it changes
  useEffect(() => {
    if (user?.id && selectedProject) {
      localStorage.setItem(`drawings-selected-project-${user.id}`, selectedProject);
    }
  }, [user?.id, selectedProject]);

  // Save selected drawing type to localStorage when it changes
  useEffect(() => {
    if (user?.id && selectedDrawingType) {
      localStorage.setItem(`drawings-selected-type-${user.id}`, selectedDrawingType);
    }
  }, [user?.id, selectedDrawingType]);

  // Load drawing data when project or drawing type changes
  useEffect(() => {
    if (user?.id && selectedProject && selectedDrawingType) {
      isLoadingRef.current = true; // 로딩 시작
      const key = `drawing-${user.id}-${selectedProject}-${selectedDrawingType}`;

      // IndexedDB에서 데이터 로드 (비동기)
      drawingStorage.getItem(key).then(data => {
        if (data) {
          setUploadedImage(data.imageUrl || '');
          setMarkers(data.markers || []);
          setRooms(data.rooms || []);
          // 네이버도면 필드 로드
          setNaverTypeSqm(data.naverTypeSqm || '');
          setNaverTypePyeong(data.naverTypePyeong || '');
          setNaverArea(data.naverArea || '');
        } else {
          // Clear current data if no saved data exists
          setUploadedImage('');
          setMarkers([]);
          setRooms([]);
          setNaverTypeSqm('');
          setNaverTypePyeong('');
          setNaverArea('');
        }
        // Reset view mode when switching drawings
        setViewMode('full');
        setSelectedRoomId(null);

        // 로딩 완료 - 다음 렌더 사이클에서 저장 가능하도록 설정
        setTimeout(() => {
          isLoadingRef.current = false;
        }, 0);
      }).catch(error => {
        console.error('Failed to load drawing data:', error);
        // 에러 발생 시에도 초기화
        setUploadedImage('');
        setMarkers([]);
        setRooms([]);
        setNaverTypeSqm('');
        setNaverTypePyeong('');
        setNaverArea('');
        setViewMode('full');
        setSelectedRoomId(null);
        isLoadingRef.current = false;
      });
    }
  }, [user?.id, selectedProject, selectedDrawingType]);

  // Save drawing data when image, markers, or rooms change (with debounce)
  useEffect(() => {
    // 로딩 중이면 저장하지 않음 (무한 루프 방지)
    if (isLoadingRef.current) {
      return;
    }

    if (user?.id && selectedProject && selectedDrawingType && uploadedImage) {
      // 이전 타이머 취소
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 500ms 디바운스로 서버 요청 최적화
      saveTimeoutRef.current = setTimeout(async () => {
        const key = `drawing-${user.id}-${selectedProject}-${selectedDrawingType}`;
        const data: DrawingData = {
          type: selectedDrawingType,
          projectId: selectedProject,
          imageUrl: uploadedImage,
          markers,
          rooms,
          lastModified: new Date(),
          naverTypeSqm,
          naverTypePyeong,
          naverArea
        };

        try {
          // 서버에 저장 (비동기)
          await drawingStorage.setItem(key, data, user.id);
          console.log('✅ 도면 저장 완료');
        } catch (error: any) {
          console.error('Failed to save drawing data:', error);
          const errorMsg = error.response?.data?.error || error.message || '알 수 없는 오류';
          const statusCode = error.response?.status || '';
          alert(`도면 저장 실패: ${statusCode ? `[${statusCode}] ` : ''}${errorMsg}`);
        }
      }, 500);
    }

    // 컴포넌트 언마운트 시 타이머 정리
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [user?.id, selectedProject, selectedDrawingType, uploadedImage, markers, rooms, naverTypeSqm, naverTypePyeong, naverArea]);

  // 업로드 상태
  const [isUploading, setIsUploading] = useState(false);

  // 이미지 파일 처리 함수 (서버 업로드 방식)
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // 파일 크기 체크 (20MB)
    if (file.size > 20 * 1024 * 1024) {
      alert('파일 크기가 20MB를 초과합니다.');
      return;
    }

    setIsUploading(true);
    try {
      // 서버에 파일 업로드
      const imageUrl = await drawingStorage.uploadImage(file);
      console.log(`📸 이미지 업로드 완료: ${imageUrl}`);
      setUploadedImage(imageUrl);
    } catch (error: any) {
      console.error('이미지 업로드 실패:', error);
      alert(error.message || '이미지 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // 파일 선택 핸들러
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // Reset input value to allow re-uploading same file
    e.target.value = '';
  };

  // 클립보드 붙여넣기 핸들러
  const handlePaste = (e: ClipboardEvent) => {
    if (!selectedProject) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          break;
        }
      }
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // 클립보드 이벤트 리스너
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [selectedProject]);

  // 이미지 확대/축소 핸들러 (마우스 위치 기준)
  const handleImageWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    // 부드러운 확대/축소를 위한 배율 방식 사용
    const zoomSpeed = 0.15; // 15%씩 확대/축소
    const direction = e.deltaY > 0 ? -1 : 1;
    const scaleFactor = 1 + (direction * zoomSpeed);
    const newScale = Math.min(Math.max(0.5, imageScale * scaleFactor), 5);

    // 마우스 위치 기준으로 확대/축소
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    // 스케일 변화에 따른 위치 조정
    const scaleChange = newScale / imageScale;
    const newX = mouseX - (mouseX - imagePosition.x) * scaleChange;
    const newY = mouseY - (mouseY - imagePosition.y) * scaleChange;

    setImageScale(newScale);
    setImagePosition({ x: newX, y: newY });
  };

  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // 좌클릭만
      setIsDraggingImage(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (isDraggingImage) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleImageMouseUp = () => {
    setIsDraggingImage(false);
  };

  const handleImageDoubleClick = () => {
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const resetImageModal = () => {
    setShowImageModal(false);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
    setIsDraggingImage(false);
  };

  // 캔버스 클릭/드래그 처리
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!uploadedImage || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let x, y;

    // 영역 확대 모드일 때 좌표 변환
    if (viewMode === 'room' && selectedRoomId) {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (!room || !imageRef.current) return;

      // 실제 이미지 크기
      const naturalWidth = imageRef.current.naturalWidth;
      const naturalHeight = imageRef.current.naturalHeight;
      if (!naturalWidth || !naturalHeight) return;

      // 실제 이미지의 비율
      const imageAspect = naturalWidth / naturalHeight;
      const containerAspect = rect.width / rect.height;

      // object-contain 방식으로 표시되는 실제 크기 계산
      let displayWidth, displayHeight, offsetX, offsetY;

      if (containerAspect > imageAspect) {
        // 컨테이너가 더 넓음 - 좌우 여백
        displayHeight = rect.height;
        displayWidth = rect.height * imageAspect;
        offsetX = (rect.width - displayWidth) / 2;
        offsetY = 0;
      } else {
        // 컨테이너가 더 높음 - 상하 여백
        displayWidth = rect.width;
        displayHeight = rect.width / imageAspect;
        offsetX = 0;
        offsetY = (rect.height - displayHeight) / 2;
      }

      // 여백을 제외한 클릭 위치
      const adjustedX = clickX - offsetX;
      const adjustedY = clickY - offsetY;

      // 여백 영역 클릭 시 무시
      if (adjustedX < 0 || adjustedX > displayWidth || adjustedY < 0 || adjustedY > displayHeight) {
        return;
      }

      // 클릭 위치를 전체 이미지 기준 백분율로 변환
      x = (adjustedX / displayWidth) * 100;
      y = (adjustedY / displayHeight) * 100;
    } else {
      // 전체 보기 모드 - 동일한 로직 사용
      if (!imageRef.current) return;

      const naturalWidth = imageRef.current.naturalWidth;
      const naturalHeight = imageRef.current.naturalHeight;
      if (!naturalWidth || !naturalHeight) return;

      const imageAspect = naturalWidth / naturalHeight;
      const containerAspect = rect.width / rect.height;

      let displayWidth, displayHeight, offsetX, offsetY;

      if (containerAspect > imageAspect) {
        displayHeight = rect.height;
        displayWidth = rect.height * imageAspect;
        offsetX = (rect.width - displayWidth) / 2;
        offsetY = 0;
      } else {
        displayWidth = rect.width;
        displayHeight = rect.width / imageAspect;
        offsetX = 0;
        offsetY = (rect.height - displayHeight) / 2;
      }

      const adjustedX = clickX - offsetX;
      const adjustedY = clickY - offsetY;

      if (adjustedX < 0 || adjustedX > displayWidth || adjustedY < 0 || adjustedY > displayHeight) {
        return;
      }

      x = (adjustedX / displayWidth) * 100;
      y = (adjustedY / displayHeight) * 100;
    }

    if (workMode === 'room') {
      // 영역 그리기 시작
      setIsDrawingRoom(true);
      setRoomDrawStart({ x, y });
      setRoomDrawCurrent({ x, y });
    } else if (selectedDrawingType === '전기도면') {
      // 마커 추가 모드 (전기도면에서만)
      if (isDragging) return;

      const symbolInfo = ELECTRIC_SYMBOLS.find(s => s.id === selectedSymbol);

      let roomId = null;
      let roomX = undefined;
      let roomY = undefined;

      // 선택된 영역이 있으면 해당 영역에 마커 추가
      if (viewMode === 'room' && selectedRoomId) {
        const room = rooms.find(r => r.id === selectedRoomId);
        if (room) {
          roomId = selectedRoomId;
          roomX = ((x - room.x) / room.width) * 100;
          roomY = ((y - room.y) / room.height) * 100;
        }
      }

      const newMarker: Marker = {
        id: `marker-${Date.now()}`,
        x,
        y,
        roomId,
        roomX,
        roomY,
        type: selectedSymbol,
        label: symbolInfo?.name || '',
        details: ''
      };

      setMarkers([...markers, newMarker]);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!uploadedImage || !canvasRef.current || !imageRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const naturalWidth = imageRef.current.naturalWidth;
    const naturalHeight = imageRef.current.naturalHeight;
    if (!naturalWidth || !naturalHeight) return;

    const imageAspect = naturalWidth / naturalHeight;
    const containerAspect = rect.width / rect.height;

    let displayWidth, displayHeight, offsetX, offsetY;

    if (containerAspect > imageAspect) {
      displayHeight = rect.height;
      displayWidth = rect.height * imageAspect;
      offsetX = (rect.width - displayWidth) / 2;
      offsetY = 0;
    } else {
      displayWidth = rect.width;
      displayHeight = rect.width / imageAspect;
      offsetX = 0;
      offsetY = (rect.height - displayHeight) / 2;
    }

    const adjustedX = clickX - offsetX;
    const adjustedY = clickY - offsetY;

    if (adjustedX < 0 || adjustedX > displayWidth || adjustedY < 0 || adjustedY > displayHeight) {
      return;
    }

    const x = (adjustedX / displayWidth) * 100;
    const y = (adjustedY / displayHeight) * 100;

    if (isDrawingRoom && roomDrawStart) {
      // 영역 그리기 중
      setRoomDrawCurrent({ x, y });
    } else if (isDragging && draggedMarkerId) {
      // 마커 드래그 중
      const draggedMarker = markers.find(m => m.id === draggedMarkerId);
      if (draggedMarker && viewMode === 'room' && selectedRoomId) {
        const room = rooms.find(r => r.id === selectedRoomId);
        if (room) {
          // 영역 내 상대 좌표도 업데이트
          const roomX = ((x - room.x) / room.width) * 100;
          const roomY = ((y - room.y) / room.height) * 100;
          setMarkers(markers.map(m =>
            m.id === draggedMarkerId ? { ...m, x, y, roomX, roomY } : m
          ));
          return;
        }
      }
      setMarkers(markers.map(m =>
        m.id === draggedMarkerId ? { ...m, x, y } : m
      ));
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDrawingRoom && roomDrawStart && roomDrawCurrent) {
      // 영역 그리기 완료
      const x = Math.min(roomDrawStart.x, roomDrawCurrent.x);
      const y = Math.min(roomDrawStart.y, roomDrawCurrent.y);
      const width = Math.abs(roomDrawCurrent.x - roomDrawStart.x);
      const height = Math.abs(roomDrawCurrent.y - roomDrawStart.y);

      // 최소 크기 체크
      if (width > 2 && height > 2) {
        setPendingRoom({ x, y, width, height });
        setShowRoomNameModal(true);
      }

      setIsDrawingRoom(false);
      setRoomDrawStart(null);
      setRoomDrawCurrent(null);
    }

    setIsDragging(false);
    setDraggedMarkerId(null);
  };

  // 영역 이름 저장
  const handleSaveRoomName = () => {
    if (pendingRoom && newRoomName.trim()) {
      const newRoom: Room = {
        id: `room-${Date.now()}`,
        name: newRoomName.trim(),
        ...pendingRoom
      };
      setRooms([...rooms, newRoom]);
      setShowRoomNameModal(false);
      setNewRoomName('');
      setPendingRoom(null);
      // 영역 그리기 모드 유지 (사용자가 직접 토글할 때까지)
    }
  };

  // 마커 드래그 시작
  const handleMarkerMouseDown = (e: React.MouseEvent, markerId: string) => {
    e.stopPropagation();
    setIsDragging(true);
    setDraggedMarkerId(markerId);
  };

  // 마커 삭제
  const handleDeleteMarker = (markerId: string) => {
    setMarkers(markers.filter(m => m.id !== markerId));
  };

  // 영역 삭제
  const handleDeleteRoom = (roomId: string) => {
    setRooms(rooms.filter(r => r.id !== roomId));
    // 해당 영역의 마커도 삭제
    setMarkers(markers.filter(m => m.roomId !== roomId));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
      setViewMode('full');
    }
  };

  // 영역 클릭 - 확대 보기
  const handleRoomClick = (roomId: string) => {
    setSelectedRoomId(roomId);
    setViewMode('room');
  };

  // 전체 보기로 돌아가기
  const handleBackToFull = () => {
    setViewMode('full');
    setSelectedRoomId(null);
  };

  // 수량 계산
  const getSymbolCount = (symbolId: string, roomId?: string) => {
    if (roomId) {
      return markers.filter(m => m.type === symbolId && m.roomId === roomId).length;
    }
    return markers.filter(m => m.type === symbolId).length;
  };

  // 현재 보여줄 마커 계산
  const getVisibleMarkers = () => {
    if (viewMode === 'room' && selectedRoomId) {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (!room) return [];

      // 해당 영역의 마커만 반환, 영역 기준 좌표로 변환
      return markers
        .filter(m => m.roomId === selectedRoomId)
        .map(m => ({
          ...m,
          x: room.x + (m.roomX || 0) * room.width / 100,
          y: room.y + (m.roomY || 0) * room.height / 100
        }));
    }
    return markers;
  };

  // 선택된 영역
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  // 도면 종류에서 "도면" 제거하는 함수
  const removeDrawingText = (text: string) => {
    return text.replace('도면', '');
  };

  return (
    <div className="h-full flex flex-col">
      {/* 상단 헤더 */}
      <div className="bg-white border-b px-3 md:px-6 py-3 flex-shrink-0">
        {/* 모바일 레이아웃 */}
        <div className="md:hidden">
          {/* 첫 번째 줄: 프로젝트 선택 (우측 정렬) */}
          <div className="flex justify-end mb-3">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="input max-w-[200px] text-sm"
            >
              <option value="">프로젝트 선택</option>
              {projects
                .filter(p => p.status !== 'completed')
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
          </div>

          {/* 도면 종류 버튼들 (3행 그리드) */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            {DRAWING_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedDrawingType(type)}
                className={`px-2 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
                  selectedDrawingType === type
                    ? 'bg-gray-900 text-white font-medium'
                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {removeDrawingText(type)}
              </button>
            ))}
          </div>


          {/* 영역 보기 모드일 때 전체 보기 버튼 (모바일) */}
          {viewMode === 'room' && selectedRoom && (
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={handleBackToFull}
                className="btn btn-outline text-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                전체 보기
              </button>
              <span className="text-base font-semibold text-gray-900">{selectedRoom.name}</span>
            </div>
          )}
        </div>

        {/* 데스크톱 레이아웃 */}
        <div className="hidden md:flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-80">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="input w-full"
              >
                <option value="">프로젝트를 선택하세요</option>
                {projects
                  .filter(p => p.status !== 'completed')
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* 네이버도면 전용 입력 필드 (데스크톱) */}
            {selectedDrawingType === '네이버도면' && selectedProject && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">타입</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={naverTypeSqm}
                      onChange={(e) => setNaverTypeSqm(e.target.value)}
                      placeholder="예: 136E"
                      className="input w-28 h-[42px]"
                    />
                    <span className="text-sm font-medium text-gray-700">㎡</span>
                  </div>
                  <span className="text-gray-400">/</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={naverTypePyeong}
                      onChange={(e) => setNaverTypePyeong(e.target.value)}
                      placeholder="예: 41E"
                      className="input w-24 h-[42px]"
                    />
                    <span className="text-sm font-medium text-gray-700">평</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">공급/전용</span>
                  <input
                    type="text"
                    value={naverArea}
                    onChange={(e) => setNaverArea(e.target.value)}
                    placeholder="예: 136.21㎡/101.97㎡(전용률 75%)"
                    className="input w-80 h-[42px]"
                  />
                </div>
              </>
            )}
          </div>

          {viewMode === 'room' && selectedRoom && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToFull}
                className="btn btn-outline text-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                전체 보기
              </button>
              <span className="text-lg font-semibold text-gray-900">{selectedRoom.name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* 좌측: 도면 종류 및 영역 목록 - 데스크톱에서만 표시 */}
        <div className="hidden md:block w-48 bg-white border-r flex-shrink-0 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">도면 종류</h3>
            <div className="space-y-1 mb-6">
              {DRAWING_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedDrawingType(type)}
                  className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors ${
                    selectedDrawingType === type
                      ? 'bg-gray-900 text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {selectedProject && selectedDrawingType === '전기도면' && uploadedImage && (
              <>
                <div className="mb-6">
                  <button
                    onClick={() => setWorkMode(workMode === 'room' ? 'marker' : 'room')}
                    className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors flex items-center font-medium ${
                      workMode === 'room'
                        ? 'bg-green-700 text-white'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <Square className="w-4 h-4 mr-2" />
                    {workMode === 'room' ? '영역 그리기 중...' : '영역 그리기'}
                  </button>
                </div>

                {rooms.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">영역 목록</h3>
                    <div className="space-y-1">
                      {rooms.map((room) => (
                        <div
                          key={room.id}
                          className={`w-full text-left px-3 py-2.5 rounded text-sm transition-colors flex items-center justify-between group ${
                            selectedRoomId === room.id
                              ? 'bg-purple-600 text-white font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <button
                            onClick={() => handleRoomClick(room.id)}
                            className="flex-1 text-left"
                          >
                            {room.name}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRoom(room.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 ml-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {selectedProject ? (
          <>

          {/* 중앙: 작업 영역 */}
          <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 모바일에서 네이버 도면 입력 필드 */}
              {selectedDrawingType === '네이버도면' && selectedProject && (
                <div className="md:hidden bg-white border-b px-3 py-3">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">평면도 타입</label>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={naverTypeSqm}
                            onChange={(e) => setNaverTypeSqm(e.target.value)}
                            placeholder="136E"
                            className="input w-24 h-[36px] text-sm"
                          />
                          <span className="text-xs font-medium text-gray-700">㎡</span>
                        </div>
                        <span className="text-gray-400">/</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={naverTypePyeong}
                            onChange={(e) => setNaverTypePyeong(e.target.value)}
                            placeholder="41E"
                            className="input w-20 h-[36px] text-sm"
                          />
                          <span className="text-xs font-medium text-gray-700">평</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">면적 정보</label>
                      <input
                        type="text"
                        value={naverArea}
                        onChange={(e) => setNaverArea(e.target.value)}
                        placeholder="136.21㎡/101.97㎡ (전용률 75%)"
                        className="input w-full h-[36px] text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 캔버스 영역 */}
              <div className={`overflow-hidden p-3 md:p-6 flex-1`}>
                {uploadedImage ? (
                  <div className="relative w-full h-full bg-white rounded-lg shadow-lg overflow-hidden">
                    <div
                      ref={canvasRef}
                      className={`relative w-full h-full ${
                        workMode === 'room' ? 'cursor-crosshair' : 'cursor-default'
                      }`}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                    >
                      <img
                        ref={imageRef}
                        src={uploadedImage}
                        alt="평면도"
                        className="w-full h-full object-contain select-none"
                        draggable={false}
                        onClick={() => setShowImageModal(true)}
                        style={
                          viewMode === 'room' && selectedRoom
                            ? (() => {
                                // 비율 유지를 위해 더 큰 scale 값 사용
                                const scaleX = 100 / selectedRoom.width;
                                const scaleY = 100 / selectedRoom.height;
                                const scale = Math.max(scaleX, scaleY);

                                // 영역의 중심점 계산
                                const centerX = selectedRoom.x + selectedRoom.width / 2;
                                const centerY = selectedRoom.y + selectedRoom.height / 2;

                                return {
                                  objectFit: 'none',
                                  transform: `scale(${scale}) translate(${(50 - centerX) / scale}%, ${(50 - centerY) / scale}%)`,
                                  transformOrigin: '0 0',
                                  pointerEvents: 'auto',
                                  cursor: 'pointer'
                                };
                              })()
                            : {
                                pointerEvents: 'auto',
                                cursor: 'pointer'
                              }
                        }
                      />

                    {/* 영역 표시 (전체 보기 모드) */}
                    {viewMode === 'full' && rooms.map((room) => (
                      <div
                        key={room.id}
                        className="absolute border-2 border-purple-500 bg-purple-500 bg-opacity-10 hover:bg-opacity-20 transition-all cursor-pointer group"
                        style={{
                          left: `${room.x}%`,
                          top: `${room.y}%`,
                          width: `${room.width}%`,
                          height: `${room.height}%`
                        }}
                        onClick={() => handleRoomClick(room.id)}
                      >
                        <div className="absolute top-1 left-1 bg-purple-600 text-white px-2 py-0.5 rounded text-xs font-medium">
                          {room.name}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoom(room.id);
                          }}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {/* 영역 그리기 중 */}
                    {isDrawingRoom && roomDrawStart && roomDrawCurrent && (
                      <div
                        className="absolute border-2 border-dashed border-green-500 bg-green-500 bg-opacity-10"
                        style={{
                          left: `${Math.min(roomDrawStart.x, roomDrawCurrent.x)}%`,
                          top: `${Math.min(roomDrawStart.y, roomDrawCurrent.y)}%`,
                          width: `${Math.abs(roomDrawCurrent.x - roomDrawStart.x)}%`,
                          height: `${Math.abs(roomDrawCurrent.y - roomDrawStart.y)}%`
                        }}
                      />
                    )}

                    {/* 마커들 */}
                    {getVisibleMarkers().map((marker) => {
                      const symbolInfo = ELECTRIC_SYMBOLS.find(s => s.id === marker.type);
                      return (
                        <div
                          key={marker.id}
                          onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move group"
                          style={{
                            left: `${marker.x}%`,
                            top: `${marker.y}%`
                          }}
                        >
                          {symbolInfo?.category === 'light' ? (
                            <div
                              className="rounded-full shadow-md transition-transform group-hover:scale-110"
                              style={{
                                backgroundColor: symbolInfo.color,
                                width: '16px',
                                height: '16px'
                              }}
                            />
                          ) : (
                            <div
                              className="flex items-center justify-center bg-white rounded shadow-md transition-transform group-hover:scale-110"
                              style={{
                                borderColor: symbolInfo?.color,
                                color: symbolInfo?.color,
                                border: '1.5px solid',
                                padding: '2px 4px',
                                fontSize: '10px',
                                fontWeight: '600',
                                minWidth: '20px',
                                minHeight: '20px'
                              }}
                            >
                              {symbolInfo?.symbol}
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMarker(marker.id);
                            }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex flex-col items-center justify-center h-full bg-white rounded-lg shadow-lg text-gray-500 transition-all ${
                      isDraggingFile ? 'border-4 border-dashed border-blue-500 bg-blue-50' : ''
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {isUploading ? (
                      <>
                        <div className="w-20 h-20 mb-4 flex items-center justify-center">
                          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <p className="text-base mb-2 font-semibold text-blue-600">
                          이미지 업로드 중...
                        </p>
                        <p className="text-sm text-gray-400">
                          잠시만 기다려주세요
                        </p>
                      </>
                    ) : (
                      <>
                        <FileImage className={`w-20 h-20 mb-4 transition-colors ${
                          isDraggingFile ? 'text-blue-500' : 'text-gray-400'
                        }`} />
                        <p className="text-base mb-2 font-semibold">
                          {isDraggingFile ? '이미지를 여기에 놓으세요' : '도면 이미지를 업로드하세요'}
                        </p>
                        <p className="text-sm mb-4 text-gray-400">
                          파일 선택, 드래그 앤 드롭, 또는 Ctrl+V로 붙여넣기
                        </p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                        >
                          파일 선택
                        </button>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* 하단 툴바 */}
              {selectedDrawingType === '전기도면' && uploadedImage && workMode === 'marker' && (
                <div className="bg-white border-t px-6 py-3 flex-shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-700 mr-2">C: 콘센트 / S: 스위치 / ●: 조명</span>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    {ELECTRIC_SYMBOLS.map((symbol) => (
                      <button
                        key={symbol.id}
                        onClick={() => setSelectedSymbol(symbol.id)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                          selectedSymbol === symbol.id
                            ? 'bg-gray-900 text-white shadow-md'
                            : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-900'
                        }`}
                        style={{
                          borderColor: selectedSymbol === symbol.id ? undefined : symbol.color,
                          borderWidth: selectedSymbol === symbol.id ? undefined : '1.5px'
                        }}
                      >
                        <span className="text-sm font-semibold" style={{ color: selectedSymbol === symbol.id ? 'white' : symbol.color }}>
                          {symbol.symbol}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 수량 집계 - 데스크톱에서만 우측, 모바일에서는 하단 */}
          <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l flex-shrink-0 overflow-y-auto">
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">수량 집계</h3>
              {selectedDrawingType === '전기도면' && (
                <div className="space-y-2">
                  {ELECTRIC_SYMBOLS.map((symbol) => {
                    const count = getSymbolCount(symbol.id, viewMode === 'room' ? selectedRoomId || undefined : undefined);
                    if (count === 0) return null;
                    return (
                      <div
                        key={symbol.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                        style={{ borderColor: symbol.color, borderWidth: '1.5px' }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="text-base font-semibold px-2 py-1 bg-white rounded"
                            style={{
                              color: symbol.color,
                              border: `1.5px solid ${symbol.color}`
                            }}
                          >
                            {symbol.symbol}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{symbol.name}</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{count}개</span>
                      </div>
                    );
                  })}

                  {markers.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-12">
                      평면도에 마커를 추가하면<br />자동으로 수량이 집계됩니다
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <FileImage className="w-20 h-20 mx-auto mb-4 text-gray-400" />
              <p className="text-lg text-gray-600 mb-2">프로젝트를 선택하여 시작하세요</p>
              <p className="text-sm text-gray-500">도면을 업로드하고 전기/설비 위치를 표시할 수 있습니다</p>
            </div>
          </div>
        )}
      </div>

      {/* 영역 이름 입력 모달 */}
      {showRoomNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">영역 이름 입력</h3>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveRoomName();
                }
              }}
              placeholder="예: 거실, 침실1, 주방"
              className="input w-full mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRoomNameModal(false);
                  setNewRoomName('');
                  setPendingRoom(null);
                }}
                className="btn btn-outline"
              >
                취소
              </button>
              <button
                onClick={handleSaveRoomName}
                className="btn btn-primary"
                disabled={!newRoomName.trim()}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 전체화면 모달 */}
      {showImageModal && uploadedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={resetImageModal}
          onWheel={handleImageWheel}
          onMouseMove={handleImageMouseMove}
          onMouseUp={handleImageMouseUp}
          onMouseLeave={handleImageMouseUp}
        >
          <div className="relative w-full h-full p-8 flex items-center justify-center overflow-hidden">
            <button
              onClick={resetImageModal}
              className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center text-white transition-all z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* 확대/축소 안내 */}
            <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white text-xs px-3 py-2 rounded z-10">
              마우스 휠: 확대/축소 | 드래그: 이동 | 더블클릭: 초기화
            </div>

            <img
              src={uploadedImage}
              alt="도면 전체화면"
              className="object-contain select-none"
              style={{
                transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                cursor: isDraggingImage ? 'grabbing' : 'grab',
                transition: isDraggingImage ? 'none' : 'transform 0.1s ease-out',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={handleImageMouseDown}
              onDoubleClick={handleImageDoubleClick}
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Drawings;
