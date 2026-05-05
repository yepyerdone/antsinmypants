import { GoogleGenAI } from '@google/genai';

export interface MogAnalysis {
  mogScore: number;
  analysis: string;
}

export interface PSLAnalysis {
  pslScore: number;
  breakdown: string;
}

export interface ScanFrameMetrics {
  symmetry: number;
  contrast: number;
  sharpness: number;
  lowerThird: number;
  exposure: number;
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

const averageMetric = (metrics: ScanFrameMetrics[], key: keyof ScanFrameMetrics) => {
  if (metrics.length === 0) return 0.5;
  return metrics.reduce((sum, frame) => sum + frame[key], 0) / metrics.length;
};

const getDominantMetric = (metrics: ScanFrameMetrics[]) => {
  const values = [
    { label: 'symmetry', value: averageMetric(metrics, 'symmetry') },
    { label: 'lower-third definition', value: averageMetric(metrics, 'lowerThird') },
    { label: 'facial structure sharpness', value: averageMetric(metrics, 'sharpness') },
    { label: 'contrast', value: averageMetric(metrics, 'contrast') },
    { label: 'exposure control', value: averageMetric(metrics, 'exposure') },
  ];

  return values.sort((a, b) => b.value - a.value)[0];
};

const analyzeLocalScan = (metrics: ScanFrameMetrics[]): MogAnalysis => {
  const symmetry = averageMetric(metrics, 'symmetry');
  const contrast = averageMetric(metrics, 'contrast');
  const sharpness = averageMetric(metrics, 'sharpness');
  const lowerThird = averageMetric(metrics, 'lowerThird');
  const exposure = averageMetric(metrics, 'exposure');

  const score =
    2.2 +
    symmetry * 2.3 +
    contrast * 1.45 +
    sharpness * 1.65 +
    lowerThird * 1.35 +
    exposure * 1.05;
  const mogScore = Number(parseScore(score, 5).toFixed(1));

  const strongest = getDominantMetric(metrics).label;

  return {
    mogScore,
    analysis: `Local 5-second scan completed. Strongest measured signal: ${strongest}; score is based on symmetry, lower-third definition, contrast, exposure, and scan sharpness.`,
  };
};

const analyzeLocalPSLScan = (metrics: ScanFrameMetrics[]): PSLAnalysis => {
  const symmetry = averageMetric(metrics, 'symmetry');
  const contrast = averageMetric(metrics, 'contrast');
  const sharpness = averageMetric(metrics, 'sharpness');
  const lowerThird = averageMetric(metrics, 'lowerThird');
  const exposure = averageMetric(metrics, 'exposure');

  const pslScore =
    1.4 +
    symmetry * 1.85 +
    lowerThird * 1.55 +
    sharpness * 1.25 +
    contrast * 0.95 +
    exposure * 1.0;
  const score = Math.max(1, Math.min(8, pslScore));
  const strongest = getDominantMetric(metrics).label;

  return {
    pslScore: Number(score.toFixed(1)),
    breakdown: `Measured baseline from scan frames. Strongest visual signal: ${strongest}; rating weighs symmetry, lower-third definition, structure sharpness, contrast, and exposure.`,
  };
};

export const performPSLScan = async (base64Image: string, metrics: ScanFrameMetrics[] = []): Promise<PSLAnalysis> => {
  const ai = createClient();
  const model = getModel();

  if (!ai) {
    return analyzeLocalPSLScan(metrics);
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
    const pslScore = Math.max(1, Math.min(8, Number(result.pslScore) || analyzeLocalPSLScan(metrics).pslScore));

    return {
      pslScore: Number(pslScore.toFixed(1)),
      breakdown: result.breakdown || 'Standard facial geometry detected.',
    };
  } catch (error) {
    console.error('PSL Scan error:', error);
    return analyzeLocalPSLScan(metrics);
  }
};

export const analyzeFace = async (base64Image: string, metrics: ScanFrameMetrics[] = []): Promise<MogAnalysis> => {
  return analyzeFaceScan([base64Image], metrics);
};

export const analyzeFaceScan = async (base64Images: string[], metrics: ScanFrameMetrics[] = []): Promise<MogAnalysis> => {
  const ai = createClient();
  const model = getModel();
  const validImages = base64Images.filter(Boolean).slice(0, 6);

  if (!ai) {
    return analyzeLocalScan(metrics);
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
    return analyzeLocalScan(metrics);
  }
};
