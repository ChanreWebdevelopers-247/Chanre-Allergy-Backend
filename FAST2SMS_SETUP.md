# 📱 Fast2SMS Setup Guide for ChanRe Allergy Center

Since you already have a Fast2SMS account, this is the **quickest way** to add SMS notifications!

---

## ✅ **Why Fast2SMS?**

- ✅ **You already have an account** - No signup needed!
- ✅ **Super cheap** - ₹0.10-0.15 per SMS (cheapest option!)
- ✅ **Very reliable** for India
- ✅ **Instant setup** - Just 3 steps

---

## 🚀 **QUICK SETUP (3 Minutes)**

### **Step 1: Get Your API Key**

1. **Login** to https://www.fast2sms.com
2. Click on **your profile** (top right)
3. Go to **"API Keys"** section
4. **Copy your API Key** (looks like: `abc123def456ghi789`)

![Fast2SMS API Key Location]

---

### **Step 2: Add to .env File**

Open your `.env` file in the backend folder and add:

```env
# SMS Provider
SMS_PROVIDER=fast2sms

# Fast2SMS Credentials
FAST2SMS_API_KEY=your_api_key_here
FAST2SMS_SENDER_ID=FSTSMS
```

**Replace `your_api_key_here` with your actual API key from Step 1!**

---

### **Step 3: Restart Server**

```bash
# Stop your server (Ctrl+C)
# Then start again:
npm run dev
```

---

## 🧪 **Test It!**

1. Book a test appointment on your website
2. Check server logs - you should see:
   ```
   SMS sent successfully via fast2sms
   ```
3. Check patient's phone for SMS

---

## 📋 **Complete .env Example**

Here's what your complete `.env` file should look like:

```env
# ===========================================
# DATABASE
# ===========================================
MONGODB_URI=mongodb://localhost:27017/chambre-allergy

# ===========================================
# SERVER
# ===========================================
PORT=5000
JWT_SECRET=your_jwt_secret_here

# ===========================================
# EMAIL (Required - Already Working)
# ===========================================
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# ===========================================
# SMS - Fast2SMS (You have account!)
# ===========================================
SMS_PROVIDER=fast2sms
FAST2SMS_API_KEY=abc123def456ghi789
FAST2SMS_SENDER_ID=FSTSMS
```

---

## 💰 **Cost Details**

### **Fast2SMS Pricing:**
- **Per SMS:** ₹0.10 - ₹0.15 (super affordable!)
- **No free tier** but cheaper than alternatives
- **Minimum recharge:** Usually ₹100

### **Cost Example:**
If you get **100 appointments/month** (200 SMS):
- **Cost:** ₹20 - ₹30/month
- **That's it!** Very affordable

### **Comparison:**
| Service | Cost per SMS | Free Tier |
|---------|--------------|-----------|
| **Fast2SMS** | ₹0.10-0.15 | None (cheapest!) |
| MSG91 | ₹0.20 | 100 SMS free |
| TextLocal | ₹0.20 | Trial credits |

---

## 📞 **SMS Formats**

Your patients will receive **TWO types of SMS**:

### **1. Appointment Request SMS (Sent when patient books):**
```
Dear John Doe,

Your appointment request has been sent!

Confirmation Code: ABC123
Center: ChanRe Allergy Center

Our receptionist will contact you soon to confirm your appointment.

Please keep this confirmation code for reference.

- ChanRe Allergy Center
```

### **2. Appointment Confirmation SMS (Sent when staff confirms):**
```
Dear John Doe,

Your appointment has been scheduled!

Confirmation Code: ABC123
Center: ChanRe Allergy Center
Date: 15/12/2024
Time: 10:00 AM

Please arrive 15 minutes before your appointment.

- ChanRe Allergy Center
```

---

## ❌ **Troubleshooting**

### **SMS Not Sending?**

1. **Check API Key:**
   - Make sure it's copied correctly from Fast2SMS dashboard
   - No extra spaces or quotes

2. **Check .env file:**
   ```env
   SMS_PROVIDER=fast2sms
   FAST2SMS_API_KEY=your_actual_key_here
   ```

3. **Check server logs:**
   - Look for: `SMS sent successfully via fast2sms`
   - If error: Check the error message

4. **Check Fast2SMS balance:**
   - Login to Fast2SMS dashboard
   - Check if you have sufficient balance

### **Common Issues:**

- **"Invalid API Key"** → Check your API key in Fast2SMS dashboard
- **"Insufficient balance"** → Add balance to Fast2SMS account
- **"SMS not received"** → Check phone number format (use +91 prefix)
- **"Server not restarted"** → Restart server after .env changes

---

## 🎯 **What You Need**

Just **2 details** from your Fast2SMS account:

1. **API Key** - Get from Fast2SMS dashboard → API Keys
2. **Sender ID** - Usually "FSTSMS" (default, can leave as is)

That's it!

---

## ✅ **Quick Checklist**

- [ ] Logged into Fast2SMS account
- [ ] Got API Key from dashboard
- [ ] Added to .env file:
  ```env
  SMS_PROVIDER=fast2sms
  FAST2SMS_API_KEY=your_key
  FAST2SMS_SENDER_ID=FSTSMS
  ```
- [ ] Restarted server
- [ ] Tested by booking appointment
- [ ] Received SMS on test phone

---

## 🆘 **Need Help?**

1. **Check SMS service file:** `utils/smsService.js` - Fast2SMS is already integrated!
2. **Check server logs** for error messages
3. **Verify API Key** in Fast2SMS dashboard
4. **Check Fast2SMS balance** in your account

---

## 🎉 **You're Done!**

That's it! Fast2SMS is now integrated into your appointment booking system.

**Next time a patient books an appointment:**
- ✅ They'll receive email (free, unlimited)
- ✅ They'll receive SMS via Fast2SMS (₹0.10-0.15 per SMS)

---

**Fast2SMS is one of the most affordable SMS services for India. Since you already have an account, you're all set!** 🚀
