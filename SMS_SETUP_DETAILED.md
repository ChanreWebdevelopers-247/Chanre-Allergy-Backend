# 📱 Complete SMS Setup Guide for ChanRe Allergy Center

This is a **complete step-by-step guide** to add SMS notifications to your website.

---

## 📋 **REQUIRED DETAILS SUMMARY**

| Detail | What It Is | Where to Get | Required? |
|--------|------------|--------------|-----------|
| SMS Provider | Which service to use | You choose | ✅ Yes |
| Auth Key/API Key | Your unique login | From provider website | ✅ Yes |
| Sender ID | What shows on SMS | Your choice (6 chars) | ✅ Yes |
| Phone Number | Where SMS comes from | Auto-assigned by provider | ⚠️ Optional |

---

## 🚀 **STEP-BY-STEP SETUP**

### **Step 1: Choose Your SMS Provider**

**Option A: Fast2SMS (You already have account!) ⭐ BEST CHOICE**
- ✅ Super cheap (₹0.10-0.15 per SMS)
- ✅ Very reliable for India
- ✅ Easy setup
- ✅ You already have an account

**Option B: MSG91 (Alternative for India)**
- ✅ 100 free SMS
- ✅ ₹0.20 per SMS after free
- ✅ No credit card needed
- ✅ Easy setup

**Option C: Email Only (Current Setup)**
- ✅ Unlimited emails - FREE forever
- ✅ Already working
- ✅ No setup needed

**Option D: Twilio (International)**
- ✅ $15 free credits (≈150 SMS)
- ✅ Global coverage
- ⚠️ Requires credit card

---

### **Step 2: Get Your Credentials**

#### **For Fast2SMS (You already have account!):** ⭐

1. **Login to your Fast2SMS account:**
   - Go to: https://www.fast2sms.com
   - Login with your credentials

2. **Get Your API Key:**
   - Click on your profile (top right)
   - Go to **"API Keys"** section
   - Copy your **"API Key"**
   - It looks like: `abc123def456ghi789`

3. **Get Sender ID:**
   - Default sender ID is usually "FSTSMS" (already set)
   - Or customize it in settings if needed

---

#### **OR For MSG91:**

1. **Sign Up:**
   - Go to: https://msg91.com
   - Click "Sign Up"
   - Enter your details (takes 2 minutes)

2. **Get Your Auth Key:**
   - Login to your MSG91 dashboard
   - Go to **"API"** section
   - Copy your **"Auth Key"**
   - It looks like: `1234567890abcdef`

3. **Set Sender ID:**
   - Go to **"Sender ID"** section
   - Enter: `CHANRE` (or any 6 letters)
   - Wait for approval (1-2 hours)

---

### **Step 3: Add to Your .env File**

Create or edit your `.env` file in the backend root folder:

**For Fast2SMS (Recommended since you have account):**
```env
# Set which provider you're using
SMS_PROVIDER=fast2sms

# Add your Fast2SMS credentials
FAST2SMS_API_KEY=your_api_key_here
FAST2SMS_SENDER_ID=FSTSMS
```

**OR For MSG91:**
```env
# Set which provider you're using
SMS_PROVIDER=msg91

# Add your MSG91 credentials
MSG91_AUTH_KEY=1234567890abcdef
MSG91_SENDER_ID=CHANRE
```

**That's it!** Just these 3 lines.

---

### **Step 4: Restart Your Server**

```bash
# Stop your server (Ctrl+C)
# Then start again:
npm run dev
```

---

### **Step 5: Test It!**

1. Book a test appointment on your website
2. Check the server logs - you should see:
   ```
   SMS sent successfully via msg91
   ```
3. Patient should receive SMS on their phone

---

## 📝 **COMPLETE .env FILE EXAMPLE**

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
# SMS (Optional - New Feature)
# ===========================================
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=1234567890abcdef
MSG91_SENDER_ID=CHANRE
```

---

## 🔍 **WHERE TO FIND EACH DETAIL**

### **1. SMS_PROVIDER**
**What:** Which SMS service to use
**Options:** `msg91`, `textlocal`, `twilio`, `none`
**Example:** `SMS_PROVIDER=msg91`

---

### **2. MSG91_AUTH_KEY**
**What:** Your unique API key from MSG91
**Where to get:** 
1. Login to https://msg91.com
2. Go to "API" section
3. Copy "Auth Key"
**Format:** `1234567890abcdef` (alphanumeric string)

---

### **3. MSG91_SENDER_ID**
**What:** What appears on patient's phone
**Options:** Any 6 letters (e.g., `CHANRE`, `CHANAC`)
**How to set:**
1. Login to MSG91 dashboard
2. Go to "Sender ID" section
3. Submit your ID (e.g., `CHANRE`)
4. Wait 1-2 hours for approval
**Note:** Without approval, SMS won't send

---

## 🆓 **FREE TIER DETAILS**

### **MSG91 Free Tier:**
- ✅ **100 SMS** free on signup
- ✅ **No credit card** required
- ✅ **No time limit** - free credits don't expire
- ✅ **Then:** ₹0.20 per SMS (very cheap)

### **After 100 SMS Used Up:**
- Add balance to MSG91 account (minimum ₹100)
- Or switch to email-only (free forever)

---

## 📞 **SMS FORMATS**

Patients will receive **TWO types of SMS**:

### **1. Appointment Request SMS (when patient books):**
```
Dear John Doe,

Your appointment request has been sent!

Confirmation Code: ABC123
Center: ChanRe Allergy Center

Our receptionist will contact you soon to confirm your appointment.

Please keep this confirmation code for reference.

- ChanRe Allergy Center
```

### **2. Appointment Confirmation SMS (when staff confirms):**
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

## 🧪 **TESTING CHECKLIST**

- [ ] Signed up with MSG91
- [ ] Got Auth Key from dashboard
- [ ] Applied for Sender ID (CHANRE)
- [ ] Added credentials to .env file
- [ ] Restarted server
- [ ] Booked test appointment
- [ ] Checked server logs
- [ ] Received SMS on phone

---

## ❌ **TROUBLESHOOTING**

### **SMS Not Sending?**

1. **Check .env file:**
   ```bash
   # Make sure these are set:
   SMS_PROVIDER=msg91
   MSG91_AUTH_KEY=your_key_here
   ```

2. **Check server logs:**
   - Look for: `SMS sent successfully via msg91`
   - If error: Check the error message

3. **Common Issues:**
   - Wrong phone format: Use `+91` prefix (e.g., `+919876543210`)
   - Sender ID not approved: Wait 1-2 hours
   - Free credits exhausted: Add balance
   - Server not restarted: Restart after .env changes

---

## 💰 **COST CALCULATION**

### **If you get 100 appointments/month:**

- **SMS:** 100 × 2 = 200 SMS/month
- **First month:** FREE (100 free SMS)
- **Monthly cost after:** ₹20 (₹0.20 per SMS)
- **Email:** FREE forever

### **Alternative: Email Only**

- **Cost:** ₹0
- **Unlimited:** Yes
- **Setup:** Already done!

---

## ✅ **RECOMMENDED APPROACH**

### **Start with Email Only (Free):**
```env
SMS_PROVIDER=none
```
- Zero cost
- Already working
- Unlimited emails

### **Add SMS Later (If needed):**
```env
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=your_key_here
MSG91_SENDER_ID=CHANRE
```
- 100 free SMS
- Then ₹0.20 per SMS
- Optional enhancement

---

## 🆘 **NEED HELP?**

1. **Check SMS_SETUP.md** for quick reference
2. **Check server logs** for error messages
3. **Test with email first** - it's already free and working
4. **Try MSG91 later** if you need SMS

---

## 📌 **QUICK START SUMMARY**

### **For Fast2SMS (You already have account):**

1. Login to: https://www.fast2sms.com
2. Get API Key from "API Keys" section
3. Add to .env:
   ```env
   SMS_PROVIDER=fast2sms
   FAST2SMS_API_KEY=your_api_key
   FAST2SMS_SENDER_ID=FSTSMS
   ```
4. Restart server
5. Test by booking appointment

**That's it!** 🎉

---

### **OR For MSG91:**

1. Sign up: https://msg91.com
2. Get Auth Key from dashboard
3. Add to .env:
   ```env
   SMS_PROVIDER=msg91
   MSG91_AUTH_KEY=your_key
   MSG91_SENDER_ID=CHANRE
   ```
4. Restart server
5. Test by booking appointment
