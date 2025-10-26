import { Request, Response } from 'express';
import AdditionalWork from '../models/AdditionalWork.model';

// Get all additional works
export const getAllAdditionalWorks = async (req: Request, res: Response): Promise<void> => {
  try {
    const works = await AdditionalWork.find().sort({ date: -1 });
    res.json(works);
  } catch (error) {
    console.error('Get additional works error:', error);
    res.status(500).json({ error: 'Failed to fetch additional works' });
  }
};

// Get single additional work
export const getAdditionalWorkById = async (req: Request, res: Response): Promise<void> => {
  try {
    const work = await AdditionalWork.findById(req.params.id);
    if (!work) {
      res.status(404).json({ error: 'Additional work not found' });
      return;
    }
    res.json(work);
  } catch (error) {
    console.error('Get additional work error:', error);
    res.status(500).json({ error: 'Failed to fetch additional work' });
  }
};

// Create additional work
export const createAdditionalWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const work = new AdditionalWork(req.body);
    await work.save();
    res.status(201).json(work);
  } catch (error) {
    console.error('Create additional work error:', error);
    res.status(500).json({ error: 'Failed to create additional work' });
  }
};

// Update additional work
export const updateAdditionalWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const work = await AdditionalWork.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!work) {
      res.status(404).json({ error: 'Additional work not found' });
      return;
    }
    res.json(work);
  } catch (error) {
    console.error('Update additional work error:', error);
    res.status(500).json({ error: 'Failed to update additional work' });
  }
};

// Delete additional work
export const deleteAdditionalWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const work = await AdditionalWork.findByIdAndDelete(req.params.id);
    if (!work) {
      res.status(404).json({ error: 'Additional work not found' });
      return;
    }
    res.json({ message: 'Additional work deleted successfully' });
  } catch (error) {
    console.error('Delete additional work error:', error);
    res.status(500).json({ error: 'Failed to delete additional work' });
  }
};
