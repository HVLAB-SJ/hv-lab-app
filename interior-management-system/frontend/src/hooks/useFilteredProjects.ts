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
    // 디버깅: 사용자 정보 로그
    console.log('[useFilteredProjects] Current user:', user);
    console.log('[useFilteredProjects] User name:', user?.name);
    console.log('[useFilteredProjects] Total projects:', projects.length);

    // 사용자가 없으면 빈 배열 반환
    if (!user) {
      console.log('[useFilteredProjects] No user, returning empty array');
      return [];
    }

    // 안팀 사용자인 경우 필터링 적용
    if (user.name === '안팀') {
      console.log('[useFilteredProjects] 안팀 user detected, applying filter');

      const filtered = projects.filter((project: Project) => {
        // manager 필드에 "안팀"이 포함되어 있는지 확인
        // manager는 쉼표로 구분된 문자열일 수 있음
        const managers = project.manager ? project.manager.split(',').map(m => m.trim()) : [];
        const isManager = managers.includes('안팀');

        // team 배열에 "안팀"이 포함되어 있는지 확인
        const isTeamMember = project.team && Array.isArray(project.team) && project.team.includes('안팀');

        // 디버깅: 각 프로젝트 확인
        console.log(`[useFilteredProjects] Project: ${project.name}`);
        console.log(`  - Manager: ${project.manager}`);
        console.log(`  - Managers array: ${JSON.stringify(managers)}`);
        console.log(`  - Team: ${JSON.stringify(project.team)}`);
        console.log(`  - Is Manager: ${isManager}`);
        console.log(`  - Is Team Member: ${isTeamMember}`);
        console.log(`  - Include: ${isManager || isTeamMember}`);

        // manager 또는 team에 포함되어 있으면 표시
        return isManager || isTeamMember;
      });

      console.log('[useFilteredProjects] Filtered projects count:', filtered.length);
      return filtered;
    }

    // 다른 사용자는 모든 프로젝트 표시
    console.log('[useFilteredProjects] Other user, returning all projects');
    return projects;
  }, [user, projects]);

  return filteredProjects;
};