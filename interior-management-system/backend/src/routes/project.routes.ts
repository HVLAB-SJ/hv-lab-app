import { Router } from 'express';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
} from '../controllers/project.controller';

const router = Router();

// Get all projects
router.get('/', getAllProjects);

// Get single project
router.get('/:id', getProjectById);

// Create project
router.post('/', createProject);

// Update project
router.put('/:id', updateProject);

// Delete project
router.delete('/:id', deleteProject);

export default router;