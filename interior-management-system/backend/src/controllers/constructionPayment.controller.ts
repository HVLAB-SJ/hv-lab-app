import { Request, Response } from 'express';
import ConstructionPayment from '../models/ConstructionPayment.model';

// Get all construction payments
export const getAllConstructionPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const payments = await ConstructionPayment.find().sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    console.error('Get construction payments error:', error);
    res.status(500).json({ error: 'Failed to fetch construction payments' });
  }
};

// Get single construction payment
export const getConstructionPaymentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const payment = await ConstructionPayment.findById(req.params.id);
    if (!payment) {
      res.status(404).json({ error: 'Construction payment not found' });
      return;
    }
    res.json(payment);
  } catch (error) {
    console.error('Get construction payment error:', error);
    res.status(500).json({ error: 'Failed to fetch construction payment' });
  }
};

// Create construction payment
export const createConstructionPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const payment = new ConstructionPayment(req.body);
    await payment.save();
    res.status(201).json(payment);
  } catch (error) {
    console.error('Create construction payment error:', error);
    res.status(500).json({ error: 'Failed to create construction payment' });
  }
};

// Update construction payment
export const updateConstructionPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const payment = await ConstructionPayment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!payment) {
      res.status(404).json({ error: 'Construction payment not found' });
      return;
    }
    res.json(payment);
  } catch (error) {
    console.error('Update construction payment error:', error);
    res.status(500).json({ error: 'Failed to update construction payment' });
  }
};

// Delete construction payment
export const deleteConstructionPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const payment = await ConstructionPayment.findByIdAndDelete(req.params.id);
    if (!payment) {
      res.status(404).json({ error: 'Construction payment not found' });
      return;
    }
    res.json({ message: 'Construction payment deleted successfully' });
  } catch (error) {
    console.error('Delete construction payment error:', error);
    res.status(500).json({ error: 'Failed to delete construction payment' });
  }
};
