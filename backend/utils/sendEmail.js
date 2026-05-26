const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ── OTP EMAIL ──
async function sendOTPEmail(to, otp) {
  await transporter.sendMail({
    from:    `"DrinkedIn 🍸" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your DrinkedIn OTP",
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:28px;background:#1c1c1c;color:#feffea;border-radius:14px">
        <h2 style="color:#fcfc62;margin-bottom:4px">🍸 DrinkedIn</h2>
        <p style="color:#a3a3a3;margin-bottom:20px">Your one-time login code</p>
        <div style="background:#2e2e2e;border-radius:10px;padding:24px;text-align:center;letter-spacing:12px;font-size:32px;font-weight:700;color:#fcfc62">
          ${otp}
        </div>
        <p style="color:#a3a3a3;font-size:13px;margin-top:20px">Valid for 5 minutes. Do not share this code.</p>
      </div>
    `
  });
}

// ── FOLLOW NOTIFICATION EMAIL ──
async function sendFollowEmail(to, followerUsername, followerAvatar) {
  await transporter.sendMail({
    from:    `"DrinkedIn 🍸" <${process.env.EMAIL_USER}>`,
    to,
    subject: `🍻 ${followerUsername} started following you on DrinkedIn!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:0;background:#1c1c1c;border-radius:14px;overflow:hidden">

        <!-- Header -->
        <div style="background:#242424;padding:24px 28px;border-bottom:1px solid #484848">
          <h2 style="color:#fcfc62;margin:0;font-size:24px">🍸 DrinkedIn</h2>
        </div>

        <!-- Body -->
        <div style="padding:28px">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
            <img src="${followerAvatar || `https://i.pravatar.cc/60?u=${encodeURIComponent(followerUsername)}`}"
                 style="width:60px;height:60px;border-radius:50%;border:3px solid #fcfc62"
                 alt="${followerUsername}"/>
            <div>
              <h3 style="color:#feffea;margin:0;font-size:18px">${followerUsername}</h3>
              <p style="color:#a3a3a3;margin:4px 0 0;font-size:14px">started following you</p>
            </div>
          </div>

          <p style="color:#c9c9c9;font-size:15px;line-height:1.6">
            Someone new just joined your crew! 🥂<br/>
            Check out their profile and follow them back.
          </p>

          <a href="http://localhost:8000"
             style="display:inline-block;margin-top:20px;padding:12px 28px;background:#fcfc62;color:#000;font-weight:700;font-size:15px;border-radius:8px;text-decoration:none">
            View DrinkedIn →
          </a>
        </div>

        <!-- Footer -->
        <div style="padding:16px 28px;border-top:1px solid #484848;background:#242424">
          <p style="color:#a3a3a3;font-size:12px;margin:0">
            You're receiving this because someone followed you on DrinkedIn.<br/>
            © 2024 DrinkedIn
          </p>
        </div>

      </div>
    `
  });
}

module.exports = { sendOTPEmail, sendFollowEmail };