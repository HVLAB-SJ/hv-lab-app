import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataStore } from '../store/dataStore';
import type { Project } from '../store/dataStore';

/**
 * 사용자 권한에 따라 프로젝트를 필터링하는 커스텀 훅
 * - 안팀 사용자: 안팀이 담당자로 속한 프로젝트만 표시
 * - 다른 사용자: 모든 프로젝트 표시
 */
export const useFilteredProjects = () => {
  const { user } = useAuth();
  const { projects } = useDataStore();

  const filteredProjects = useMemo(() => {
    if (!user) return [];

    // 안팀 사용자인 경우 필터링 적용
    if (user.name === '안팀') {
      return projects.filter((project: Project) => {
        const managers = project.manager ? project.manager.split(',').map(m => m.trim()) : [];
        const isManager = managers.includes('안팀');
        const isTeamMember = project.team && Array.isArray(project.team) && project.team.includes('안팀');
        return isManager || isTeamMember;
      });
    }

    return projects;
  }, [user, projects]);

  return filteredProjects;
};