import nodemailer from 'nodemailer';
import { getConfigValue } from './util.js';


let emailConfig = null;
let transporter = null;


function loadEmailConfig() {
    try {
        const config = {
            enabled: getConfigValue('email.enabled', false, 'boolean'),
            host: getConfigValue('email.smtp.host', ''),
            port: getConfigValue('email.smtp.port', 587, 'number'),
            secure: getConfigValue('email.smtp.secure', false, 'boolean'),
            user: getConfigValue('email.smtp.user', ''),
            password: getConfigValue('email.smtp.password', ''),
            from: getConfigValue('email.from', ''),
            fromName: getConfigValue('email.fromName', 'SillyTavern'),
        };

        if (config.enabled && (!config.host || !config.user || !config.password || !config.from)) {
            console.warn('Email service is enabled but configuration is incomplete. Check the email settings in config.yaml.');
            return null;
        }

        return config;
    } catch (error) {
        console.error('Failed to load email config:', error);
        return null;
    }
}


function initTransporter() {
    emailConfig = loadEmailConfig();

    if (!emailConfig || !emailConfig.enabled) {
        return null;
    }

    try {
        const useSSL = emailConfig.port === 465 ? true : emailConfig.secure;

        const transportConfig = {
            host: emailConfig.host,
            port: emailConfig.port,
            secure: useSSL,
            auth: {
                user: emailConfig.user,
                pass: emailConfig.password,
            },
        };

        if (!useSSL && emailConfig.port === 587) {
            transportConfig.requireTLS = true;
            transportConfig.tls = {
                ciphers: 'SSLv3',
                rejectUnauthorized: false,
            };
        }

        console.log('Email service config:', {
            host: transportConfig.host,
            port: transportConfig.port,
            secure: transportConfig.secure,
            user: transportConfig.auth.user,
        });

        transporter = nodemailer.createTransport(transportConfig);

        console.log('Email service initialized');
        return transporter;
    } catch (error) {
        console.error('Failed to initialize mail transporter:', error);
        return null;
    }
}


export function isEmailServiceAvailable() {
    if (!transporter) {
        initTransporter();
    }
    return transporter !== null && emailConfig?.enabled === true;
}


export function getEmailConfig() {
    if (!emailConfig) {
        emailConfig = loadEmailConfig();
    }

    if (!emailConfig) {
        return { enabled: false };
    }

    return {
        enabled: emailConfig.enabled,
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        user: emailConfig.user,
        password: emailConfig.password,
        from: emailConfig.from,
        fromName: emailConfig.fromName,
    };
}


export function reloadEmailConfig() {
    transporter = null;
    emailConfig = null;
    initTransporter();
}


export async function sendEmail(to, subject, text, html = null) {
    if (!isEmailServiceAvailable()) {
        console.error('Email service is not enabled or configuration is incomplete');
        return false;
    }

    try {
        const mailOptions = {
            from: `"${emailConfig.fromName}" <${emailConfig.from}>`,
            to: to,
            subject: subject,
            text: text,
        };

        if (html) {
            mailOptions.html = html;
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId, 'to', to);
        return true;
    } catch (error) {
        console.error('Failed to send email:', error);
        return false;
    }
}


export async function sendVerificationCode(to, code, userName) {
    const subject = 'SillyTavern - Registration Verification Code';
    const text = `
Dear ${userName},

Thank you for registering with SillyTavern!

Your verification code is: ${code}

This code is valid for 5 minutes. Please do not share it with anyone.

If you did not request this, please ignore this email.

Best regards,
The SillyTavern Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #4a90e2;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9f9f9;
            padding: 30px;
            border: 1px solid #ddd;
            border-top: none;
        }
        .code {
            background-color: #fff;
            border: 2px dashed #4a90e2;
            padding: 20px;
            text-align: center;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 5px;
            margin: 20px 0;
            color: #4a90e2;
        }
        .footer {
            background-color: #f0f0f0;
            padding: 15px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-radius: 0 0 5px 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>SillyTavern Registration Verification</h1>
    </div>
    <div class="content">
        <p>Dear <strong>${userName}</strong>,</p>
        <p>Thank you for registering with SillyTavern!</p>
        <p>Your verification code is:</p>
        <div class="code">${code}</div>
        <p>This code is valid for <strong>5 minutes</strong>. Please do not share it with anyone.</p>
        <p>If you did not request this, please ignore this email.</p>
    </div>
    <div class="footer">
        <p>This email was sent automatically by the SillyTavern system. Please do not reply.</p>
    </div>
</body>
</html>
    `.trim();

    return await sendEmail(to, subject, text, html);
}


export async function sendPasswordRecoveryCode(to, code, userName) {
    const subject = 'SillyTavern - Password Recovery';
    const text = `
Dear ${userName},

We received your password recovery request.

Your password recovery code is: ${code}

This recovery code is valid for 5 minutes. Use it to reset your password.

If you did not request this, contact your administrator immediately. Your account may be at risk.

Best regards,
The SillyTavern Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #e74c3c;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9f9f9;
            padding: 30px;
            border: 1px solid #ddd;
            border-top: none;
        }
        .code {
            background-color: #fff;
            border: 2px dashed #e74c3c;
            padding: 20px;
            text-align: center;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 5px;
            margin: 20px 0;
            color: #e74c3c;
        }
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 15px 0;
        }
        .footer {
            background-color: #f0f0f0;
            padding: 15px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-radius: 0 0 5px 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Password Recovery Request</h1>
    </div>
    <div class="content">
        <p>Dear <strong>${userName}</strong>,</p>
        <p>We received your password recovery request.</p>
        <p>Your password recovery code is:</p>
        <div class="code">${code}</div>
        <p>This recovery code is valid for <strong>5 minutes</strong>. Use it to reset your password.</p>
        <div class="warning">
            <strong>⚠️ Security notice:</strong>
            <p>If you did not request this, contact your administrator immediately. Your account may be at risk.</p>
        </div>
    </div>
    <div class="footer">
        <p>This email was sent automatically by the SillyTavern system. Please do not reply.</p>
    </div>
</body>
</html>
    `.trim();

    return await sendEmail(to, subject, text, html);
}


export async function sendInactiveUserDeletionNotice(to, userName, daysInactive, storageSize, siteUrl) {
    const durationLabelMap = new Map([
        [7, '1 week'],
        [15, 'half a month'],
        [30, '1 month'],
        [60, '2 months'],
    ]);
    const durationLabel = durationLabelMap.get(daysInactive) || `${daysInactive} days`;
    const storageMiB = Number.isFinite(storageSize) ? (storageSize / 1024 / 1024) : 0;
    const storageLabel = storageMiB.toFixed(2);
    const siteLine = siteUrl ? `Site entry: ${siteUrl}` : 'Site entry: Contact the administrator for details';

    const subject = 'Ding dong! A tavern notice is looking for you 💌';
    const text = `
Dear ${userName},

   Long time no see! The hearth is still warm, but your seat has gathered dust — it has been ${durationLabel} (about ${daysInactive} days) since your last visit.

Although your luggage only uses ${storageLabel} MiB, we need to free space for new adventurers, so we temporarily cleared your room.

Don’t worry—our doors are always open, and your memories are safe with us.

To make room for active guests, we cleared your account data for now.

If you ever miss the tavern, you are always welcome to return for a new adventure!

Your way back to the tavern: ${siteLine}

We hope to see you shining in the tavern again! ✨

If you need help, contact the administrator.
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #f39c12;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9f9f9;
            padding: 30px;
            border: 1px solid #ddd;
            border-top: none;
        }
        .notice {
            background-color: #fff3cd;
            border-left: 4px solid #f39c12;
            padding: 15px;
            margin: 15px 0;
        }
        .footer {
            background-color: #f0f0f0;
            padding: 15px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-radius: 0 0 5px 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Tavern Cleanup Notice</h1>
    </div>
    <div class="content">
        <p>Dear <strong>${userName}</strong>,</p>
        <div class="notice">
            <p>We noticed you have not visited for <strong>${durationLabel}</strong> (about ${daysInactive} days).</p>
            <p>Your tavern storage uses about <strong>${storageLabel} MiB</strong>.</p>
        </div>
        <p>To make room for active guests, we cleared your account data for now.</p>
        <p>Don’t worry — you’re always welcome to come back. We’ll be here waiting.</p>
        <p>Site entry: ${siteUrl ? `<a href="${siteUrl}">${siteUrl}</a>` : 'Contact the administrator for details'}</p>
        <p>If you need help, contact the administrator.</p>
    </div>
    <div class="footer">
        <p>This email was sent automatically by the SillyTavern system. Please do not reply.</p>
    </div>
</body>
</html>
    `.trim();

    return await sendEmail(to, subject, text, html);
}


export async function testEmailConfig(testEmail) {
    if (!isEmailServiceAvailable()) {
        return {
            success: false,
            error: 'Email service is not enabled or configuration is incomplete',
        };
    }

    try {
        console.log('Starting SMTP connection verification...');
        await transporter.verify();
        console.log('SMTP connection verified');

        const subject = 'SillyTavern - Email Configuration Test';
        const text = 'This is a test email. If you received it, the email service is configured correctly.';
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
        }
        .success {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
            padding: 20px;
            border-radius: 5px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="success">
        <h2>✓ Email configuration test successful</h2>
        <p>This is a test email. If you received it, the email service is configured correctly.</p>
        <p>Sent at: ${new Date().toLocaleString('en-US')}</p>
    </div>
</body>
</html>
        `.trim();

        console.log('Sending test email to:', testEmail);
        const success = await sendEmail(testEmail, subject, text, html);

        if (success) {
            return { success: true };
        } else {
            return {
                success: false,
                error: 'Email send failed. Please check the server logs',
            };
        }
    } catch (error) {
        console.error('Email configuration test failed:', error);
        return {
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}
