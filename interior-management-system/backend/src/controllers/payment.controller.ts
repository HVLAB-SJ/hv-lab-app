import { Request, Response } from 'express';
import Payment from '../models/Payment.model';
import Project from '../models/Project.model';
import { sendUrgentVoiceCall, sendUrgentSMS } from '../services/voiceCall.service';
import { config } from '../config/env.config';
import { io } from '../index';
import { emitUrgentPayment } from '../services/socket.service';

// Get all payments
export const getAllPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const payments = await Payment.find()
      .populate('project', 'name')
      .sort({ requestDate: -1 });

    res.json(payments);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

// Get single payment
export const getPaymentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('project', 'name');

    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    res.json(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
};

// Create payment
export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      project,
      purpose,
      process,
      itemName,
      amount,
      category,
      urgency,
      requestedBy,
      bankInfo,
      notes,
      attachments
    } = req.body;

    // Validate project exists or create temp one
    let projectExists = await Project.findOne({ name: project });
    if (!projectExists) {
      // Create a temporary project for now (until full project integration)
      projectExists = await Project.create({
        name: project,
        client: {
          name: '임시 고객',
          phone: '010-0000-0000',
          address: '임시 주소'
        },
        location: {
          address: '임시 현장 주소'
        },
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        status: 'planning',
        budget: 0,
        manager: '000000000000000000000000', // Temporary
        createdBy: '000000000000000000000000' // Temporary
      });
    }

    const payment = new Payment({
      project: projectExists._id,
      requestedBy: requestedBy || '관리자', // Use the requestedBy from request body or default to '관리자'
      purpose: purpose || `${category === 'material' ? '자재' : '인건비'} 결제`,
      process,
      itemName,
      amount,
      category,
      urgency: urgency || 'normal',
      bankInfo,
      notes,
      attachments: attachments || [],
      status: 'pending',
      requestDate: new Date()
    });

    await payment.save();

    const populatedPayment = await Payment.findById(payment._id)
      .populate('project', 'name');

    // 긴급일 경우 알림 발송
    if (urgency === 'urgent' || urgency === 'emergency') {
      console.log('긴급 결제 요청:', { project: projectExists.name, amount, urgency });

      // Socket.IO로 실시간 알림 발송 (소리 울림)
      emitUrgentPayment(io, {
        project: projectExists.name,
        amount,
        urgency: urgency as 'urgent' | 'emergency'
      });

      const notificationPhone = config.notificationPhoneNumber;

      console.log('알림 설정 확인:', {
        phoneNumber: notificationPhone,
        hasApiKey: !!config.coolsms.apiKey,
        hasApiSecret: !!config.coolsms.apiSecret
      });

      if (notificationPhone) {
        // SMS 문자 발송
        sendUrgentSMS({
          phoneNumber: notificationPhone,
          amount,
          project: projectExists.name,
          urgency: urgency as 'urgent' | 'emergency',
          process: process,
          itemName: itemName,
          bankInfo: bankInfo
        }).catch(err => console.error('SMS 발송 실패:', err));
      } else {
        console.warn('⚠️  NOTIFICATION_PHONE_NUMBER 환경 변수가 설정되지 않았습니다.');
      }
    }

    res.status(201).json(populatedPayment);
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
};

// Update payment
export const updatePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      purpose,
      process,
      itemName,
      amount,
      category,
      urgency,
      bankInfo,
      notes,
      status
    } = req.body;

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      {
        purpose,
        process,
        itemName,
        amount,
        category,
        urgency,
        bankInfo,
        notes,
        status,
        ...(status === 'approved' && { approvalDate: new Date() }),
        ...(status === 'completed' && { completionDate: new Date() })
      },
      { new: true, runValidators: true }
    )
      .populate('project', 'name');

    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    res.json(payment);
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
};

// Update payment status
export const updatePaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(status === 'approved' && { approvalDate: new Date() }),
        ...(status === 'completed' && { completionDate: new Date() })
      },
      { new: true }
    )
      .populate('project', 'name');

    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    res.json(payment);
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
};

// Delete payment
export const deletePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);

    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
};
