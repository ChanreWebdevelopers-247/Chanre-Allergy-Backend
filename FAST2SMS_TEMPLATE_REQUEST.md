# Fast2SMS Template Registration Request

## 📋 **For Fast2SMS Dashboard Submission**

---

## **Template 1: Appointment Request Notification**

### **Template Details:**
- **Template Name:** ChanRe_Appointment_Request
- **Category:** Transactional
- **Sender ID:** CHANRE (or FSTSMS)
- **Purpose:** Notify patient that appointment request has been received

### **Template Message:**
```
Dear {patient_name}, your appointment request has been sent! Confirmation Code: {confirmation_code}, Center: {center_name}. Our receptionist will contact you soon to confirm. - ChanRe Allergy Clinic
```

### **Variables Used:**
1. `{patient_name}` - Patient's full name
2. `{confirmation_code}` - Unique appointment confirmation code
3. `{center_name}` - Name of the clinic center

### **Message Length:** ~160 characters

---

## **Template 2: Appointment Confirmation**

### **Template Details:**
- **Template Name:** ChanRe_Appointment_Confirmed
- **Category:** Transactional
- **Sender ID:** CHANRE (or FSTSMS)
- **Purpose:** Confirm scheduled appointment with date and time

### **Template Message:**
```
Dear {patient_name}, your appointment has been scheduled! Confirmation Code: {confirmation_code}, Center: {center_name}, Date: {appointment_date}, Time: {appointment_time}. Please arrive 15 minutes early. - ChanRe Allergy Clinic
```

### **Variables Used:**
1. `{patient_name}` - Patient's full name
2. `{confirmation_code}` - Unique appointment confirmation code
3. `{center_name}` - Name of the clinic center
4. `{appointment_date}` - Appointment date (DD/MM/YYYY)
5. `{appointment_time}` - Appointment time (HH:MM AM/PM)

### **Message Length:** ~220 characters

---

## **Company/Organization Details (If Required):**

- **Company Name:** ChanRe Allergy Center
- **Business Type:** Healthcare/Medical Clinic
- **Use Case:** Automated appointment notifications for patients
- **Volume:** Approximately 50-200 SMS per month

---

## **What Manager Needs to Submit:**

1. Copy both templates above
2. Submit via Fast2SMS Dashboard → Templates → Add New Template
3. Wait for approval (usually 1-2 business days)
4. After approval, get:
   - Template IDs for both templates
   - API Key
   - Sender ID

---

## **After Approval - What We Need:**

Once templates are approved, please provide:

- ✅ Template ID for "Appointment Request"
- ✅ Template ID for "Appointment Confirmation"
- ✅ API Key
- ✅ Sender ID

---

**Questions? Contact the development team.**
