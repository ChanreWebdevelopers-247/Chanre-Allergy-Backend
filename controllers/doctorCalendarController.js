import DoctorAvailability from '../models/DoctorAvailability.js';
import AppointmentSlot from '../models/AppointmentSlot.js';
import User from '../models/User.js';
import PatientAppointment from '../models/PatientAppointment.js';
import Patient from '../models/Patient.js';

// Helper function to auto-create slots for a date
const autoCreateSlotsForDate = async (doctorId, centerId, date, startTime, endTime, breakStartTime, breakEndTime, userId, slotDuration = 30) => {
  if (!startTime || !endTime) return;
  
  try {
    // Delete existing unbooked slots for this date
    await AppointmentSlot.deleteMany({
      doctorId,
      centerId,
      date: date,
      isBooked: false
    });

    const finalSlotDuration = slotDuration || 30; // Default to 30 minutes per slot
    
    // Parse times
    const parseTime = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes; // Convert to minutes
    };

    const formatTime = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const startMinutes = parseTime(startTime);
    const endMinutes = parseTime(endTime);
    const breakStartMinutes = breakStartTime ? parseTime(breakStartTime) : null;
    const breakEndMinutes = breakEndTime ? parseTime(breakEndTime) : null;

    // Generate all slot times first
    const slotTimes = [];
    let currentMinutes = startMinutes;

    while (currentMinutes + finalSlotDuration <= endMinutes) {
      // Skip break time if exists
      if (breakStartMinutes && breakEndMinutes) {
        if (currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes) {
          currentMinutes = breakEndMinutes;
          continue;
        }
      }

      const slotStartTime = formatTime(currentMinutes);
      const slotEndTime = formatTime(currentMinutes + finalSlotDuration);
      slotTimes.push({ startTime: slotStartTime, endTime: slotEndTime });
      currentMinutes += finalSlotDuration;
    }

    // Get all existing booked slots for this date in one query
    const existingSlots = await AppointmentSlot.find({
      doctorId,
      centerId,
      date: date,
      isBooked: true
    }).select('startTime endTime').lean();

    const existingSlotMap = new Set();
    existingSlots.forEach(slot => {
      existingSlotMap.add(`${slot.startTime}-${slot.endTime}`);
    });

    // Create slots that don't exist
    const slots = slotTimes
      .filter(slot => !existingSlotMap.has(`${slot.startTime}-${slot.endTime}`))
      .map(slot => ({
        doctorId,
        centerId,
        date: date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: finalSlotDuration,
        isBooked: false,
        status: 'available',
        createdBy: userId
      }));

    // Bulk insert slots if any
    if (slots.length > 0) {
      await AppointmentSlot.insertMany(slots, { ordered: false });
    }
  } catch (error) {
    console.error('Error auto-creating slots:', error);
    // Don't throw - let the calling function handle errors
  }
};

// Get all doctors for a center
export const getCenterDoctors = async (req, res) => {
  try {
    const centerId = req.user.centerId;
    
    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required',
        error: 'MISSING_CENTER_ID'
      });
    }

    const doctors = await User.find({
      centerId: centerId,
      role: 'doctor',
      isDeleted: false,
      status: 'active'
    }).select('name email phone qualification designation');

    res.json({
      success: true,
      doctors
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ 
      message: 'Error fetching doctors', 
      error: error.message 
    });
  }
};

// Set doctor availability for a date
export const setDoctorAvailability = async (req, res) => {
  try {
    const { doctorId, date, isAvailable, isHoliday, holidayName, startTime, endTime, breakStartTime, breakEndTime, notes, maxAppointments } = req.body;
    const centerId = req.user.centerId;

    if (!doctorId || !date) {
      return res.status(400).json({ 
        message: 'Doctor ID and date are required' 
      });
    }

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    // Verify doctor belongs to center
    const doctor = await User.findOne({ 
      _id: doctorId, 
      centerId: centerId, 
      role: 'doctor' 
    });

    if (!doctor) {
      return res.status(404).json({ 
        message: 'Doctor not found or does not belong to this center' 
      });
    }

    // Normalize date to midnight - handle both string and Date objects
    let cleanDate;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Parse YYYY-MM-DD format and create date at local midnight
      const [year, month, day] = date.split('-').map(Number);
      cleanDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    } else {
      cleanDate = new Date(date);
      cleanDate.setHours(0, 0, 0, 0);
    }

    // Create date range for query to match dates even if they have time components
    const startOfDay = new Date(cleanDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(cleanDate);
    endOfDay.setHours(23, 59, 59, 999);

    // If it's a holiday, set isAvailable to false
    const finalIsAvailable = isHoliday ? false : (isAvailable !== undefined ? isAvailable : true);

    // Create or update availability using date range query
    const availability = await DoctorAvailability.findOneAndUpdate(
      { 
        doctorId, 
        centerId,
        date: { $gte: startOfDay, $lte: endOfDay }
      },
      {
        doctorId,
        centerId,
        date: cleanDate, // Store normalized date
        isAvailable: finalIsAvailable,
        isHoliday: isHoliday || false,
        holidayName: holidayName || '',
        startTime: isHoliday ? null : startTime,
        endTime: isHoliday ? null : endTime,
        breakStartTime: isHoliday ? null : breakStartTime,
        breakEndTime: isHoliday ? null : breakEndTime,
        notes,
        maxAppointments: maxAppointments || 50,
        createdBy: req.user._id
      },
      { upsert: true, new: true }
    ).populate('doctorId', 'name email');

    // Auto-create slots if availability is set and has working hours
    if (finalIsAvailable && !isHoliday && startTime && endTime) {
      await autoCreateSlotsForDate(
        doctorId,
        centerId,
        cleanDate,
        startTime,
        endTime,
        breakStartTime,
        breakEndTime,
        req.user._id,
        req.body.slotDuration || 30
      );
    }

    res.json({
      success: true,
      message: 'Doctor availability updated successfully',
      availability
    });
  } catch (error) {
    console.error('Error setting doctor availability:', error);
    res.status(500).json({ 
      message: 'Error setting doctor availability', 
      error: error.message 
    });
  }
};

// Set default working hours for all days in a year
export const setDefaultWorkingHours = async (req, res) => {
  try {
    const { doctorId, year, startTime, endTime, breakStartTime, breakEndTime, maxAppointments, slotDuration, excludeSundays, overrideExisting } = req.body;
    const centerId = req.user.centerId;

    if (!doctorId || !year || !startTime || !endTime) {
      return res.status(400).json({ 
        message: 'Doctor ID, year, start time, and end time are required' 
      });
    }

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    // Verify doctor belongs to center
    const doctor = await User.findOne({ 
      _id: doctorId, 
      centerId: centerId, 
      role: 'doctor' 
    });

    if (!doctor) {
      return res.status(404).json({ 
        message: 'Doctor not found or does not belong to this center' 
      });
    }

    // Generate all dates for the year
    const dates = [];
    for (let month = 0; month < 12; month++) {
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(year, month, day);
        // Skip Sundays if excludeSundays is true
        if (excludeSundays && date.getDay() === 0) {
          continue;
        }
        dates.push(date);
      }
    }

    // If overrideExisting is false, we need to check which dates already have custom settings
    let datesToUpdate = dates;
    if (!overrideExisting) {
      // Fetch existing availabilities for this year
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);
      endOfYear.setHours(23, 59, 59, 999);
      
      const existingAvailabilities = await DoctorAvailability.find({
        doctorId,
        centerId,
        date: {
          $gte: startOfYear,
          $lte: endOfYear
        }
      });

      // Create a Set of dates that already have custom settings (holidays or custom availability)
      const existingDatesSet = new Set();
      existingAvailabilities.forEach(avail => {
        const dateKey = avail.date.toISOString().split('T')[0];
        // Only skip if it's a holiday or has been explicitly set (not just default)
        if (avail.isHoliday || (avail.isAvailable !== undefined && avail.isAvailable !== true)) {
          existingDatesSet.add(dateKey);
        }
      });

      // Filter out dates that already have custom settings
      datesToUpdate = dates.filter(date => {
        const dateKey = date.toISOString().split('T')[0];
        return !existingDatesSet.has(dateKey);
      });
    }

    // Bulk upsert default working hours
    const operations = datesToUpdate.map(date => {
      // Normalize date to midnight
      const cleanDate = new Date(date);
      cleanDate.setHours(0, 0, 0, 0);
      
      return {
        updateOne: {
          filter: { doctorId, date: cleanDate, centerId },
          update: {
            $set: {
              doctorId,
              centerId,
              date: cleanDate,
              isAvailable: true,
              isHoliday: false,
              holidayName: '',
              startTime: startTime || null,
              endTime: endTime || null,
              breakStartTime: breakStartTime || null,
              breakEndTime: breakEndTime || null,
              maxAppointments: maxAppointments || 50,
              createdBy: req.user._id
            }
          },
          upsert: true
        }
      };
    });

    if (operations.length > 0) {
      await DoctorAvailability.bulkWrite(operations);
      
      // Auto-create slots for all dates with default working hours (async, non-blocking)
      if (startTime && endTime) {
        // Return response immediately, create slots in background
        setImmediate(async () => {
          try {
            // Process in batches to avoid overwhelming the database
            const batchSize = 50;
            for (let i = 0; i < datesToUpdate.length; i += batchSize) {
              const batch = datesToUpdate.slice(i, i + batchSize);
              await Promise.all(batch.map(date => {
                const cleanDate = new Date(date);
                cleanDate.setHours(0, 0, 0, 0);
                return autoCreateSlotsForDate(
                  doctorId,
                  centerId,
                  cleanDate,
                  startTime,
                  endTime,
                  breakStartTime,
                  breakEndTime,
                  req.user._id,
                  slotDuration || 30
                );
              }));
            }
          } catch (error) {
            console.error('Error auto-creating slots in background:', error);
          }
        });
      }
    }

    res.json({
      success: true,
      message: `Successfully set default working hours for ${datesToUpdate.length} days in ${year}`,
      count: datesToUpdate.length,
      totalDays: dates.length
    });
  } catch (error) {
    console.error('Error setting default working hours:', error);
    res.status(500).json({ 
      message: 'Error setting default working hours', 
      error: error.message 
    });
  }
};

// Automatically mark all Sundays as holidays for a doctor in a year
export const markSundaysAsHolidays = async (req, res) => {
  try {
    const { doctorId, year } = req.body;
    const centerId = req.user.centerId;

    if (!doctorId || !year) {
      return res.status(400).json({ 
        message: 'Doctor ID and year are required' 
      });
    }

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    // Verify doctor belongs to center
    const doctor = await User.findOne({ 
      _id: doctorId, 
      centerId: centerId, 
      role: 'doctor' 
    });

    if (!doctor) {
      return res.status(404).json({ 
        message: 'Doctor not found or does not belong to this center' 
      });
    }

    // Get all Sundays in the year
    const sundays = [];
    for (let month = 0; month < 12; month++) {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // Find first Sunday of the month
      let currentDate = new Date(firstDay);
      while (currentDate.getDay() !== 0) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Add all Sundays in the month
      while (currentDate <= lastDay && currentDate.getMonth() === month) {
        sundays.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }

    // Bulk upsert Sundays as holidays
    const operations = sundays.map(date => {
      // Create a clean date at midnight (no time component)
      const cleanDate = new Date(date);
      cleanDate.setHours(0, 0, 0, 0);
      
      return {
        updateOne: {
          filter: { doctorId, date: cleanDate, centerId },
          update: {
            $set: {
              doctorId,
              centerId,
              date: cleanDate,
              isAvailable: false,
              isHoliday: true,
              holidayName: 'Sunday',
              createdBy: req.user._id
            }
          },
          upsert: true
        }
      };
    });

    const result = await DoctorAvailability.bulkWrite(operations);

    res.json({
      success: true,
      message: `Successfully marked ${sundays.length} Sundays as holidays`,
      count: sundays.length
    });
  } catch (error) {
    console.error('Error marking Sundays as holidays:', error);
    res.status(500).json({ 
      message: 'Error marking Sundays as holidays', 
      error: error.message 
    });
  }
};

// Bulk set holidays for multiple dates
export const bulkSetHolidays = async (req, res) => {
  try {
    const { doctorId, dates, holidayName } = req.body;
    const centerId = req.user.centerId;

    if (!doctorId || !dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ 
        message: 'Doctor ID and dates array are required' 
      });
    }

    if (!holidayName) {
      return res.status(400).json({ 
        message: 'Holiday name is required' 
      });
    }

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    // Verify doctor belongs to center
    const doctor = await User.findOne({ 
      _id: doctorId, 
      centerId: centerId, 
      role: 'doctor' 
    });

    if (!doctor) {
      return res.status(404).json({ 
        message: 'Doctor not found or does not belong to this center' 
      });
    }

    // Bulk upsert holidays
    const operations = dates.map(date => {
      // Normalize date to midnight - handle both string and Date objects
      let cleanDate;
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        // Parse YYYY-MM-DD format and create date at local midnight
        const [year, month, day] = date.split('-').map(Number);
        cleanDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      } else {
        cleanDate = new Date(date);
        cleanDate.setHours(0, 0, 0, 0);
      }
      
      // Create end of day for range query to catch dates stored with time components
      const startOfDay = new Date(cleanDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(cleanDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      return {
        updateOne: {
          // Use date range to match dates even if they have time components
          filter: { 
            doctorId, 
            centerId,
            date: { $gte: startOfDay, $lte: endOfDay }
          },
          update: {
            $set: {
              doctorId,
              centerId,
              date: cleanDate, // Store normalized date
              isAvailable: false,
              isHoliday: true,
              holidayName,
              createdBy: req.user._id
            }
          },
          upsert: true
        }
      };
    });

    await DoctorAvailability.bulkWrite(operations);

    res.json({
      success: true,
      message: `Successfully set ${dates.length} holidays`,
      count: dates.length
    });
  } catch (error) {
    console.error('Error bulk setting holidays:', error);
    res.status(500).json({ 
      message: 'Error bulk setting holidays', 
      error: error.message 
    });
  }
};

// Bulk set availability (for available or unavailable dates)
export const bulkSetAvailability = async (req, res) => {
  try {
    const { doctorId, dates, isAvailable, year } = req.body;
    const centerId = req.user.centerId;

    if (!doctorId || !dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ 
        message: 'Doctor ID and dates array are required' 
      });
    }

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    // Verify doctor belongs to center
    const doctor = await User.findOne({ 
      _id: doctorId, 
      centerId: centerId, 
      role: 'doctor' 
    });

    if (!doctor) {
      return res.status(404).json({ 
        message: 'Doctor not found or does not belong to this center' 
      });
    }

    // If setting as available, try to get default working hours from existing availability records
    let defaultTiming = {
      startTime: '09:00',
      endTime: '17:00',
      breakStartTime: '13:00',
      breakEndTime: '14:00',
      maxAppointments: 50
    };

    if (isAvailable === true) {
      // Find any existing availability record for this doctor with timing to use as default
      const existingWithTiming = await DoctorAvailability.findOne({
        doctorId,
        centerId,
        startTime: { $ne: null },
        endTime: { $ne: null },
        isHoliday: false
      }).sort({ date: -1 });

      if (existingWithTiming) {
        defaultTiming = {
          startTime: existingWithTiming.startTime || '09:00',
          endTime: existingWithTiming.endTime || '17:00',
          breakStartTime: existingWithTiming.breakStartTime || '13:00',
          breakEndTime: existingWithTiming.breakEndTime || '14:00',
          maxAppointments: existingWithTiming.maxAppointments || 50
        };
      }
    }

    // Bulk upsert availability
    const operations = dates.map(date => {
      // Normalize date to midnight - handle both string and Date objects
      let cleanDate;
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        // Parse YYYY-MM-DD format and create date at local midnight
        const [year, month, day] = date.split('-').map(Number);
        cleanDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      } else {
        cleanDate = new Date(date);
        cleanDate.setHours(0, 0, 0, 0);
      }
      
      // Create end of day for range query to catch dates stored with time components
      const startOfDay = new Date(cleanDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(cleanDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const updateData = {
        doctorId,
        centerId,
        date: cleanDate, // Store normalized date
        isAvailable: isAvailable !== undefined ? isAvailable : false,
        isHoliday: false, // Not a holiday, just unavailable/available
        holidayName: '',
        createdBy: req.user._id
      };

      // If setting as available, restore default timing
      if (isAvailable === true) {
        updateData.startTime = defaultTiming.startTime;
        updateData.endTime = defaultTiming.endTime;
        updateData.breakStartTime = defaultTiming.breakStartTime;
        updateData.breakEndTime = defaultTiming.breakEndTime;
        updateData.maxAppointments = defaultTiming.maxAppointments;
      } else {
        // If setting as unavailable, clear timing fields
        updateData.startTime = null;
        updateData.endTime = null;
        updateData.breakStartTime = null;
        updateData.breakEndTime = null;
        updateData.maxAppointments = 50;
      }
      
      return {
        updateOne: {
          // Use date range to match dates even if they have time components
          filter: { 
            doctorId, 
            centerId,
            date: { $gte: startOfDay, $lte: endOfDay }
          },
          update: {
            $set: updateData
          },
          upsert: true
        }
      };
    });

    await DoctorAvailability.bulkWrite(operations);

    // Auto-create slots for available dates with working hours (async, non-blocking)
    if (isAvailable === true && defaultTiming.startTime && defaultTiming.endTime) {
      // Return response immediately, create slots in background
      setImmediate(async () => {
        try {
          // Process in batches to avoid overwhelming the database
          const batchSize = 50;
          for (let i = 0; i < dates.length; i += batchSize) {
            const batch = dates.slice(i, i + batchSize);
            await Promise.all(batch.map(date => {
              let cleanDate;
              if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                const [year, month, day] = date.split('-').map(Number);
                cleanDate = new Date(year, month - 1, day, 0, 0, 0, 0);
              } else {
                cleanDate = new Date(date);
                cleanDate.setHours(0, 0, 0, 0);
              }
              
              return autoCreateSlotsForDate(
                doctorId,
                centerId,
                cleanDate,
                defaultTiming.startTime,
                defaultTiming.endTime,
                defaultTiming.breakStartTime,
                defaultTiming.breakEndTime,
                req.user._id,
                defaultTiming.slotDuration || 30
              );
            }));
          }
        } catch (error) {
          console.error('Error auto-creating slots in background:', error);
        }
      });
    }

    res.json({
      success: true,
      message: `Successfully set ${dates.length} dates as ${isAvailable ? 'available' : 'unavailable'}`,
      count: dates.length
    });
  } catch (error) {
    console.error('Error bulk setting availability:', error);
    res.status(500).json({ 
      message: 'Error bulk setting availability', 
      error: error.message 
    });
  }
};

// Get availability for a month range (for calendar view)
export const getMonthRangeAvailability = async (req, res) => {
  try {
    const { doctorId, startDate, endDate } = req.query;
    const centerId = req.user.centerId;

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        message: 'Start date and end date are required' 
      });
    }

    const query = { 
      centerId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    if (doctorId) {
      query.doctorId = doctorId;
    }

    const availabilities = await DoctorAvailability.find(query)
      .populate('doctorId', 'name email qualification')
      .sort({ date: 1, doctorId: 1 });

    res.json({
      success: true,
      availabilities
    });
  } catch (error) {
    console.error('Error fetching month range availability:', error);
    res.status(500).json({ 
      message: 'Error fetching availability', 
      error: error.message 
    });
  }
};

// Get doctor availability for a date range
export const getDoctorAvailability = async (req, res) => {
  try {
    const { doctorId, startDate, endDate } = req.query;
    const centerId = req.user.centerId;

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    const query = { centerId };
    
    if (doctorId) {
      query.doctorId = doctorId;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    }

    const availabilities = await DoctorAvailability.find(query)
      .populate('doctorId', 'name email qualification')
      .sort({ date: 1, doctorId: 1 });

    res.json({
      success: true,
      availabilities
    });
  } catch (error) {
    console.error('Error fetching doctor availability:', error);
    res.status(500).json({ 
      message: 'Error fetching doctor availability', 
      error: error.message 
    });
  }
};

// Create appointment slots for a doctor on a specific date
export const createAppointmentSlots = async (req, res) => {
  try {
    const { doctorId, date, slotDuration, startTime, endTime, breakStartTime, breakEndTime } = req.body;
    const centerId = req.user.centerId;

    if (!doctorId || !date || !startTime || !endTime) {
      return res.status(400).json({ 
        message: 'Doctor ID, date, start time, and end time are required' 
      });
    }

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    // Verify doctor belongs to center
    const doctor = await User.findOne({ 
      _id: doctorId, 
      centerId: centerId, 
      role: 'doctor' 
    });

    if (!doctor) {
      return res.status(404).json({ 
        message: 'Doctor not found or does not belong to this center' 
      });
    }

    // Check if doctor has availability record for this date with working hours
    // Allow slot creation if startTime/endTime are set, even if isAvailable is not explicitly true
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);
    
    const availability = await DoctorAvailability.findOne({
      doctorId,
      date: { $gte: dateStart, $lte: dateEnd },
      centerId
    });

    // Check if availability exists and has working hours, and is not explicitly unavailable or holiday
    if (!availability) {
      return res.status(400).json({ 
        message: 'No availability record found for this date. Please set availability times first.' 
      });
    }
    
    if (availability.isHoliday) {
      return res.status(400).json({ 
        message: 'Doctor is on holiday on this date' 
      });
    }
    
    if (availability.isAvailable === false) {
      return res.status(400).json({ 
        message: 'Doctor is marked as unavailable on this date' 
      });
    }
    
    if (!availability.startTime || !availability.endTime) {
      return res.status(400).json({ 
        message: 'Working hours not set for this date. Please set start time and end time first.' 
      });
    }
    
    // Use availability times if not provided in request
    const finalStartTime = startTime || availability.startTime;
    const finalEndTime = endTime || availability.endTime;
    const finalBreakStartTime = breakStartTime !== undefined ? breakStartTime : availability.breakStartTime;
    const finalBreakEndTime = breakEndTime !== undefined ? breakEndTime : availability.breakEndTime;

    const duration = slotDuration || 30; // Default 30 minutes
    const slots = [];
    
    // Parse times
    const parseTime = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes; // Convert to minutes
    };

    const formatTime = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const startMinutes = parseTime(finalStartTime);
    const endMinutes = parseTime(finalEndTime);
    const breakStartMinutes = finalBreakStartTime ? parseTime(finalBreakStartTime) : null;
    const breakEndMinutes = finalBreakEndTime ? parseTime(finalBreakEndTime) : null;

    // Generate slots
    let currentMinutes = startMinutes;
    
    while (currentMinutes + duration <= endMinutes) {
      // Skip break time if exists
      if (breakStartMinutes && breakEndMinutes) {
        if (currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes) {
          currentMinutes = breakEndMinutes;
          continue;
        }
      }

      const slotStartTime = formatTime(currentMinutes);
      const slotEndTime = formatTime(currentMinutes + duration);

      // Check if slot already exists
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);
      
      const existingSlot = await AppointmentSlot.findOne({
        doctorId,
        date: { $gte: dateStart, $lte: dateEnd },
        centerId,
        startTime: slotStartTime,
        endTime: slotEndTime
      });

      if (!existingSlot) {
        const slotDate = new Date(date);
        slotDate.setHours(0, 0, 0, 0);
        
        slots.push({
          doctorId,
          centerId,
          date: slotDate,
          startTime: slotStartTime,
          endTime: slotEndTime,
          duration,
          isBooked: false,
          status: 'available',
          createdBy: req.user._id
        });
      }

      currentMinutes += duration;
    }

    // Bulk insert slots
    if (slots.length > 0) {
      await AppointmentSlot.insertMany(slots);
    }

    res.json({
      success: true,
      message: `Created ${slots.length} appointment slots`,
      slotsCreated: slots.length,
      totalSlots: slots.length
    });
  } catch (error) {
    console.error('Error creating appointment slots:', error);
    res.status(500).json({ 
      message: 'Error creating appointment slots', 
      error: error.message 
    });
  }
};

// Get appointment slots for a doctor on a specific date
export const getAppointmentSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    const centerId = req.user.centerId;

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    if (!doctorId || !date) {
      return res.status(400).json({ 
        message: 'Doctor ID and date are required' 
      });
    }

    // Normalize date to start and end of day for query
    const dateObj = new Date(date);
    const dateStart = new Date(dateObj);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateObj);
    dateEnd.setHours(23, 59, 59, 999);

    const slots = await AppointmentSlot.find({
      doctorId,
      centerId,
      date: { $gte: dateStart, $lte: dateEnd }
    })
    .populate('patientId', 'name uhId phone')
    .populate('patientAppointmentId', 'patientName confirmationCode status')
    .populate('bookedBy', 'name')
    .sort({ startTime: 1 });

    // Get appointment count for the day
    const bookedCount = slots.filter(s => s.isBooked).length;
    const availableCount = slots.filter(s => !s.isBooked).length;

    res.json({
      success: true,
      slots,
      summary: {
        total: slots.length,
        booked: bookedCount,
        available: availableCount
      }
    });
  } catch (error) {
    console.error('Error fetching appointment slots:', error);
    res.status(500).json({ 
      message: 'Error fetching appointment slots', 
      error: error.message 
    });
  }
};

// Get all appointments for doctors on a specific date (for calendar view)
export const getDayAppointments = async (req, res) => {
  try {
    const { date } = req.query;
    const centerId = req.user.centerId;

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    if (!date) {
      return res.status(400).json({ 
        message: 'Date is required' 
      });
    }

    // Get all slots for all doctors in center on this date
    const slots = await AppointmentSlot.find({
      centerId,
      date: new Date(date),
      isBooked: true
    })
    .populate('doctorId', 'name email qualification')
    .populate('patientId', 'name uhId phone age gender')
    .populate('patientAppointmentId', 'patientName confirmationCode status preferredDate preferredTime')
    .populate('bookedBy', 'name')
    .sort({ 'doctorId': 1, startTime: 1 });

    // Group by doctor
    const appointmentsByDoctor = {};
    slots.forEach(slot => {
      const doctorId = slot.doctorId._id.toString();
      if (!appointmentsByDoctor[doctorId]) {
        appointmentsByDoctor[doctorId] = {
          doctor: slot.doctorId,
          appointments: []
        };
      }
      appointmentsByDoctor[doctorId].appointments.push(slot);
    });

    // Get slot counts per doctor
    const allSlots = await AppointmentSlot.find({
      centerId,
      date: new Date(date)
    }).select('doctorId isBooked');

    const doctorStats = {};
    allSlots.forEach(slot => {
      const doctorId = slot.doctorId.toString();
      if (!doctorStats[doctorId]) {
        doctorStats[doctorId] = {
          total: 0,
          booked: 0,
          available: 0
        };
      }
      doctorStats[doctorId].total++;
      if (slot.isBooked) {
        doctorStats[doctorId].booked++;
      } else {
        doctorStats[doctorId].available++;
      }
    });

    res.json({
      success: true,
      date,
      appointmentsByDoctor,
      doctorStats
    });
  } catch (error) {
    console.error('Error fetching day appointments:', error);
    res.status(500).json({ 
      message: 'Error fetching day appointments', 
      error: error.message 
    });
  }
};

// Book a slot for a patient (receptionist)
export const bookSlotForPatient = async (req, res) => {
  try {
    const { slotId, patientId, patientAppointmentId, notes } = req.body;
    const centerId = req.user.centerId;

    if (!slotId || !patientId) {
      return res.status(400).json({ 
        message: 'Slot ID and Patient ID are required' 
      });
    }

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    // Find the slot
    const slot = await AppointmentSlot.findOne({
      _id: slotId,
      centerId,
      isBooked: false
    });

    if (!slot) {
      return res.status(404).json({ 
        message: 'Slot not found or already booked' 
      });
    }

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ 
        message: 'Patient not found' 
      });
    }

    // If patientAppointmentId is provided, automatically confirm the appointment
    if (patientAppointmentId) {
      try {
        const appointment = await PatientAppointment.findById(patientAppointmentId);
        if (appointment) {
          // Update appointment status to confirmed if not already confirmed
          if (appointment.status !== 'confirmed') {
            appointment.status = 'confirmed';
            appointment.confirmedAt = new Date();
            
            // Set confirmed date and time from slot
            if (slot.date) {
              appointment.confirmedDate = slot.date;
            }
            if (slot.startTime) {
              appointment.confirmedTime = slot.startTime;
            }
            
            // If confirmedDate/confirmedTime are not set, use preferredDate/preferredTime
            if (!appointment.confirmedDate) {
              appointment.confirmedDate = appointment.preferredDate;
            }
            if (!appointment.confirmedTime) {
              appointment.confirmedTime = appointment.preferredTime;
            }
            
            await appointment.save();
            console.log(`Appointment ${patientAppointmentId} automatically confirmed when slot was booked`);
          }
        }
      } catch (appointmentError) {
        console.error('Error updating appointment status:', appointmentError);
        // Don't fail the slot booking if appointment update fails, but log it
      }
    }

    // Book the slot
    slot.isBooked = true;
    slot.patientId = patientId;
    slot.patientAppointmentId = patientAppointmentId || null;
    slot.bookedBy = req.user._id;
    slot.bookedAt = new Date();
    slot.status = 'booked';
    slot.notes = notes || '';

    await slot.save();

    res.json({
      success: true,
      message: 'Slot booked successfully',
      slot: await AppointmentSlot.findById(slot._id)
        .populate('patientId', 'name uhId phone')
        .populate('bookedBy', 'name')
    });
  } catch (error) {
    console.error('Error booking slot:', error);
    res.status(500).json({ 
      message: 'Error booking slot', 
      error: error.message 
    });
  }
};

// Cancel a booked slot and make it available again
export const cancelBookedSlot = async (req, res) => {
  try {
    const { slotId, cancellationReason } = req.body;
    const centerId = req.user.centerId;

    if (!slotId) {
      return res.status(400).json({
        message: 'Slot ID is required'
      });
    }

    if (!centerId) {
      return res.status(400).json({
        message: 'Center ID is required'
      });
    }

    const slot = await AppointmentSlot.findOne({
      _id: slotId,
      centerId
    });

    if (!slot) {
      return res.status(404).json({
        message: 'Slot not found'
      });
    }

    if (!slot.isBooked) {
      return res.status(400).json({
        message: 'Slot is not currently booked'
      });
    }

    const linkedAppointmentId = slot.patientAppointmentId;

    slot.isBooked = false;
    slot.patientId = null;
    slot.patientAppointmentId = null;
    slot.bookedBy = null;
    slot.bookedAt = null;
    slot.status = 'available';

    if (cancellationReason) {
      const timestamp = new Date().toISOString();
      slot.notes = slot.notes && slot.notes.trim().length > 0
        ? `${slot.notes}\nCancelled on ${timestamp}: ${cancellationReason}`
        : `Cancelled on ${timestamp}: ${cancellationReason}`;
    }

    await slot.save();

    if (linkedAppointmentId) {
      try {
        const appointment = await PatientAppointment.findById(linkedAppointmentId);
        if (appointment) {
          appointment.status = 'cancelled';
          appointment.cancelledAt = new Date();
          if (cancellationReason) {
            appointment.cancellationReason = cancellationReason;
          } else if (!appointment.cancellationReason) {
            appointment.cancellationReason = 'Cancelled via slot management';
          }
          await appointment.save();
        }
      } catch (appointmentError) {
        console.error('Error updating linked appointment during slot cancellation:', appointmentError);
        // Continue even if appointment update fails
      }
    }

    res.json({
      success: true,
      message: 'Slot booking cancelled successfully',
      slot
    });
  } catch (error) {
    console.error('Error cancelling slot booking:', error);
    res.status(500).json({
      message: 'Error cancelling slot booking',
      error: error.message
    });
  }
};

// Delete appointment slots for a doctor on a date
export const deleteAppointmentSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.body;
    const centerId = req.user.centerId;

    if (!doctorId || !date) {
      return res.status(400).json({ 
        message: 'Doctor ID and date are required' 
      });
    }

    if (!centerId) {
      return res.status(400).json({ 
        message: 'Center ID is required' 
      });
    }

    // Only delete slots that are not booked
    const result = await AppointmentSlot.deleteMany({
      doctorId,
      centerId,
      date: new Date(date),
      isBooked: false
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} appointment slots`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting appointment slots:', error);
    res.status(500).json({ 
      message: 'Error deleting appointment slots', 
      error: error.message 
    });
  }
};

