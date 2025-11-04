# SMS Templates for Fast2SMS - Appointment Booking System

This document provides a comprehensive guide to all SMS templates available for the appointment booking process using Fast2SMS provider.

## Fast2SMS Configuration

### Environment Variables Required:
```env
SMS_PROVIDER=fast2sms
FAST2SMS_API_KEY=your_api_key_here
FAST2SMS_SENDER_ID=FSTSMS  # Optional, defaults to FSTSMS
```

### API Setup:
1. Sign up at https://www.fast2sms.com/
2. Get your API key from the dashboard
3. Add the API key to your `.env` file
4. Set `SMS_PROVIDER=fast2sms` in your environment

## Available SMS Templates

### 1. Appointment Booking Success
**Function:** `sendAppointmentBookingSMS(appointment)`

**When to use:** Sent immediately after a patient books an appointment (initial booking request).

**Template:**
```
Dear [Patient Name],

Your appointment request received!

Booking ID: [Confirmation Code]
Center: [Center Name]

Our team will contact you shortly to confirm your slot. Keep this code for reference.

ChanRe Allergy Center
```

**Example Usage:**
```javascript
import { sendAppointmentBookingSMS } from '../utils/smsService.js';

await sendAppointmentBookingSMS(appointment);
```

---

### 2. Appointment Confirmation
**Function:** `sendAppointmentConfirmationSMS(appointment)`

**When to use:** Sent when an appointment is confirmed by the receptionist/admin.

**Template:**
```
Dear [Patient Name],

Appointment CONFIRMED!

ID: [Confirmation Code]
Date: [Date]
Time: [Time]
Center: [Center Name]
Phone: [Center Phone]

Please arrive 15 mins early. Bring ID proof & previous reports.

ChanRe Allergy Center
```

**Example Usage:**
```javascript
import { sendAppointmentConfirmationSMS } from '../utils/smsService.js';

await sendAppointmentConfirmationSMS(appointment);
```

---

### 3. Appointment Rescheduled
**Function:** `sendAppointmentRescheduledSMS(appointment)`

**When to use:** Sent when an appointment date/time is changed/rescheduled.

**Template:**
```
Dear [Patient Name],

Your appointment has been RESCHEDULED!

ID: [Confirmation Code]
New Date: [Date]
New Time: [Time]
Center: [Center Name]

Please note the changes. Reach 15 mins before appointment.

ChanRe Allergy Center
```

**Example Usage:**
```javascript
import { sendAppointmentRescheduledSMS } from '../utils/smsService.js';

await sendAppointmentRescheduledSMS(appointment);
```

---

### 4. Appointment Cancellation
**Function:** `sendAppointmentCancelledSMS(appointment)`

**When to use:** Sent when an appointment is cancelled (by patient or center).

**Template:**
```
Dear [Patient Name],

Appointment CANCELLED!

ID: [Confirmation Code]
Center: [Center Name]
Reason: [Cancellation Reason]

To book a new appointment, call us or visit our website.

Thank you.
ChanRe Allergy Center
```

**Example Usage:**
```javascript
import { sendAppointmentCancelledSMS } from '../utils/smsService.js';

// Make sure to set cancellationReason before sending
appointment.cancellationReason = 'Slot unavailable';
await sendAppointmentCancelledSMS(appointment);
```

---

### 5. Appointment Reminder (Day Before)
**Function:** `sendAppointmentReminderSMS(appointment)`

**When to use:** Sent one day before the confirmed appointment date as a reminder.

**Template:**
```
Dear [Patient Name],

REMINDER: Your appointment is tomorrow!

ID: [Confirmation Code]
Date: [Date]
Time: [Time]
Center: [Center Name]
Address: [Center Address]

Please arrive 15 mins early. Bring ID proof & medical reports.

ChanRe Allergy Center
```

**Example Usage:**
```javascript
import { sendAppointmentReminderSMS } from '../utils/smsService.js';

// Schedule this to run daily, checking for appointments scheduled for tomorrow
await sendAppointmentReminderSMS(appointment);
```

**Implementation Tip:** Create a cron job or scheduled task to send reminders:
```javascript
// Example: Run daily at 9 AM to check appointments for tomorrow
const cron = require('node-cron');
const PatientAppointment = require('./models/PatientAppointment.js');
const { sendAppointmentReminderSMS } = require('./utils/smsService.js');

cron.schedule('0 9 * * *', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const dayAfter = new Date(tomorrow);
  dayAfter.setHours(23, 59, 59, 999);
  
  const appointments = await PatientAppointment.find({
    status: 'confirmed',
    confirmedDate: { $gte: tomorrow, $lte: dayAfter }
  });
  
  for (const appointment of appointments) {
    await sendAppointmentReminderSMS(appointment);
  }
});
```

---

### 6. Appointment Rejected/Declined
**Function:** `sendAppointmentRejectedSMS(appointment)`

**When to use:** Sent when an appointment request is rejected or declined by the center.

**Template:**
```
Dear [Patient Name],

We regret to inform that your appointment request (ID: [Confirmation Code]) at [Center Name] could not be confirmed.

Please contact us to book an alternative slot or visit our website for more options.

ChanRe Allergy Center
```

**Example Usage:**
```javascript
import { sendAppointmentRejectedSMS } from '../utils/smsService.js';

await sendAppointmentRejectedSMS(appointment);
```

---

### 7. Appointment Completed
**Function:** `sendAppointmentCompletedSMS(appointment)`

**When to use:** Sent after an appointment is marked as completed (follow-up message).

**Template:**
```
Dear [Patient Name],

Thank you for visiting [Center Name]!

Appointment ID: [Confirmation Code]

We hope you had a good experience. For follow-up appointments or queries, please contact us.

Stay healthy!
ChanRe Allergy Center
```

**Example Usage:**
```javascript
import { sendAppointmentCompletedSMS } from '../utils/smsService.js';

await sendAppointmentCompletedSMS(appointment);
```

---

### 8. Appointment No-Show
**Function:** `sendAppointmentNoShowSMS(appointment)`

**When to use:** Sent when a patient doesn't show up for their appointment.

**Template:**
```
Dear [Patient Name],

We noticed you missed your appointment (ID: [Confirmation Code]) at [Center Name].

Please contact us to reschedule or cancel if needed. Your health is important to us.

ChanRe Allergy Center
```

**Example Usage:**
```javascript
import { sendAppointmentNoShowSMS } from '../utils/smsService.js';

await sendAppointmentNoShowSMS(appointment);
```

---

## Appointment Object Structure

All SMS functions expect an appointment object with the following properties:

```javascript
{
  patientName: String,           // Required
  patientPhone: String,          // Required (10 digits)
  patientEmail: String,          // Optional
  confirmationCode: String,      // Required (6-digit code)
  centerName: String,            // Required
  centerPhone: String,           // Optional
  centerAddress: String,         // Optional
  preferredDate: Date,           // Required
  preferredTime: String,         // Required (e.g., "14:30" or "2:30 PM")
  confirmedDate: Date,           // Optional (for confirmed appointments)
  confirmedTime: String,         // Optional (for confirmed appointments)
  cancellationReason: String     // Optional (for cancellation SMS)
}
```

## Date and Time Formatting

- **Date Format:** Automatically formatted as "DD MMM YYYY" (e.g., "15 Jan 2024")
- **Time Format:** Automatically converted from 24-hour to 12-hour format (e.g., "14:30" → "2:30 PM")

## Implementation Examples

### In Appointment Controller

```javascript
import { 
  sendAppointmentBookingSMS,
  sendAppointmentConfirmationSMS,
  sendAppointmentRescheduledSMS,
  sendAppointmentCancelledSMS,
  sendAppointmentRejectedSMS,
  sendAppointmentCompletedSMS,
  sendAppointmentNoShowSMS
} from '../utils/smsService.js';

// When booking an appointment
export const bookAppointment = async (req, res) => {
  const appointment = await PatientAppointment.create({...});
  await sendAppointmentBookingSMS(appointment);
  // ...
};

// When confirming an appointment
export const confirmAppointment = async (req, res) => {
  appointment.status = 'confirmed';
  await appointment.save();
  await sendAppointmentConfirmationSMS(appointment);
  // ...
};

// When rescheduling
export const rescheduleAppointment = async (req, res) => {
  appointment.confirmedDate = newDate;
  appointment.confirmedTime = newTime;
  await appointment.save();
  await sendAppointmentRescheduledSMS(appointment);
  // ...
};

// When cancelling
export const cancelAppointment = async (req, res) => {
  appointment.status = 'cancelled';
  appointment.cancellationReason = reason;
  appointment.cancelledAt = new Date();
  await appointment.save();
  await sendAppointmentCancelledSMS(appointment);
  // ...
};
```

## Testing SMS Templates

To test SMS templates without sending actual SMS:

```javascript
// Set SMS_PROVIDER=none in .env to disable SMS sending
// The system will log the message instead of sending it
```

## Fast2SMS Route Parameters

The current implementation uses:
- **Route:** `q` (Quick SMS - fastest delivery)
- **Language:** `english`

Available routes:
- `q` - Quick SMS (fastest)
- `dlt` - DLT registered template (requires DLT template ID)
- `otp` - OTP messages
- `promotional` - Promotional messages

To use DLT templates, modify the `sendFast2SMS` function in `smsService.js`:

```javascript
body: JSON.stringify({
  message: message,
  language: 'english',
  route: 'dlt',
  numbers: phoneNumber,
  variables_values: '123456' // For template variables
})
```

## Best Practices

1. **Always check phone number availability** before sending SMS
2. **Handle errors gracefully** - Don't fail appointment operations if SMS fails
3. **Log SMS attempts** for debugging and tracking
4. **Use reminders** to reduce no-shows
5. **Keep messages concise** - Fast2SMS charges per SMS (160 characters = 1 SMS)
6. **Test templates** before going live
7. **Monitor SMS delivery** rates and adjust templates if needed

## SMS Cost Optimization

- Each SMS is ~160 characters = 1 SMS unit
- Longer messages are split into multiple SMS units
- All templates are optimized to be concise while maintaining clarity
- Consider using DLT templates for promotional messages (cheaper rates)

## Support

For Fast2SMS API issues:
- API Documentation: https://docs.fast2sms.com/
- Support: support@fast2sms.com

