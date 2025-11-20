import { Request, Response } from 'express';
import SiteLog from '../models/SiteLog.model';

// 모든 일지 조회
export const getAllLogs = async (req: Request, res: Response) => {
  try {
    const logs = await SiteLog.find().sort({ date: -1 });
    res.json(logs);
  } catch (error: any) {
    console.error('Failed to get all logs:', error);
    res.status(500).json({ message: 'Failed to get logs', error: error.message });
  }
};

// 프로젝트별 일지 조회
export const getProjectLogs = async (req: Request, res: Response) => {
  try {
    const { projectName } = req.params;
    const logs = await SiteLog.find({ project: projectName }).sort({ date: -1 });
    res.json(logs);
  } catch (error: any) {
    console.error('Failed to get project logs:', error);
    res.status(500).json({ message: 'Failed to get project logs', error: error.message });
  }
};

// 날짜 범위로 조회
export const getLogsByDateRange = async (req: Request, res: Response) => {
  try {
    const { project, startDate, endDate } = req.query;

    const query: any = {};
    if (project) query.project = project;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string)
      };
    }

    const logs = await SiteLog.find(query).sort({ date: -1 });
    res.json(logs);
  } catch (error: any) {
    console.error('Failed to get logs by date range:', error);
    res.status(500).json({ message: 'Failed to get logs by date range', error: error.message });
  }
};

// 일지 생성
export const createLog = async (req: Request, res: Response) => {
  try {
    const logData = req.body;
    const log = new SiteLog(logData);
    await log.save();
    res.status(201).json(log);
  } catch (error: any) {
    console.error('Failed to create log:', error);
    res.status(500).json({ message: 'Failed to create log', error: error.message });
  }
};

// 일지 수정
export const updateLog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const log = await SiteLog.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    res.json(log);
  } catch (error: any) {
    console.error('Failed to update log:', error);
    res.status(500).json({ message: 'Failed to update log', error: error.message });
  }
};

// 일지 삭제
export const deleteLog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const log = await SiteLog.findByIdAndDelete(id);

    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    res.json({ message: 'Log deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete log:', error);
    res.status(500).json({ message: 'Failed to delete log', error: error.message });
  }
};
