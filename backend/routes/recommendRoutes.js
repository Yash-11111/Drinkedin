const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");

router.post("/", auth, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !messages.length)
      return res.status(400).json({ msg: "Messages required" });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model:      "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7,
        max_tokens:  1500
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq error:", data);
      return res.status(500).json({ msg: data.error?.message || "AI error" });
    }

    const text = data.choices?.[0]?.message?.content;
    if (!text) return res.status(500).json({ msg: "No response from AI" });

    res.json({ content: text });
  } catch (err) {
    console.error("Recommend error:", err);
    res.status(500).json({ msg: "Error calling AI" });
  }
});

module.exports = router;