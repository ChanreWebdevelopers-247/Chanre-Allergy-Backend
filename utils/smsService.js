import twilio from 'twilio';

// Provider selection - can be 'twilio', 'aws-sns', 'msg91', 'textlocal', 'fast2sms', or 'none' to disable SMS
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'none';

// Twilio configuration
const createTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  
  if (!accountSid || !authToken || !fromNumber) {
    console.error('Twilio credentials not configured');
    return null;
  }
  
  return twilio(accountSid, authToken);
};

// MSG91 configuration (Free tier available for India)
const sendMSG91SMS = async (to, message) => {
  try {
    const authKey = process.env.MSG91_AUTH_KEY;
    const senderId = process.env.MSG91_SENDER_ID || 'CHANRE';
    
    if (!authKey) {
      throw new Error('MSG91 credentials not configured');
    }

    const url = 'https://control.msg91.com/api/v5/flow/';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'authkey': authKey
      },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_ID || '',
        recipient: [to],
        message: message
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('MSG91 SMS sent:', result);
      return { success: true, sid: result.request_id };
    } else {
      throw new Error(result.message || 'Failed to send SMS');
    }
  } catch (error) {
    console.error('MSG91 SMS Error:', error);
    return { success: false, error: error.message };
  }
};

// TextLocal configuration (Free tier available for India)
const sendTextLocalSMS = async (to, message) => {
  try {
    const apiKey = process.env.TEXTLOCAL_API_KEY;
    const sender = process.env.TEXTLOCAL_SENDER || 'TXTLCL';
    
    if (!apiKey) {
      throw new Error('TextLocal credentials not configured');
    }

    const url = 'https://api.textlocal.in/send/';
    const params = new URLSearchParams({
      apikey: apiKey,
      numbers: to,
      message: message,
      sender: sender
    });

    const response = await fetch(`${url}?${params.toString()}`);
    const result = await response.json();

    if (result.status === 'success') {
      console.log('TextLocal SMS sent:', result);
      return { success: true, sid: result.batch_id };
    } else {
      throw new Error(result.errors?.[0]?.message || 'Failed to send SMS');
    }
  } catch (error) {
    console.error('TextLocal SMS Error:', error);
    return { success: false, error: error.message };
  }
};

// AWS SNS configuration (Free tier: 1M free messages per month)
const sendAWSSNS = async (to, message) => {
  try {
    // This is a placeholder - AWS SNS requires AWS SDK
    // To implement: npm install @aws-sdk/client-sns
    const awsRegion = process.env.AWS_REGION || 'us-east-1';
    
    console.log('AWS SNS would send to:', to);
    console.log('Message:', message);
    
    // For now, return not implemented
    return { success: false, error: 'AWS SNS not yet implemented' };
  } catch (error) {
    console.error('AWS SNS Error:', error);
    return { success: false, error: error.message };
  }
};

// Fast2SMS configuration (India - Cheap and reliable)
const sendFast2SMS = async (to, message) => {
  try {
    const apiKey = process.env.FAST2SMS_API_KEY;
    const senderId = process.env.FAST2SMS_SENDER_ID || 'FSTSMS';
    
    if (!apiKey) {
      throw new Error('Fast2SMS credentials not configured');
    }

    // Remove + from phone number if present
    const phoneNumber = to.replace(/^\+/, '');
    
    const url = 'https://www.fast2sms.com/dev/bulkV2';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        language: 'english',
        route: 'q',
        numbers: phoneNumber
      })
    });

    const result = await response.json();
    
    if (result.return === true) {
      console.log('Fast2SMS sent:', result);
      return { success: true, sid: result.request_id || 'success' };
    } else {
      throw new Error(result.message || 'Failed to send SMS');
    }
  } catch (error) {
    console.error('Fast2SMS Error:', error);
    return { success: false, error: error.message };
  }
};

// SMS message templates
const smsTemplates = {
  appointmentBookingSuccess: (appointment) => 
    `Dear ${appointment.patientName},\n\n` +
    `Your appointment request has been sent!\n\n` +
    `Confirmation Code: ${appointment.confirmationCode}\n` +
    `Center: ${appointment.centerName}\n\n` +
    `Our receptionist will contact you soon to confirm your appointment.\n\n` +
    `Please keep this confirmation code for reference.\n\n` +
    `- ChanRe Allergy Center`,

  appointmentConfirmation: (appointment) => 
    `Dear ${appointment.patientName},\n\n` +
    `Your appointment has been scheduled!\n\n` +
    `Confirmation Code: ${appointment.confirmationCode}\n` +
    `Center: ${appointment.centerName}\n` +
    `Date: ${appointment.confirmedDate ? new Date(appointment.confirmedDate).toLocaleDateString() : new Date(appointment.preferredDate).toLocaleDateString()}\n` +
    `Time: ${appointment.confirmedTime || appointment.preferredTime}\n\n` +
    `Please arrive 15 minutes before your appointment.\n\n` +
    `- ChanRe Allergy Center`
};

// Send SMS function with multi-provider support
export const sendSMS = async (to, message) => {
  // Skip if SMS is disabled
  if (SMS_PROVIDER === 'none') {
    console.log('SMS is disabled (SMS_PROVIDER=none). Skipping SMS send.');
    return { success: false, error: 'SMS disabled' };
  }

  try {
    let result;

    switch (SMS_PROVIDER.toLowerCase()) {
      case 'twilio':
        const client = createTwilioClient();
        if (!client) {
          return { success: false, error: 'Twilio not configured' };
        }
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;
        const twilioResult = await client.messages.create({
          body: message,
          from: fromNumber,
          to: to
        });
        result = { success: true, sid: twilioResult.sid };
        console.log('Twilio SMS sent:', { to, sid: twilioResult.sid, status: twilioResult.status });
        break;

      case 'msg91':
        result = await sendMSG91SMS(to, message);
        break;

      case 'textlocal':
        result = await sendTextLocalSMS(to, message);
        break;

      case 'fast2sms':
        result = await sendFast2SMS(to, message);
        break;

      case 'aws-sns':
        result = await sendAWSSNS(to, message);
        break;

      default:
        console.error(`Unknown SMS provider: ${SMS_PROVIDER}`);
        return { success: false, error: `Unknown provider: ${SMS_PROVIDER}` };
    }

    if (result.success) {
      console.log('SMS sent successfully via', SMS_PROVIDER);
    } else {
      console.error(`SMS failed via ${SMS_PROVIDER}:`, result.error);
    }

    return result;
  } catch (error) {
    console.error(`Error sending SMS via ${SMS_PROVIDER}:`, error);
    return { success: false, error: error.message };
  }
};

// Send appointment booking confirmation SMS
export const sendAppointmentBookingSMS = async (appointment) => {
  try {
    if (!appointment.patientPhone) {
      console.log('Patient phone number not available, skipping SMS');
      return { success: false, error: 'No phone number' };
    }

    const message = smsTemplates.appointmentBookingSuccess(appointment);
    const result = await sendSMS(appointment.patientPhone, message);
    
    if (result.success) {
      console.log('Appointment booking SMS sent to:', appointment.patientPhone);
    }
    
    return result;
  } catch (error) {
    console.error('Error sending appointment booking SMS:', error);
    return { success: false, error: error.message };
  }
};

// Send appointment confirmation SMS
export const sendAppointmentConfirmationSMS = async (appointment) => {
  try {
    if (!appointment.patientPhone) {
      console.log('Patient phone number not available, skipping SMS');
      return { success: false, error: 'No phone number' };
    }

    const message = smsTemplates.appointmentConfirmation(appointment);
    const result = await sendSMS(appointment.patientPhone, message);
    
    if (result.success) {
      console.log('Appointment confirmation SMS sent to:', appointment.patientPhone);
    }
    
    return result;
  } catch (error) {
    console.error('Error sending appointment confirmation SMS:', error);
    return { success: false, error: error.message };
  }
};

export default {
  sendSMS,
  sendAppointmentBookingSMS,
  sendAppointmentConfirmationSMS
};
