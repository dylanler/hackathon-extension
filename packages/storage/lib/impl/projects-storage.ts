import { createStorage } from '../base/base.js';
import { StorageEnum } from '../base/enums.js';

export type ProjectId = string;

export interface ScreenshotItem {
  id: string;
  dataUrl: string;
  filename: string; // relative to downloads directory
  createdAt: string; // ISO string
  pageTitle?: string;
  pageUrl?: string;
}

export interface ProjectRecord {
  id: ProjectId;
  title?: string;
  createdAt: string;
  screenshots: ScreenshotItem[];
}

export interface ProjectsState {
  currentProjectId?: ProjectId;
  projects: Record<ProjectId, ProjectRecord>;
}

const initialState: ProjectsState = {
  currentProjectId: undefined,
  projects: {},
};

export const projectsStorage = createStorage<ProjectsState>('projects-state', initialState, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});


