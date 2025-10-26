import { Request, Response } from 'express';
import WorkRequest from '../models/WorkRequest.model';

// Get all work requests
export const getAllWorkRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const workRequests = await WorkRequest.find()
      .sort({ requestDate: -1 });

    res.json(workRequests);
  } catch (error) {
    console.error('Get work requests error:', error);
    res.status(500).json({ error: 'Failed to fetch work requests' });
  }
};

// Get single work request
export const getWorkRequestById = async (req: Request, res: Response): Promise<void> => {
  try {
    const workRequest = await WorkRequest.findById(req.params.id);

    if (!workRequest) {
      res.status(404).json({ error: 'Work request not found' });
      return;
    }

    res.json(workRequest);
  } catch (error) {
    console.error('Get work request error:', error);
    res.status(500).json({ error: 'Failed to fetch work request' });
  }
};

// Create work request
export const createWorkRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      project,
      requestType,
      description,
      requestDate,
      dueDate,
      requestedBy,
      assignedTo,
      status,
      priority,
      notes,
      completedDate
    } = req.body;

    const workRequest = new WorkRequest({
      project,
      requestType,
      description: description || '',
      requestDate: new Date(requestDate),
      dueDate: new Date(dueDate),
      requestedBy,
      assignedTo,
      status: status || 'pending',
      priority: priority || 'medium',
      notes,
      completedDate: completedDate ? new Date(completedDate) : undefined
    });

    await workRequest.save();

    res.status(201).json(workRequest);
  } catch (error) {
    console.error('Create work request error:', error);
    res.status(500).json({ error: 'Failed to create work request' });
  }
};

// Update work request
export const updateWorkRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      project,
      requestType,
      description,
      requestDate,
      dueDate,
      requestedBy,
      assignedTo,
      status,
      priority,
      notes,
      completedDate
    } = req.body;

    const updateData: any = {};

    // Only add fields that are provided
    if (project !== undefined) updateData.project = project;
    if (requestType !== undefined) updateData.requestType = requestType;
    if (description !== undefined) updateData.description = description;
    if (requestedBy !== undefined) updateData.requestedBy = requestedBy;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (notes !== undefined) updateData.notes = notes;

    if (requestDate) {
      updateData.requestDate = new Date(requestDate);
    }

    if (dueDate) {
      updateData.dueDate = new Date(dueDate);
    }

    if (completedDate) {
      updateData.completedDate = new Date(completedDate);
    } else if (status === 'completed' && !req.body.completedDate) {
      updateData.completedDate = new Date();
    }

    const workRequest = await WorkRequest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!workRequest) {
      res.status(404).json({ error: 'Work request not found' });
      return;
    }

    res.json(workRequest);
  } catch (error) {
    console.error('Update work request error:', error);
    res.status(500).json({ error: 'Failed to update work request' });
  }
};

// Delete work request
export const deleteWorkRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const workRequest = await WorkRequest.findByIdAndDelete(req.params.id);

    if (!workRequest) {
      res.status(404).json({ error: 'Work request not found' });
      return;
    }

    res.json({ message: 'Work request deleted successfully' });
  } catch (error) {
    console.error('Delete work request error:', error);
    res.status(500).json({ error: 'Failed to delete work request' });
  }
};
