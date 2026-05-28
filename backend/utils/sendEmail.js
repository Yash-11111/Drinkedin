// Uses Brevo HTTP API instead of SMTP (works on Render free tier)

async function sendOTPEmail(to, otp) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key":      process.env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender:     { name: "DrinkedIn 🍸", email: "papahoonpapa@gmail.com" },
      to:         [{ email: to }],
      subject:    "Your DrinkedIn OTP",
      htmlContent: `
        <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:28px;background:#1c1c1c;color:#feffea;border-radius:14px">
          <h2 style="color:#fcfc62;margin-bottom:4px">🍸 DrinkedIn</h2>
          <p style="color:#a3a3a3;margin-bottom:20px">Your one-time login code</p>
          <div style="background:#2e2e2e;border-radius:10px;padding:24px;text-align:center;letter-spacing:12px;font-size:32px;font-weight:700;color:#fcfc62">
            ${otp}
          </div>
          <p style="color:#a3a3a3;font-size:13px;margin-top:20px">Valid for 5 minutes. Do not share this code.</p>
        </div>
      `
    })
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Brevo API error:", data);
    throw new Error(data.message || "Failed to send email");
  }
}

async function sendFollowEmail(to, followerUsername, followerAvatar) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key":      process.env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender:     { name: "DrinkedIn 🍸", email: "papahoonpapa@gmail.com" },
      to:         [{ email: to }],
      subject:    `🍻 ${followerUsername} started following you on DrinkedIn!`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:0;background:#1c1c1c;border-radius:14px;overflow:hidden">
          <div style="background:#242424;padding:24px 28px;border-bottom:1px solid #484848">
            <h2 style="color:#fcfc62;margin:0;font-size:24px">🍸 DrinkedIn</h2>
          </div>
          <div style="padding:28px">
            <h3 style="color:#feffea;margin:0 0 8px;font-size:18px">${followerUsername} started following you 🍻</h3>
            <p style="color:#c9c9c9;font-size:15px;line-height:1.6">Someone new just joined your crew!</p>
            <a href="${process.env.FRONTEND_URL}"
               style="display:inline-block;margin-top:20px;padding:12px 28px;background:#fcfc62;color:#000;font-weight:700;font-size:15px;border-radius:8px;text-decoration:none">
              View DrinkedIn →
            </a>
          </div>
          <div style="padding:16px 28px;border-top:1px solid #484848;background:#242424">
            <p style="color:#a3a3a3;font-size:12px;margin:0">© 2024 DrinkedIn</p>
          </div>
        </div>
      `
    })
  });

  const data = await res.json();
  if (!res.ok) console.error("Brevo follow email error:", data);
}

module.exports = { sendOTPEmail, sendFollowEmail };