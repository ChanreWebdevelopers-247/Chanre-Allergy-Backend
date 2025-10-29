import DoctorAvailability from '../models/DoctorAvailability.js';
import AppointmentSlot from '../models/AppointmentSlot.js';
import User from '../models/User.js';
import PatientAppointment from '../models/PatientAppointment.js';
import Patient from '../models/Patient.js';

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

    // If it's a holiday, set isAvailable to false
    const finalIsAvailable = isHoliday ? false : (isAvailable !== undefined ? isAvailable : true);

    // Create or update availability
    const availability = await DoctorAvailability.findOneAndUpdate(
      { doctorId, date: new Date(date), centerId },
      {
        doctorId,
        centerId,
        date: new Date(date),
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
    const operations = dates.map(date => ({
      updateOne: {
        filter: { doctorId, date: new Date(date), centerId },
        update: {
          $set: {
            doctorId,
            centerId,
            date: new Date(date),
            isAvailable: false,
            isHoliday: true,
            holidayName,
            createdBy: req.user._id
          }
        },
        upsert: true
      }
    }));

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

    // Check if doctor is available on this date
    const availability = await DoctorAvailability.findOne({
      doctorId,
      date: new Date(date),
      centerId,
      isAvailable: true
    });

    if (!availability) {
      return res.status(400).json({ 
        message: 'Doctor is not marked as available on this date' 
      });
    }

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

    const startMinutes = parseTime(startTime);
    const endMinutes = parseTime(endTime);
    const breakStartMinutes = breakStartTime ? parseTime(breakStartTime) : null;
    const breakEndMinutes = breakEndTime ? parseTime(breakEndTime) : null;

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
      const existingSlot = await AppointmentSlot.findOne({
        doctorId,
        date: new Date(date),
        centerId,
        startTime: slotStartTime,
        endTime: slotEndTime
      });

      if (!existingSlot) {
        slots.push({
          doctorId,
          centerId,
          date: new Date(date),
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

    const slots = await AppointmentSlot.find({
      doctorId,
      centerId,
      date: new Date(date)
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

