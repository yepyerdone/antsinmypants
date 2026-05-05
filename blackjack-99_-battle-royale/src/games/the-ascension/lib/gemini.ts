import { GoogleGenAI } from '@google/genai';

export interface MogAnalysis {
  mogScore: number;
  analysis: string;
}

export interface PSLAnalysis {
  pslScore: number;
  breakdown: string;
}

const getApiKey = () => {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') || '';
};

const createClient = () => {
  const apiKey = getApiKey();
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
};

const getModel = () => {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_GEMINI_MODEL || env.GEMINI_MODEL || 'gemini-2.5-flash';
};

const parseScore = (value: unknown, fallback: number) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(1, Math.min(10, score));
};

export const performPSLScan = async (base64Image: string): Promise<PSLAnalysis> => {
  const ai = createClient();
  const model = 'gemini-3-flash-preview';

  if (!ai) {
    return { pslScore: 5.0, breakdown: 'Scan calibration failed.' };
  }

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
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text || '{}');
    return {
      pslScore: Number(result.pslScore) || 5.0,
      breakdown: result.breakdown || 'Standard facial geometry detected.',
    };
  } catch (error) {
    console.error('PSL Scan error:', error);
    return { pslScore: 5.0, breakdown: 'Scan calibration failed.' };
  }
};

export const analyzeFace = async (base64Image: string): Promise<MogAnalysis> => {
  return analyzeFaceScan([base64Image]);
};

export const analyzeFaceScan = async (base64Images: string[]): Promise<MogAnalysis> => {
  const ai = createClient();
  const model = getModel();
  const validImages = base64Images.filter(Boolean).slice(0, 6);

  if (!ai) {
    throw new Error('Gemini API key is missing. Add GEMINI_API_KEY or VITE_GEMINI_API_KEY to enable Ascension scoring.');
  }

  if (validImages.length === 0) {
    throw new Error('No scan frames were captured.');
  }

  const prompt = `Analyze this 5-second scan sequence to determine its "chadness" (physical attractiveness and dominance) based on jawline definition, facial symmetry, brow ridge, facial structure, and overall aesthetic harmony.
  
  Use all frames together, favoring clear frontal frames and ignoring motion blur. Be objective and slightly clinical, but use "mogging" terminology if appropriate.
  
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
            ...validImages.map((base64Image) => ({
              inlineData: { mimeType: 'image/jpeg', data: base64Image },
            })),
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text || '{}');
    const mogScore = parseScore(result.mogScore, NaN);

    if (!Number.isFinite(mogScore)) {
      throw new Error('Gemini returned an invalid Ascension score.');
    }

    return {
      mogScore: Number(mogScore.toFixed(1)),
      analysis: result.analysis || 'Analysis failed.',
    };
  } catch (error) {
    console.error('AI Analysis error:', error);
    throw error;
  }
};
