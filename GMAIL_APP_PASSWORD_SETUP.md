# Gmail App Password Setup Guide

Your backend email system uses Gmail to send emails. To use Gmail with nodemailer, you need to create an **App Password** (not your regular Gmail password).

## Steps to Create Gmail App Password

### Step 1: Enable 2-Step Verification
1. Go to your Google Account: https://myaccount.google.com/
2. Click on **Security** (left sidebar)
3. Under "Signing in to Google", find **2-Step Verification**
4. If it's not enabled, click on it and follow the setup process
5. **Note**: You MUST have 2-Step Verification enabled to use App Passwords

### Step 2: Generate App Password
1. Go back to **Security** settings in your Google Account
2. Scroll down to "Signing in to Google" section
3. Click on **App passwords** (this option only appears if 2-Step Verification is enabled)
4. If prompted, sign in again
5. Select app: Choose **Mail**
6. Select device: Choose **Other (Custom name)**
7. Enter a name: e.g., "ChanRe Allergy Backend" or "Node.js Email Service"
8. Click **Generate**
9. **Copy the 16-character password** that appears (it will look like: `abcd efgh ijkl mnop`)
   - Important: You can only see this password once! Save it immediately.
   - Remove spaces when using it (it should be 16 characters without spaces)

### Step 3: Add to .env File
1. Navigate to your backend directory: `D:\02 Internal project\Manu\ChanRe-Allergy-Backend`
2. Create a `.env` file if it doesn't exist (it should be in the root of the backend folder)
3. Add these lines to your `.env` file:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
```

**Example:**
```env
EMAIL_USER=chanreallergy@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

**Important Notes:**
- Replace `your-email@gmail.com` with the Gmail address you used to create the App Password
- Replace `your-16-character-app-password` with the App Password you generated (you can include or remove spaces - both work)
- Make sure there are NO quotes around the values
- Make sure there are NO spaces before or after the `=` sign

### Step 4: Restart Your Server
After saving the `.env` file, restart your Node.js server for the changes to take effect.

## Troubleshooting

### "App passwords" option not showing?
- Make sure 2-Step Verification is enabled
- Try refreshing the page
- Make sure you're signed into the correct Google account

### "Invalid login" or authentication error?
- Verify the App Password is correct (no extra spaces, correct characters)
- Make sure the EMAIL_USER matches the Gmail account you used to create the App Password
- Try generating a new App Password

### Still not working?
- Check that your `.env` file is in the correct location (backend root folder)
- Verify that `dotenv` is configured correctly in `server.js`
- Check server console logs for error messages

## Security Best Practices
- Never commit your `.env` file to Git (it should be in `.gitignore`)
- Don't share your App Password with others
- If compromised, revoke the App Password and generate a new one
- Use a dedicated Gmail account for sending system emails if possible

## Alternative: Using Other Email Providers
If you want to use a different email provider (not Gmail), you'll need to modify `utils/emailService.js` to use different SMTP settings. Common alternatives:
- Outlook/Office 365
- SendGrid
- Mailgun
- AWS SES

