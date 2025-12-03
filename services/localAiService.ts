import { pipeline, env } from '@xenova/transformers';
import { Product, MatchResult } from '../types';

// Configure transformers.js to use browser cache and remote models via CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton instance for the transcriber
let transcriber: any = null;

export const loadLocalModel = async (onProgress?: (progress: number) => void) => {
  if (transcriber) return transcriber;

  try {
    // Use the quantized tiny model for best performance on mobile
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      progress_callback: (data: any) => {
        if (data.status === 'progress' && onProgress) {
          onProgress(data.progress);
        }
      }
    });
    return transcriber;
  } catch (error) {
    console.error("Failed to load local model:", error);
    throw error;
  }
};

export const transcribeAudioLocally = async (audioBlob: Blob): Promise<string> => {
  if (!transcriber) throw new Error("Model not loaded");

  // Create a URL for the blob
  const url = URL.createObjectURL(audioBlob);
  
  try {
    // Run transcription
    const output = await transcriber(url, {
      language: 'chinese',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5
    });
    
    return output.text;
  } finally {
    URL.revokeObjectURL(url);
  }
};

// --- Offline Matching Logic ---

const CHINESE_NUMBERS: Record<string, number> = {
  '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
};

const extractQuantity = (text: string): number | null => {
  // Check for Arabic numbers
  const arabicMatch = text.match(/(\d+)/);
  if (arabicMatch) return parseInt(arabicMatch[0]);

  // Check for Chinese numbers (simple 1-10)
  for (const [key, val] of Object.entries(CHINESE_NUMBERS)) {
    if (text.includes(key)) return val;
  }

  return null;
};

export const matchProductLocally = (transcript: string, products: Product[]): MatchResult => {
  const normalizedText = transcript.toLowerCase();
  const quantity = extractQuantity(normalizedText);

  // Scoring candidates
  const candidates = products.map(product => {
    let score = 0;
    const pName = product.name.toLowerCase();
    const pId = product.id.toLowerCase();

    // ID Exact Match
    if (normalizedText.includes(pId)) score += 100;
    
    // Name Exact Match
    if (normalizedText.includes(pName)) score += 50;

    // Partial Name Match (simple token overlap)
    // We split product name into segments if it has spaces or specific separators, 
    // but Chinese names are often continuous. We check if important substrings exist.
    // For this simple version, we check if at least 2 consecutive characters match.
    if (pName.length > 2 && normalizedText.includes(pName.substring(0, 2))) {
        score += 5;
    }
    
    // Check if user said "狗套" and product is "狗套S"
    if (pName.startsWith(normalizedText) || normalizedText.includes(pName.split(/[A-Z0-9]/)[0])) {
        score += 10;
    }

    return { product, score };
  });

  // Sort by score
  candidates.sort((a, b) => b.score - a.score);

  const bestMatch = candidates[0];
  const suggestions = candidates
    .filter(c => c.score > 0)
    .slice(0, 5)
    .map(c => c.product.id);

  // Define threshold for "Confident Match"
  const matchedProductId = (bestMatch && bestMatch.score >= 40) ? bestMatch.product.id : null;

  return {
    matchedProductId,
    detectedQuantity: quantity,
    suggestions
  };
};
