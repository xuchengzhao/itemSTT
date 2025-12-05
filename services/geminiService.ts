
import { GoogleGenAI, Type } from "@google/genai";
import { Product, MatchResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const matchProductFromTranscript = async (
  transcript: string,
  availableProducts: Product[]
): Promise<MatchResult> => {
  if (!transcript.trim()) {
    return { matchedProductId: null, detectedQuantity: null, suggestions: [] };
  }

  // Optimize context by mapping only necessary fields
  const productContext = availableProducts.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category
  }));

  const prompt = `
    你是一个库存管理助手。
    用户用语音说出了以下内容来添加商品："${transcript}"。

    你的任务：
    1. 在下面的"Available Products" JSON列表中找到用户可能意指的商品。
    2. 提取数量（例如 "5个", "一打", "10"）。如果未提及数量但隐含了（例如"一个狗套"），默认为1。如果完全没有提及数量，返回 null。
    3. **核心任务**：无论你是否找到精确匹配，都必须在 'suggestions' 列表中返回 10-20 个相关的 Product ID。
       - 如果有精确匹配（例如用户明确说了"狗套S"），将该 ID 放在 'matchedProductId' 中，**同时也必须**包含在 'suggestions' 列表的第一个位置。
       - 如果没有精确匹配，列出最可能的相似商品。
    4. 请忽略错别字或发音相似的词。

    Available Products JSON:
    ${JSON.stringify(productContext)}
  `;

  // We intentionally do NOT try-catch here. 
  // If the API call fails (e.g. invalid Key, network error), we want it to throw 
  // so the calling component (AddItemModal) can catch it and switch to Local/Offline matching.
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matchedProductId: { type: Type.STRING, nullable: true },
          detectedQuantity: { type: Type.NUMBER, nullable: true },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["suggestions"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");

  const result = JSON.parse(text) as MatchResult;
  return result;
};
