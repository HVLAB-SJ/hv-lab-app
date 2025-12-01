import { Request, Response } from 'express';
import ExecutionRecord from '../models/ExecutionRecord.model';
import Project from '../models/Project.model';

// 모든 실행내역 조회
export const getAllRecords = async (_req: Request, res: Response): Promise<void> => {
  try {
    const records = await ExecutionRecord.find().sort({ date: -1, createdAt: -1 });

    const response = records.map(record => ({
      id: record._id,
      project_id: record.projectId,
      project_name: record.projectName,
      author: record.author,
      date: record.date.toISOString().split('T')[0],
      process: record.process,
      item_name: record.itemName,
      material_cost: record.materialCost,
      labor_cost: record.laborCost,
      vat_amount: record.vatAmount,
      total_amount: record.totalAmount,
      notes: record.notes,
      payment_id: record.paymentId,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString()
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error('실행내역 조회 오류:', error);
    res.status(500).json({ message: '실행내역 조회 중 오류가 발생했습니다' });
  }
};

// 단일 실행내역 조회
export const getRecordById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await ExecutionRecord.findById(id);

    if (!record) {
      res.status(404).json({ message: '실행내역을 찾을 수 없습니다' });
      return;
    }

    res.status(200).json({
      id: record._id,
      project_id: record.projectId,
      project_name: record.projectName,
      author: record.author,
      date: record.date.toISOString().split('T')[0],
      process: record.process,
      item_name: record.itemName,
      material_cost: record.materialCost,
      labor_cost: record.laborCost,
      vat_amount: record.vatAmount,
      total_amount: record.totalAmount,
      notes: record.notes,
      payment_id: record.paymentId,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString()
    });
  } catch (error) {
    console.error('실행내역 조회 오류:', error);
    res.status(500).json({ message: '실행내역 조회 중 오류가 발생했습니다' });
  }
};

// 실행내역 생성
export const createRecord = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      project_name,
      author,
      date,
      process,
      item_name,
      material_cost,
      labor_cost,
      vat_amount,
      total_amount,
      notes,
      payment_id
    } = req.body;

    if (!project_name || !item_name) {
      res.status(400).json({ message: '프로젝트 이름과 항목명은 필수입니다' });
      return;
    }

    // 프로젝트 ID 찾기
    const project = await Project.findOne({ name: project_name });

    const record = new ExecutionRecord({
      projectId: project?._id,
      projectName: project_name,
      author: author || '',
      date: new Date(date),
      process: process || '',
      itemName: item_name,
      materialCost: material_cost || 0,
      laborCost: labor_cost || 0,
      vatAmount: vat_amount || 0,
      totalAmount: total_amount || 0,
      notes: notes || '',
      paymentId: payment_id
    });

    await record.save();

    console.log('✅ 실행내역 생성 완료:', item_name);

    res.status(201).json({
      id: record._id,
      project_id: record.projectId,
      project_name: record.projectName,
      author: record.author,
      date: record.date.toISOString().split('T')[0],
      process: record.process,
      item_name: record.itemName,
      material_cost: record.materialCost,
      labor_cost: record.laborCost,
      vat_amount: record.vatAmount,
      total_amount: record.totalAmount,
      notes: record.notes,
      payment_id: record.paymentId,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString()
    });
  } catch (error) {
    console.error('실행내역 생성 오류:', error);
    res.status(500).json({ message: '실행내역 생성 중 오류가 발생했습니다' });
  }
};

// 실행내역 수정
export const updateRecord = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      project_name,
      author,
      date,
      process,
      item_name,
      material_cost,
      labor_cost,
      vat_amount,
      total_amount,
      notes,
      payment_id
    } = req.body;

    const updateData: any = {};

    if (project_name !== undefined) {
      const project = await Project.findOne({ name: project_name });
      updateData.projectId = project?._id;
      updateData.projectName = project_name;
    }
    if (author !== undefined) updateData.author = author;
    if (date !== undefined) updateData.date = new Date(date);
    if (process !== undefined) updateData.process = process;
    if (item_name !== undefined) updateData.itemName = item_name;
    if (material_cost !== undefined) updateData.materialCost = material_cost;
    if (labor_cost !== undefined) updateData.laborCost = labor_cost;
    if (vat_amount !== undefined) updateData.vatAmount = vat_amount;
    if (total_amount !== undefined) updateData.totalAmount = total_amount;
    if (notes !== undefined) updateData.notes = notes;
    if (payment_id !== undefined) updateData.paymentId = payment_id;

    const record = await ExecutionRecord.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!record) {
      res.status(404).json({ message: '실행내역을 찾을 수 없습니다' });
      return;
    }

    res.status(200).json({
      id: record._id,
      project_id: record.projectId,
      project_name: record.projectName,
      author: record.author,
      date: record.date.toISOString().split('T')[0],
      process: record.process,
      item_name: record.itemName,
      material_cost: record.materialCost,
      labor_cost: record.laborCost,
      vat_amount: record.vatAmount,
      total_amount: record.totalAmount,
      notes: record.notes,
      payment_id: record.paymentId,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString()
    });
  } catch (error) {
    console.error('실행내역 수정 오류:', error);
    res.status(500).json({ message: '실행내역 수정 중 오류가 발생했습니다' });
  }
};

// 실행내역 삭제
export const deleteRecord = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const record = await ExecutionRecord.findByIdAndDelete(id);

    if (!record) {
      res.status(404).json({ message: '실행내역을 찾을 수 없습니다' });
      return;
    }

    res.status(200).json({ message: '실행내역이 삭제되었습니다' });
  } catch (error) {
    console.error('실행내역 삭제 오류:', error);
    res.status(500).json({ message: '실행내역 삭제 중 오류가 발생했습니다' });
  }
};
