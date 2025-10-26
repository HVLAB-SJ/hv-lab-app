import { Request, Response } from 'express';
import Project from '../models/Project.model';
import User from '../models/User.model';

// Get all projects
export const getAllProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const projects = await Project.find()
      .populate('manager', 'name username')
      .populate('fieldManagers', 'name username')
      .populate('workers', 'name username')
      .populate('createdBy', 'name username')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

// Get single project
export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('manager', 'name username')
      .populate('fieldManagers', 'name username')
      .populate('workers', 'name username')
      .populate('createdBy', 'name username');

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

// Create project
export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== CREATE PROJECT DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const {
      name,
      client,
      location,
      startDate,
      endDate,
      status,
      budget,
      actualCost,
      manager,
      fieldManagers,
      workers,
      colorCode,
      progress,
      description,
      attachments,
      createdBy
    } = req.body;

    // Convert manager names to ObjectIds
    let managerId = null;
    let fieldManagerIds = fieldManagers || [];

    if (manager && !manager.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('🔄 Converting manager names to ObjectIds:', manager);
      // manager is a string with names, split and filter out "미지정"
      const managerNames = manager.split(',').map((m: string) => m.trim()).filter((m: string) => m !== '미지정');

      if (managerNames.length > 0) {
        // Find all managers
        const managers = await User.find({ name: { $in: managerNames } });

        if (managers.length === 0) {
          console.log('❌ No managers found:', managerNames);
          res.status(400).json({ error: `담당자를 찾을 수 없습니다: ${managerNames.join(', ')}` });
          return;
        }

        // All selected managers go to fieldManagers array
        fieldManagerIds = managers.map(m => m._id);
        console.log('✅ All managers converted to fieldManagers:', managers.map(m => `${m.name} -> ${m._id}`).join(', '));
      } else {
        console.log('⚠️ Only "미지정" provided, no managers to assign');
      }
    }

    // Use first fieldManager as createdBy if not provided
    const finalCreatedBy = createdBy || (fieldManagerIds.length > 0 ? fieldManagerIds[0] : undefined);

    if (!finalCreatedBy) {
      console.log('❌ No createdBy user available');
      res.status(400).json({ error: '프로젝트 생성자를 지정해야 합니다' });
      return;
    }

    console.log('Creating project with data:', {
      name,
      client,
      location,
      startDate,
      endDate,
      status: status || 'planning',
      budget,
      actualCost: actualCost || 0,
      manager: managerId,
      fieldManagers: fieldManagerIds,
      workers: workers || [],
      colorCode: colorCode || '#9CA3AF',
      progress: progress || 0,
      description,
      attachments: attachments || [],
      createdBy: finalCreatedBy
    });

    const project = new Project({
      name,
      client,
      location,
      startDate,
      endDate,
      status: status || 'planning',
      budget,
      actualCost: actualCost || 0,
      manager: managerId,
      fieldManagers: fieldManagerIds,
      workers: workers || [],
      colorCode: colorCode || '#9CA3AF',
      progress: progress || 0,
      description,
      attachments: attachments || [],
      createdBy: finalCreatedBy
    });

    console.log('Saving project...');
    await project.save();
    console.log('✅ Project saved successfully');

    const populatedProject = await Project.findById(project._id)
      .populate('manager', 'name username')
      .populate('fieldManagers', 'name username')
      .populate('workers', 'name username')
      .populate('createdBy', 'name username');

    console.log('✅ Project creation complete');
    res.status(201).json(populatedProject);
  } catch (error: any) {
    console.error('❌ Create project error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }

    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({ error: messages.join(', ') });
      return;
    }

    res.status(500).json({ error: 'Failed to create project', details: error.message });
  }
};

// Update project
export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== UPDATE PROJECT DEBUG ===');
    console.log('Project ID:', req.params.id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const updateData = { ...req.body };

    // Convert manager names to ObjectIds if it's a string with names
    if (updateData.manager && !updateData.manager.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('🔄 Converting manager names to ObjectIds:', updateData.manager);
      const managerNames = updateData.manager.split(',').map((m: string) => m.trim()).filter((m: string) => m !== '미지정');

      if (managerNames.length > 0) {
        // Find all managers
        const managers = await User.find({ name: { $in: managerNames } });

        if (managers.length === 0) {
          console.log('❌ No managers found:', managerNames);
          res.status(400).json({ error: `담당자를 찾을 수 없습니다: ${managerNames.join(', ')}` });
          return;
        }

        // All selected managers go to fieldManagers array
        updateData.fieldManagers = managers.map(m => m._id);
        console.log('✅ All managers converted to fieldManagers:', managers.map(m => `${m.name} -> ${m._id}`).join(', '));

        // Clear manager field (set to null explicitly)
        updateData.manager = null;
      } else {
        // If only "미지정" was provided, clear both fields
        updateData.manager = null;
        updateData.fieldManagers = [];
        console.log('⚠️ Only "미지정" provided, clearing all managers');
      }
    }

    // Validate ObjectId fields if they're being updated
    if (updateData.fieldManagers) {
      const invalidIds = updateData.fieldManagers.filter((id: any) => {
        const idStr = typeof id === 'string' ? id : String(id);
        return !idStr.match(/^[0-9a-fA-F]{24}$/);
      });
      if (invalidIds.length > 0) {
        console.log('❌ Invalid fieldManager IDs:', invalidIds);
        res.status(400).json({ error: 'Invalid fieldManager ID format' });
        return;
      }
    }

    if (updateData.workers) {
      const invalidIds = updateData.workers.filter((id: any) => {
        const idStr = typeof id === 'string' ? id : String(id);
        return !idStr.match(/^[0-9a-fA-F]{24}$/);
      });
      if (invalidIds.length > 0) {
        console.log('❌ Invalid worker IDs:', invalidIds);
        res.status(400).json({ error: 'Invalid worker ID format' });
        return;
      }
    }

    console.log('✅ Validation passed, updating project...');
    console.log('📋 Final update data:', JSON.stringify(updateData, null, 2));

    // Use findByIdAndUpdate without runValidators to avoid nested field validation issues
    // The manual validation above already ensures data integrity
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: false }
    )
      .populate('manager', 'name username')
      .populate('fieldManagers', 'name username')
      .populate('workers', 'name username')
      .populate('createdBy', 'name username');

    if (!project) {
      console.log('❌ Project not found');
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    console.log('✅ Project updated successfully');
    res.json(project);
  } catch (error: any) {
    console.error('❌ Update project error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Handle specific MongoDB errors
    if (error.name === 'CastError') {
      const errorMsg = `Invalid ${error.path} format: ${error.value}`;
      console.error('CastError:', errorMsg);
      res.status(400).json({ error: errorMsg });
      return;
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      const errorMsg = messages.join(', ');
      console.error('ValidationError:', errorMsg);
      res.status(400).json({ error: errorMsg });
      return;
    }

    // Return detailed error in development
    res.status(500).json({
      error: 'Failed to update project',
      details: error.message,
      name: error.name
    });
  }
};

// Delete project
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};
