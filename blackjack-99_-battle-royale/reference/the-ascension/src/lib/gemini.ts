import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface MogAnalysis {
  mogScore: number;
  analysis: string;
}

export interface PSLAnalysis {
  pslScore: number;
  breakdown: string;
}

export const performPSLScan = async (base64Image: string): Promise<PSLAnalysis> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Perform a PSL (Physical Stature/Looks) scale analysis on this person's face. 
  The PSL scale ranges from 1 to 8:
  - 1-2: Significantly below average
  - 3-4: Below average to average
  - 5: True average
  - 6: Above average / "Pretty"
  - 7: Model-tier
  - 8: God-tier / Peak human aesthetics

  Evaluate based on:
  - Canthal tilt (positive is better)
  - Midface ratio
  - Lower third development
  - Eye spacing and shape
  - Overall facial harmony

  Return ONLY a raw JSON object:
  {
    "pslScore": number (float between 1.0 and 8.0),
    "breakdown": string (one concise sentence about the primary features contributing to the score)
  }`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      pslScore: Number(result.pslScore) || 5.0,
      breakdown: result.breakdown || "Standard facial geometry detected."
    };
  } catch (error) {
    console.error("PSL Scan error:", error);
    return { pslScore: 5.0, breakdown: "Scan calibration failed." };
  }
};

export const analyzeFace = async (base64Image: string): Promise<MogAnalysis> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze the facial structure in this image to determine its "chadness" (physical attractiveness and dominance) based on jawline definition, facial symmetry, brow ridge, and overall aesthetic harmony. 
  
  Be objective and slightly clinical, but use "mogging" terminology if appropriate. 
  
  Return ONLY a raw JSON object with the following structure:
  {
    "mogScore": number (float between 1.0 and 10.0),
    "analysis": string (short 2-sentence breakdown)
  }`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      mogScore: Number(result.mogScore) || 1.0,
      analysis: result.analysis || "Analysis failed."
    };
  } catch (error) {
    console.error("AI Analysis error:", error);
    return { mogScore: 1.0, analysis: "AI could not process the face." };
  }
};
