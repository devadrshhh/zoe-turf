/**
 * 📧 Brevo HTTP Email Dispatcher
 * 
 * Sends high-fidelity responsive HTML booking receipts using the Brevo HTTP API (Port 443)
 * instead of direct SMTP to completely bypass cloud outbound firewalls (like Render free tiers).
 */

/**
 * Sends a high-fidelity booking invoice receipt directly to the customer's email ID.
 * @param {Object} booking - The Mongoose booking record document
 * @param {String} turfName - The human-readable name of the reserved sports turf
 * @returns {Promise<Boolean>} Success status
 */
const sendReceiptEmail = async (booking, turfName) => {
  try {
    if (!booking.customerEmail) {
      console.warn(`⚠️ Mailing Warning: Missing customerEmail on booking ${booking.bookingId}. Skipping email send.`);
      return false;
    }

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ Mailing Warning: BREVO_API_KEY is not configured inside backend/.env. Automated email receipts will be bypassed.');
      return false;
    }

    // High fidelity responsive HTML ticket invoice
    const htmlText = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
          <!-- Top Accent Header Gradient -->
          <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 24px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">Reservation Confirmed</h2>
            <p style="margin: 6px 0 0 0; font-size: 12px; opacity: 0.9; font-weight: 500;">Downtown Sports Complex • Turf Hub</p>
          </div>

          <!-- Body details -->
          <div style="padding: 24px; background: #ffffff; color: #0f172a;">
            
            <!-- Centered QR Viewfinder -->
            ${booking.qrCodeData ? `
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 12px; border-radius: 12px; display: inline-block;">
                <img src="cid:receipt-qr.png" alt="Ticket QR code" style="width: 140px; height: 140px; display: block; margin: 0 auto;" />
              </div>
              <p style="margin: 8px 0 0 0; font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Present QR Code at Reception</p>
            </div>
            ` : ''}

            <!-- Summary Table -->
            <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Booking Summary</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Booking Reference</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a;">${booking.bookingId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Player Name</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a;">${booking.customerName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Player Phone</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #334155;">${booking.customerPhone}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Turf Arena</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #2563eb;">${turfName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Timing Date</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a;">${booking.date}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Timing Hour</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 800; color: #2563eb; font-size: 13px;">${booking.slot}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Payment Mode</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #334155;">${booking.paymentMethod} (${booking.paymentStatus})</td>
              </tr>
              <tr>
                <td style="padding: 16px 0 0 0; color: #0f172a; font-weight: 800; font-size: 14px;">Total Paid Amount</td>
                <td style="padding: 16px 0 0 0; text-align: right; font-weight: 900; font-size: 18px; color: #10b981;">₹${booking.finalAmount}</td>
              </tr>
            </table>

          </div>

          <!-- Bottom Footer -->
          <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; line-height: 1.5;">
            <p style="margin: 0; font-weight: 600;">Thank you for reserving with Turf Hub!</p>
            <p style="margin: 4px 0 0 0;">Please keep this receipt handy. For rescheduling or queries, please contact reception.</p>
          </div>
        </div>
      `;

    console.log('⚡ Sending receipt email via Brevo HTTP REST API (Port 443)...');
    const senderEmail = process.env.EMAIL_USER || 'learn.microx@gmail.com';
    
    // Query active administrators to BCC them on the booking receipt
    let adminBcc = [];
    try {
      const Admin = require('../models/Admin');
      const activeAdmins = await Admin.find({ isActive: true }, 'email name');
      if (activeAdmins && activeAdmins.length > 0) {
        adminBcc = activeAdmins.map(admin => ({
          email: admin.email,
          name: admin.name || 'Admin'
        }));
      }
    } catch (dbErr) {
      console.warn('⚠️ Mailing Warning: Could not retrieve active admin emails for BCC copy:', dbErr.message);
    }

    const bodyPayload = {
      sender: { name: 'Turf Hub', email: senderEmail },
      to: [{ email: booking.customerEmail, name: booking.customerName }],
      subject: `⚡ Booking Confirmed! Ticket ID: ${booking.bookingId}`,
      htmlContent: htmlText
    };

    if (adminBcc.length > 0) {
      bodyPayload.bcc = adminBcc;
      console.log(`✉️ Adding BCC copy for ${adminBcc.length} active administrators.`);
    }

    if (booking.qrCodeData) {
      const base64Content = booking.qrCodeData.split(',')[1];
      bodyPayload.attachment = [
        {
          content: base64Content,
          name: 'receipt-qr.png'
        }
      ];
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(bodyPayload)
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`🚀 Automated receipt email dispatched successfully via Brevo HTTP REST API. Message ID: ${data.messageId || 'N/A'}`);
      return true;
    } else {
      const errText = await response.text();
      console.error('❌ Brevo HTTP API dispatch failed:', errText);
      return false;
    }
  } catch (err) {
    console.error(`⚠️ Mailing Error: Failed to send automated email receipt to ${booking.customerEmail}. Detail:`, err.message);
    return false;
  }
};

/**
 * Sends a high-fidelity check-in verification email directly to the customer's email ID.
 * @param {Object} booking - The Mongoose booking record document
 * @param {String} turfName - The human-readable name of the reserved sports turf
 * @returns {Promise<Boolean>} Success status
 */
const sendVerificationEmail = async (booking, turfName) => {
  try {
    if (!booking.customerEmail) {
      console.warn(`⚠️ Mailing Warning: Missing customerEmail on booking ${booking.bookingId} verification mail. Skipping.`);
      return false;
    }

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ Mailing Warning: BREVO_API_KEY is not configured inside backend/.env. Verification email will be bypassed.');
      return false;
    }

    // High fidelity responsive HTML verification ticket check-in receipt
    const htmlText = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
          <!-- Top Accent Header Gradient (Green for Verified Success) -->
          <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; text-align: center; color: #ffffff;">
            <!-- Verified Circle Badge -->
            <div style="background: rgba(255, 255, 255, 0.2); width: 56px; height: 56px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; border: 2px solid #ffffff;">
              <span style="font-size: 28px; font-weight: bold; line-height: 56px;">✓</span>
            </div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">Ticket Verified</h2>
            <p style="margin: 6px 0 0 0; font-size: 12px; opacity: 0.9; font-weight: 500;">Checked in successfully at Turf Hub</p>
          </div>

          <!-- Body details -->
          <div style="padding: 24px; background: #ffffff; color: #0f172a;">
            
            <div style="text-align: center; margin-bottom: 24px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 12px;">
              <p style="margin: 0; font-size: 14px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">✓ Gate Pass Verified</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #15803d; font-weight: 600;">Check-in: ${new Date(booking.verifiedAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>

            <!-- Summary Table -->
            <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Check-In Summary</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Booking Reference</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a;">${booking.bookingId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Player Name</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a;">${booking.customerName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Player Phone</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #334155;">${booking.customerPhone}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Turf Arena</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #059669;">${turfName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Timing Date</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a;">${booking.date}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Timing Hour</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 800; color: #059669; font-size: 13px;">${booking.slot}</td>
              </tr>
            </table>

          </div>

          <!-- Bottom Footer -->
          <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; line-height: 1.5;">
            <p style="margin: 0; font-weight: 600;">Thank you for playing at Turf Hub!</p>
            <p style="margin: 4px 0 0 0;">Have a great game. Make sure to review us after your session.</p>
          </div>
        </div>
      `;

    console.log(`⚡ Sending check-in verification email to user ${booking.customerEmail}...`);
    const senderEmail = process.env.EMAIL_USER || 'learn.microx@gmail.com';
    
    const bodyPayload = {
      sender: { name: 'Turf Hub', email: senderEmail },
      to: [{ email: booking.customerEmail, name: booking.customerName }],
      subject: `✅ Check-in Verified! Booking ID: ${booking.bookingId}`,
      htmlContent: htmlText
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(bodyPayload)
    });

    if (response.ok) {
      console.log(`🚀 Verification email successfully sent to ${booking.customerEmail}`);
      return true;
    } else {
      const errText = await response.text();
      console.error('❌ Brevo API verification email dispatch failed:', errText);
      return false;
    }
  } catch (err) {
    console.error(`⚠️ Mailing Error: Failed to send verification check-in email to ${booking.customerEmail}. Detail:`, err.message);
    return false;
  }
};

module.exports = {
  sendReceiptEmail,
  sendVerificationEmail,
};
