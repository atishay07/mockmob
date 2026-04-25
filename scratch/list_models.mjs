import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    // There isn't a direct listModels in the JS SDK in the same way, 
    // but we can try common variations or just use a known stable one.
    console.log("Checking Gemini 2.0 Flash as fallback...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent("test");
    console.log("Gemini 2.0 Flash works!");
  } catch (err) {
    console.error("List Models Error:", err.message);
  }
}

listModels();
