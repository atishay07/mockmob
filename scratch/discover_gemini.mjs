import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    // Note: The SDK doesn't have a direct "listModels" method that returns a simple list in all versions.
    // However, we can try to fetch the model info.
    console.log("Attempting to identify correct model name...");
    
    const variations = [
      "gemini-3.1-flash-lite",
      "gemini-3.1-flash-lite-preview",
      "gemini-2.5-flash-lite",
      "gemini-1.5-flash"
    ];

    for (const v of variations) {
      try {
        console.log(`Testing ${v}...`);
        const model = genAI.getGenerativeModel({ model: v });
        const result = await model.generateContent("hi");
        console.log(`✅ ${v} is available!`);
        process.exit(0);
      } catch (e) {
        console.log(`❌ ${v} failed: ${e.message.split('\n')[0]}`);
      }
    }
  } catch (err) {
    console.error("Discovery failed:", err.message);
  }
}

listModels();
