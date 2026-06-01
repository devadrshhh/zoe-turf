const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const testEmail = async () => {
  try {
    const service = process.env.EMAIL_SERVICE || 'gmail';
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    console.log('Using SMTP credentials:');
    console.log(`- Service: ${service}`);
    console.log(`- User: ${user}`);
    console.log(`- Password length: ${pass ? pass.length : 0}`);

    if (!user || !pass) {
      console.error('Missing EMAIL_USER or EMAIL_PASS environment variables.');
      process.exit(1);
    }

    const transporter = nodemailer.createTransport({
      service,
      auth: {
        user,
        pass,
      },
    });

    console.log('Sending test email to your address...');
    const info = await transporter.sendMail({
      from: `"Turf Hub Test" <${user}>`,
      to: user,
      subject: '⚡ Test Email from Turf Hub',
      text: 'If you receive this email, your Nodemailer credentials and SMTP configurations are working perfectly!',
      html: '<h3>Congratulations!</h3><p>If you receive this email, your Nodemailer credentials and SMTP configurations are working perfectly!</p>',
    });

    console.log('Success! Test email sent successfully.');
    console.log(`Message ID: ${info.messageId}`);
    process.exit(0);
  } catch (error) {
    console.error('SMTP test failed with error:');
    console.error(error);
    process.exit(1);
  }
};

testEmail();
