const nodemailer = require('nodemailer');
let transporter = null;
function getTransporter(){
  if(transporter) return transporter;
  if(!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:+(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});return transporter;
}
async function sendBookingUpdate(to,name,subject,text){const t=getTransporter();if(!t)return false;await t.sendMail({from:process.env.MAIL_FROM||process.env.SMTP_USER,to,subject,text,html:`<div style="font-family:Arial,sans-serif;max-width:620px"><h2>✦ evently</h2><p>Hi ${name},</p><p>${text}</p><p>Open your Evently dashboard to see the latest booking status.</p></div>`});return true;}
module.exports={sendBookingUpdate};
