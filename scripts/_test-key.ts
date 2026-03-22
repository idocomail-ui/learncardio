import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import Groq from "groq-sdk";

async function main() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const result = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: "Say OK in one word" }],
    max_tokens: 10,
  });
  console.log("✅ Groq API works:", result.choices[0]?.message?.content?.trim());
}

main().catch((e) => { console.error("❌ Failed:", e.message); process.exit(1); });
