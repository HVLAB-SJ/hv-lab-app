import { Request, Response } from 'express';
import ASRequest from '../models/ASRequest.model';
import Schedule from '../models/Schedule.model';

// Get all AS requests
export const getAllASRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await ASRequest.find().sort({ requestDate: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Get AS requests error:', error);
    res.status(500).json({ error: 'Failed to fetch AS requests' });
  }
};

// Get single AS request
export const getASRequestById = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await ASRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({ error: 'AS request not found' });
      return;
    }
    res.json(request);
  } catch (error) {
    console.error('Get AS request error:', error);
    res.status(500).json({ error: 'Failed to fetch AS request' });
  }
};

// Create AS request
export const createASRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = new ASRequest(req.body);
    await request.save();
    res.status(201).json(request);
  } catch (error) {
    console.error('Create AS request error:', error);
    res.status(500).json({ error: 'Failed to create AS request' });
  }
};

// Update AS request
export const updateASRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await ASRequest.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!request) {
      res.status(404).json({ error: 'AS request not found' });
      return;
    }
    res.json(request);
  } catch (error) {
    console.error('Update AS request error:', error);
    res.status(500).json({ error: 'Failed to update AS request' });
  }
};

// Delete AS request
export const deleteASRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const asRequestId = req.params.id;

    // AS 요청 찾기
    const request = await ASRequest.findById(asRequestId);
    if (!request) {
      res.status(404).json({ error: 'AS request not found' });
      return;
    }

    // 연관된 일정 삭제
    await Schedule.deleteMany({ asRequestId });
    console.log(`✅ Deleted schedules associated with AS request ${asRequestId}`);

    // AS 요청 삭제
    await ASRequest.findByIdAndDelete(asRequestId);

    res.json({ message: 'AS request and related schedules deleted successfully' });
  } catch (error) {
    console.error('Delete AS request error:', error);
    res.status(500).json({ error: 'Failed to delete AS request' });
  }
};
