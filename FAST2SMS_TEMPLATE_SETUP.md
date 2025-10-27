# Fast2SMS Template Setup Guide

## 🎯 **Good News: You DON'T need to register templates!**

Fast2SMS allows you to send **any message content** without pre-registering templates. Your current setup works perfectly!

---

## 📝 **Current Setup (Recommended)**

Your code in `utils/smsService.js` already handles everything automatically. The messages are generated dynamically and sent directly.

**No template registration needed!**

---

## 🔄 **Optional: If Fast2SMS Requires Template Approval**

If your Fast2SMS account requires templates (for promotional SMS), follow these steps:

### **Step 1: Login to Fast2SMS Dashboard**
1. Go to https://www.fast2sms.com
2. Login to your account

### **Step 2: Add Template**
1. Go to **"Templates"** section
2. Click **"Add New Template"**
3. Add this template:

**Template Name:** Appointment Request  
**Message:**
```
Dear {name}, Your appointment request has been sent! Confirmation Code: {code}, Center: {center}. Our receptionist will contact you soon. - ChanRe
```

4. Submit for approval (usually 1-2 hours)

### **Step 3: Add Another Template**

**Template Name:** Appointment Confirmation  
**Message:**
```
Dear {name}, Your appointment scheduled! Code: {code}, Center: {center}, Date: {date}, Time: {time}. Arrive 15 mins early. - ChanRe
```

### **Step 4: Update Your Code (If Using Templates)**

If you want to use registered templates instead:

```javascript
// In utils/smsService.js, update sendFast2SMS function:
body: JSON.stringify({
  variables_values: `${appointment.patientName}|${appointment.confirmationCode}|${appointment.centerName}`,
  template_id: 'YOUR_TEMPLATE_ID', // Get from Fast2SMS dashboard
  route: 'dlt',
  numbers: phoneNumber
})
```

---

## ✅ **Recommended: Keep Current Setup**

**Your current setup is better** because:
- ✅ Works immediately (no template approval wait)
- ✅ Flexible content (you can change messages anytime)
- ✅ No template approval delays
- ✅ Already working in your code

**Just use your API key in `.env` and you're done!**

---

## 🎯 **What You Need to Do**

Just add your Fast2SMS API key to `.env`:

```env
SMS_PROVIDER=fast2sms
FAST2SMS_API_KEY=your_api_key_here
FAST2SMS_SENDER_ID=FSTSMS
```

That's it! No template registration needed! 🚀
