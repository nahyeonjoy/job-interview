import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
  },
});

const TIMEOUT_MS = 15000;

export async function generateJSON<T>(prompt: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Gemini API timeout")), TIMEOUT_MS)
  );

  const apiPromise = model.generateContent(prompt).then((result) => {
    const text = result.response.text();
    return JSON.parse(text) as T;
  });

  return Promise.race([apiPromise, timeoutPromise]);
}
