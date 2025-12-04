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
      attachments,
      materialAmount,
      laborAmount,
      originalMaterialAmount,
      originalLaborAmount,
      applyTaxDeduction,
      includesVAT,
      quickText
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
      materialAmount: materialAmount || 0,
      laborAmount: laborAmount || 0,
      originalMaterialAmount: originalMaterialAmount || 0,
      originalLaborAmount: originalLaborAmount || 0,
      applyTaxDeduction: applyTaxDeduction || false,
      includesVAT: includesVAT || false,
      quickText: quickText || '',
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
      materialAmount,
      laborAmount,
      originalMaterialAmount,
      originalLaborAmount,
      category,
      urgency,
      bankInfo,
      notes,
      status,
      requestDate,
      includesVAT,
      applyTaxDeduction
    } = req.body;

    // 업데이트할 필드만 포함하는 객체 생성
    const updateFields: Record<string, any> = {};
    if (purpose !== undefined) updateFields.purpose = purpose;
    if (process !== undefined) updateFields.process = process;
    if (itemName !== undefined) updateFields.itemName = itemName;
    if (amount !== undefined) updateFields.amount = amount;
    if (materialAmount !== undefined) updateFields.materialAmount = materialAmount;
    if (laborAmount !== undefined) updateFields.laborAmount = laborAmount;
    if (originalMaterialAmount !== undefined) updateFields.originalMaterialAmount = originalMaterialAmount;
    if (originalLaborAmount !== undefined) updateFields.originalLaborAmount = originalLaborAmount;
    if (category !== undefined) updateFields.category = category;
    if (requestDate !== undefined) updateFields.requestDate = new Date(requestDate);
    if (includesVAT !== undefined) updateFields.includesVAT = includesVAT;
    if (applyTaxDeduction !== undefined) updateFields.applyTaxDeduction = applyTaxDeduction;
    if (urgency !== undefined) updateFields.urgency = urgency;
    if (bankInfo !== undefined) updateFields.bankInfo = bankInfo;
    if (notes !== undefined) updateFields.notes = notes;
    if (status !== undefined) {
      updateFields.status = status;
      if (status === 'approved') updateFields.approvalDate = new Date();
      if (status === 'completed') updateFields.completionDate = new Date();
    }

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      updateFields,
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

    // 결제 상태 변경 시 모든 클라이언트에게 실시간 브로드캐스트
    io.emit('payment:refresh', {
      paymentId: payment._id,
      status: payment.status,
      updatedAt: new Date().toISOString()
    });
    console.log('📢 결제 상태 변경 브로드캐스트:', { id: payment._id, status: payment.status });

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
