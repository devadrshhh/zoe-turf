const nodemailer = require('nodemailer');

// Build the mail SMTP transporter if environment values are available
const getTransporter = () => {
  const service = process.env.EMAIL_SERVICE || 'gmail';
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  // Graceful configuration check to prevent transporter crash on missing/placeholder credentials
  if (!user || !pass || pass.includes('your-google-app-password') || user.includes('your-business-email')) {
    console.warn('⚠️ Mailing Warning: SMTP credentials are not fully configured inside backend/.env. Automated email receipts will be bypassed.');
    return null;
  }

  return nodemailer.createTransport({
    service,
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Sends a high-fidelity booking invoice receipt directly to the customer's email ID.
 * Supports standard Nodemailer SMTP and fallback to Brevo HTTPS REST API to bypass cloud port blocks.
 * @param {Object} booking - The Mongoose booking record document
 * @param {String} turfName - The human-readable name of the reserved sports turf
 */
const sendReceiptEmail = async (booking, turfName) => {
  try {
    if (!booking.customerEmail) {
      console.warn(`⚠️ Mailing Warning: Missing customerEmail on booking ${booking.bookingId}. Skipping email send.`);
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
                <img src="cid:receipt-qr" alt="Ticket QR code" style="width: 140px; height: 140px; display: block; margin: 0 auto;" />
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

    // A. HTTP REST API (Brevo) - Primary Production Option to completely bypass SMTP cloud firewalls
    if (process.env.BREVO_API_KEY) {
      console.log('⚡ Detected BREVO_API_KEY. Sending receipt email via Brevo HTTP REST API (Port 443)...');
      const senderEmail = process.env.EMAIL_USER || 'learn.microx@gmail.com';
      const inlineHtmlContent = htmlText.replace('src="cid:receipt-qr"', `src="${booking.qrCodeData}"`);

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Turf Hub', email: senderEmail },
          to: [{ email: booking.customerEmail, name: booking.customerName }],
          subject: `⚡ Booking Confirmed! Ticket ID: ${booking.bookingId}`,
          htmlContent: inlineHtmlContent
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`🚀 Automated receipt email dispatched successfully via Brevo HTTP REST API. Message ID: ${data.messageId || 'N/A'}`);
        return true;
      } else {
        const errText = await response.text();
        console.error('❌ Brevo HTTP API dispatch failed:', errText);
        // Fail over to SMTP fallback
      }
    }

    // B. Standard Nodemailer SMTP Transporter - Secondary Fallback (Local environment or unblocked servers)
    const transporter = getTransporter();
    if (!transporter) {
      console.log(`ℹ️ Booking confirmation logged. Email receipt bypassed (SMTP/API not configured) for: ${booking.customerEmail}`);
      return false;
    }

    const mailOptions = {
      from: `"Turf Hub" <${process.env.EMAIL_USER}>`,
      to: booking.customerEmail,
      subject: `⚡ Booking Confirmed! Ticket ID: ${booking.bookingId}`,
      html: htmlText,
      attachments: booking.qrCodeData ? [
        {
          filename: `QR_${booking.bookingId}.png`,
          path: booking.qrCodeData, // Attaches base64 data URI cleanly
          cid: 'receipt-qr', // Inline content-id reference
        }
      ] : []
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`🚀 Automated receipt email dispatched successfully via SMTP to ${booking.customerEmail}. Message ID: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`⚠️ Mailing Error: Failed to send automated email receipt to ${booking.customerEmail}. Detail:`, err.message);
    return false;
  }
};

module.exports = {
  sendReceiptEmail,
};
