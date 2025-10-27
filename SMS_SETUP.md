# SMS Setup Guide for Appointment Notifications

This guide explains how to set up SMS notifications for patient appointments using various free and paid services.

## Overview

The system now sends SMS notifications to patients when:
1. **Appointment Booking**: Patient receives a booking confirmation SMS with their confirmation code
2. **Appointment Confirmation**: Patient receives a final confirmation SMS when staff confirms the appointment

## SMS is OPTIONAL!

**The system already sends email notifications.** SMS is an additional feature. If you don't configure SMS, the system will still work perfectly with email-only notifications.

To disable SMS entirely, set in your `.env`:
```env
SMS_PROVIDER=none
```

## Free/Cost-Effective SMS Options

### Option 1: MSG91 (FREE for India) ⭐ RECOMMENDED FOR INDIA

**Best for:** Indian healthcare clinics

**Why Choose:**
- 100 free SMS credits on signup
- Very cheap per SMS in India (₹0.15-0.25 per SMS)
- Reliable delivery
- No credit card required for free trial
- Popular choice for Indian businesses

**Setup:**
1. Sign up at https://msg91.com
2. Get your Auth Key from the dashboard
3. Add to `.env`:
```env
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=your_auth_key_here
MSG91_SENDER_ID=CHANRE
```

**Free Tier:** 100 free SMS credits on signup

---

### Option 2: TextLocal (FREE Trial Available) 🇮🇳

**Best for:** India (supports other countries too)

**Why Choose:**
- Easy to set up
- Free test credits available
- Affordable pricing for India
- No setup fees

**Setup:**
1. Sign up at https://www.textlocal.in
2. Go to API settings and get your API Key
3. Add to `.env`:
```env
SMS_PROVIDER=textlocal
TEXTLOCAL_API_KEY=your_api_key_here
TEXTLOCAL_SENDER=CHANRE
```

**Free Tier:** Free test credits available, then ~₹0.20 per SMS

---

### Option 3: Twilio (FREE Trial Credits) ⭐ INTERNATIONAL

**Best for:** International or if you need global coverage

**Why Choose:**
- $15 free trial credits
- Works globally
- Most reliable
- Industry standard

**Setup:**
1. Sign up at https://www.twilio.com
2. Get Account SID and Auth Token
3. Buy a phone number with SMS capability
4. Add to `.env`:
```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**Free Tier:** $15 free credits on signup (≈150 SMS)

---

### Option 4: AWS SNS (FREE Tier Available) ☁️

**Best for:** If you're already using AWS

**Why Choose:**
- Free tier: 1 million SMS per month (in AWS free tier)
- 100 SMS free per month after that
- Most cost-effective at scale

**Setup:**
1. AWS account (free tier available)
2. Enable AWS SNS
3. Add to `.env`:
```env
SMS_PROVIDER=aws-sns
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

**Free Tier:** 1 million SMS/month (AWS free tier - 12 months), then ~$0.01 per SMS

---

### Option 5: Email Only (100% FREE) 🆓

**Already working!** The system sends beautiful HTML emails with appointment details.

To use email-only (no SMS):
```env
SMS_PROVIDER=none
```

This is the **completely free option** that requires no additional setup.

---

## Quick Setup Guide

### For India (Recommended: MSG91)

1. Sign up at https://msg91.com (takes 2 minutes)
2. Get your Auth Key from dashboard
3. Add to your `.env` file:

```env
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=1234567890abcdef
MSG91_SENDER_ID=CHANRE
```

4. Restart your server
5. Done! SMS will work immediately

### For International (Recommended: Twilio)

1. Sign up at https://www.twilio.com
2. Get Account SID, Auth Token, and buy a number
3. Add to your `.env` file:

```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

4. Restart your server

### Free Option (Email Only)

Just set:
```env
SMS_PROVIDER=none
```

---

## Cost Comparison

| Service | Free Credits | Cost per SMS (India) | Cost per SMS (US) | Notes |
|---------|-------------|---------------------|-------------------|-------|
| MSG91 | 100 free | ₹0.15-0.25 | N/A | Best for India |
| TextLocal | Free trial | ₹0.20 | N/A | Easy setup for India |
| Twilio | $15 (~₹1200) | Not optimized | $0.0075 | Global, reliable |
| AWS SNS | 1M (first year) | ~₹0.75 | $0.01 | Best for scale |
| Email | Unlimited | FREE | FREE | Already working! |

---

## Phone Number Format

For all SMS services, use international format:
- ✅ **Correct**: `+911234567890` (India), `+1234567890` (US)
- ❌ **Wrong**: `1234567890`, `1234567890`

---

## Testing Your Setup

1. Set up your chosen provider
2. Restart the server
3. Book a test appointment
4. Check console logs for SMS status
5. Verify SMS received on patient phone

---

## Troubleshooting

### SMS Not Being Sent

**Check the provider:**
```bash
# Check what provider is configured
echo $SMS_PROVIDER  # Or check your .env file
```

**Check logs:**
The server console will show:
- ✅ `SMS sent successfully via [provider]`
- ❌ `SMS failed via [provider]: [error]`

### Common Issues

1. **Wrong phone format**
   - Use `+91` prefix for India
   - Include country code

2. **Provider not configured**
   - Check .env file has correct credentials
   - Verify environment variable names are correct

3. **Free credits exhausted**
   - MSG91: Add balance to account
   - Twilio: Add credit card and buy credits
   - Email: Never runs out!

4. **SMS disabled**
   - If `SMS_PROVIDER=none`, SMS is intentionally disabled
   - Email notifications still work

---

## Recommendation

**For Indian Clinics (ChanRe Allergy):**
- Start with **MSG91** (free credits, cheap for India)
- Keep email notifications as backup
- Consider upgrading later if volume increases

**For International:**
- Use **Twilio** (most reliable, $15 free credits)
- Or use **email-only** if SMS is not critical

**For Zero Cost:**
- Use **email-only** - it's already working!
- SMS is a nice-to-have enhancement

---

## Security Notes

- Never commit `.env` file to git
- Keep API keys secret
- Rotate keys if compromised
- Use environment-specific credentials

---

## Need Help?

- Check console logs for error messages
- Verify .env file format (no quotes, no extra spaces)
- Test with single appointment first
- Email notifications will always work as fallback

---

**Remember:** Email notifications are already working perfectly. SMS is an optional enhancement to improve patient experience.