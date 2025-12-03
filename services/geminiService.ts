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
    1. 在下面的"Available Products" JSON列表中找到用户提到的商品。
    2. 提取数量（例如 "5个", "一打", "10"）。如果未提及数量但隐含了（例如"一个狗套"），默认为1。如果完全没有提及数量，返回 null。
    3. 如果用户输入模糊或匹配多个项目（例如"狗套"可能匹配 S/M/L/XL 号），将 matchedProductId 设为 null，并在 'suggestions' 列表中提供最多 5 个可能的 Product ID。
    4. 如果有高置信度的精确匹配（例如用户说了"狗套S"），设置 'matchedProductId'。
    5. 请忽略错别字或发音相似的词。

    Available Products JSON:
    ${JSON.stringify(productContext)}
  `;

  try {
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

  } catch (error) {
    console.error("Gemini matching failed:", error);
    // Fallback: empty result
    return { matchedProductId: null, detectedQuantity: null, suggestions: [] };
  }
};
