import { Request, Response } from 'express';
import Schedule from '../models/Schedule.model';
import Project from '../models/Project.model';

// Get all schedules
export const getAllSchedules = async (req: Request, res: Response): Promise<void> => {
  try {
    const schedules = await Schedule.find()
      .populate('project', 'name')
      .populate('assignedTo', 'name username')
      .populate('createdBy', 'name username')
      .sort({ startDate: 1 });

    res.json(schedules);
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
};

// Get single schedule
export const getScheduleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('project', 'name')
      .populate('assignedTo', 'name username email')
      .populate('createdBy', 'name username');

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    res.json(schedule);
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
};

// Create schedule
export const createSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      project,
      title,
      type,
      phase,
      startDate,
      endDate,
      allDay,
      assignedTo,
      description,
      location,
      priority,
      asRequestId,
      time
    } = req.body;

    // Validate project exists or create temp one
    let projectExists = await Project.findOne({ name: project });
    if (!projectExists) {
      // Create a temporary project
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
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        status: 'planning',
        budget: 0,
        manager: '000000000000000000000000',
        createdBy: '000000000000000000000000'
      });
    }

    const schedule = new Schedule({
      project: projectExists._id,
      title,
      type: type || 'other',
      phase: phase || '기타',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      allDay: allDay !== undefined ? allDay : true,
      assignedTo: [],  // ObjectId 배열은 비워둠
      assigneeNames: Array.isArray(assignedTo) ? assignedTo : [],  // 문자열 배열로 저장
      description,
      location,
      priority: priority || 'medium',
      asRequestId,  // AS 요청 ID 저장
      time,  // 시간 필드 추가
      progress: 0,
      isCompleted: false,
      reminders: [],
      attachments: [],
      notes: [],
      createdBy: '000000000000000000000000' // Temporary
    });

    await schedule.save();

    const populatedSchedule = await Schedule.findById(schedule._id)
      .populate('project', 'name')
      .populate('assignedTo', 'name username');

    res.status(201).json(populatedSchedule);
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
};

// Update schedule
export const updateSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      type,
      phase,
      startDate,
      endDate,
      allDay,
      assignedTo,
      description,
      location,
      priority,
      progress,
      isCompleted,
      time
    } = req.body;

    const updateData: any = {
      title,
      type,
      phase,
      description,
      location,
      priority,
      progress,
      isCompleted,
      time  // 시간 필드 추가
    };

    if (startDate) {
      updateData.startDate = new Date(startDate);
    }

    if (endDate) {
      updateData.endDate = new Date(endDate);
    }

    if (allDay !== undefined) {
      updateData.allDay = allDay;
    }

    // assignedTo는 문자열 배열로 받아서 assigneeNames에 저장
    if (assignedTo !== undefined) {
      updateData.assignedTo = [];  // ObjectId 배열은 비워둠
      updateData.assigneeNames = Array.isArray(assignedTo) ? assignedTo : [];  // 문자열 배열로 저장
    }

    if (isCompleted && !req.body.completedAt) {
      updateData.completedAt = new Date();
    }

    const schedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('project', 'name')
      .populate('assignedTo', 'name username');

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    res.json(schedule);
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
};

// Delete schedule
export const deleteSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
};
