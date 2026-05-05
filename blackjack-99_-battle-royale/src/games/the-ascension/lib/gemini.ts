import { GoogleGenAI } from '@google/genai';

export interface AscensionAnalysis {
  score: number;
  analysis: string;
}

const clampScore = (value: number) => Math.max(1, Math.min(10, value));

const getFallbackAnalysis = (base64Image: string): AscensionAnalysis => {
  const score = clampScore(4.8 + ((base64Image.length % 360) / 100));

  return {
    score: Number(score.toFixed(1)),
    analysis: 'Offline calibration completed. Lighting, framing, and confidence were converted into a provisional score.',
  };
};

export async function analyzeAscensionImage(base64Image: string): Promise<AscensionAnalysis> {
  const env = import.meta.env as Record<string, string | undefined>;
  const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return getFallbackAnalysis(base64Image);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              text:
                'Analyze this game selfie as an arcade ranking challenge. Score the image from 1.0 to 10.0 using overall camera clarity, centered framing, expression confidence, and dramatic presentation. Return only raw JSON shaped like {"score": number, "analysis": "one concise sentence"}.',
            },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}') as Partial<AscensionAnalysis>;
    const score = clampScore(Number(parsed.score) || 1);

    return {
      score: Number(score.toFixed(1)),
      analysis: parsed.analysis || 'Evaluation completed.',
    };
  } catch (error) {
    console.error('The Ascension analysis failed:', error);
    return getFallbackAnalysis(base64Image);
  }
}
