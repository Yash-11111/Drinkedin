const AUTH_URL = `${BASE_URL}/api/auth`;

// Redirect if already logged in
if (localStorage.getItem("token")) {
  window.location.href = "index.html";
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("status");
  if (!el) return;
  el.innerText = msg;
  el.style.color = isError ? "#ff6b6b" : "#fcfc62";
}

// ===== SEND OTP =====
async function sendOTP() {
  const email = document.getElementById("email").value.trim();
  const btn = document.querySelector(".send-otp-btn");

  if (!email) { setStatus("Please enter your email.", true); return; }

  setStatus("Sending OTP...");
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${AUTH_URL}/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();

    if (res.ok) {
      setStatus("✅ OTP sent to " + email);
      document.getElementById("otpSection").style.display = "block";
    } else {
      setStatus(data.msg || "Failed to send OTP.", true);
    }
  } catch (err) {


    if (res.status === 429) {
      setStatus("Too many attempts. Please wait before trying again. ⏳", true);
      return;
    }
  }

  // re-enable after 30 seconds
  if (btn) setTimeout(() => { btn.disabled = false; }, 30000);
}

// ===== VERIFY OTP =====
async function verifyOTP() {
  const email = document.getElementById("email").value.trim();
  const otp = document.getElementById("otp").value.trim();

  if (!otp) { setStatus("Enter the OTP from your email.", true); return; }

  setStatus("Verifying...");

  try {
    const res = await fetch(`${AUTH_URL}/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp })
    });
    const data = await res.json();

    if (data.token) {
      localStorage.setItem("token", data.token);
      setStatus("✅ Login successful! Redirecting...");
      setTimeout(() => { window.location.href = "index.html"; }, 800);
    } else {
      setStatus(data.msg || "Invalid OTP.", true);
    }
  } catch (err) {
    setStatus("Server error. Is the backend running?", true);
  }
}
