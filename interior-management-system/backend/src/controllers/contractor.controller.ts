import { Request, Response } from 'express';
import Contractor from '../models/Contractor.model';

// Get all contractors
export const getAllContractors = async (req: Request, res: Response): Promise<void> => {
  try {
    const contractors = await Contractor.find()
      .sort({ createdAt: -1 });

    res.json(contractors);
  } catch (error) {
    console.error('Get contractors error:', error);
    res.status(500).json({ error: 'Failed to fetch contractors' });
  }
};

// Get single contractor
export const getContractorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const contractor = await Contractor.findById(req.params.id);

    if (!contractor) {
      res.status(404).json({ error: 'Contractor not found' });
      return;
    }

    res.json(contractor);
  } catch (error) {
    console.error('Get contractor error:', error);
    res.status(500).json({ error: 'Failed to fetch contractor' });
  }
};

// Create contractor
export const createContractor = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      rank,
      companyName,
      name,
      process,
      contact,
      accountNumber,
      notes
    } = req.body;

    const contractor = new Contractor({
      rank,
      companyName,
      name,
      process,
      contact,
      accountNumber,
      notes
    });

    await contractor.save();

    res.status(201).json(contractor);
  } catch (error) {
    console.error('Create contractor error:', error);
    res.status(500).json({ error: 'Failed to create contractor' });
  }
};

// Update contractor
export const updateContractor = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      rank,
      companyName,
      name,
      process,
      contact,
      accountNumber,
      notes
    } = req.body;

    const contractor = await Contractor.findByIdAndUpdate(
      req.params.id,
      {
        rank,
        companyName,
        name,
        process,
        contact,
        accountNumber,
        notes
      },
      { new: true, runValidators: true }
    );

    if (!contractor) {
      res.status(404).json({ error: 'Contractor not found' });
      return;
    }

    res.json(contractor);
  } catch (error) {
    console.error('Update contractor error:', error);
    res.status(500).json({ error: 'Failed to update contractor' });
  }
};

// Delete contractor
export const deleteContractor = async (req: Request, res: Response): Promise<void> => {
  try {
    const contractor = await Contractor.findByIdAndDelete(req.params.id);

    if (!contractor) {
      res.status(404).json({ error: 'Contractor not found' });
      return;
    }

    res.json({ message: 'Contractor deleted successfully' });
  } catch (error) {
    console.error('Delete contractor error:', error);
    res.status(500).json({ error: 'Failed to delete contractor' });
  }
};
