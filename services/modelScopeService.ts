
import { Product, MatchResult } from "../types";

// 默认 Key (如果用户未输入则使用此备用)
export const DEFAULT_API_KEY = 'ms-959f955d-d522-48be-9fa3-086b7085ca79';

export const matchProductFromTranscript = async (
  transcript: string,
  availableProducts: Product[],
  userApiKey?: string // 新增参数：允许传入用户自定义的 Key
): Promise<MatchResult> => {
  if (!transcript.trim()) {
    return { matchedProductId: null, detectedQuantity: null, suggestions: [] };
  }

  // 优先使用传入的 Key，否则使用默认 Key
  const apiKey = userApiKey?.trim() || DEFAULT_API_KEY;

  // 优化上下文：仅发送必要的字段以减少 token 消耗
  const productContext = availableProducts.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category
  }));

  const systemPrompt = `
    你是一个智能库存管理助手。你的核心任务是将用户的语音指令（可能包含口音、错别字、不完整描述或同音词）精准匹配到数据库中的商品。
    
    ### 匹配规则 (优先级从高到低)：
    1. **模糊/包含匹配 (High Priority)**：
       - 用户指令往往只是商品全名的一部分。
       - **关键规则**：如果用户说的是一个宽泛的词（如"皮带"），**必须**在 suggestions 中列出数据库中所有包含"皮带"的商品（如"普通皮带"、"链条细皮带"、"双扣皮带"等）。
       - 示例：用户说 "狗套"，应匹配并返回 "狗套S", "狗套M", "狗套L", "狗套XL" 等。
       - 示例：用户说 "裙甲"，应匹配 "贴皮裙甲A黑", "贴皮裙甲B棕" 等。
    2. **同音/拼音模糊匹配 (Critical)**：
       - 语音识别容易出现同音字错误。
       - **必须**考虑拼音相似性。
       - 示例：如果用户说 "护西"，应匹配 "护膝"。
       - 示例：如果用户说 "福娃" 或 "护晚"，应匹配 "护腕"。
       - 示例：如果用户说 "皮蛋A黑" (pidan)，应匹配 "皮带A黑" (pidai)。
    3. **语义/别名匹配**：
       - 示例："小狗的衣服" -> 匹配 "狗套" 或 "背心"。
       - 示例："装瓶子的" -> 匹配 "炼金瓶套" 或 "炼金瓶盒"。

    ### 提取数量规则：
    - 识别中文数字（如"两百"、"一打"、"三个"）并转换为阿拉伯数字。
    - 默认为 1。

    ### 输出要求：
    - **必须返回纯净的 Standard JSON 格式**。
    - **严禁包含注释**：JSON 中不能出现 // 或 /* ... */ 注释，否则会导致解析失败。
    - **严禁包含解释性文字**：只返回 JSON 对象，不要在开头或结尾添加"解释"或"Note"。
    - **suggestions** 字段**至少包含 10-20 个**相关的商品 ID (越多越好，覆盖所有可能性)。
       - 即使有精确匹配，也要把其他相似的商品列在 suggestions 中，供用户选择。

    ### 输出 JSON 结构示例：
    {
      "matchedProductId": "C001A1A",
      "detectedQuantity": 5,
      "suggestions": ["C001A1A", "C001A2A", "P005A0A3", "P005A0B5"]
    }
  `;

  const userPrompt = `
    用户语音指令: "${transcript}"
    
    可用商品列表 (JSON):
    ${JSON.stringify(productContext)}
  `;

  try {
    const response = await fetch("https://api-inference.modelscope.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3.2", // 使用通用指令模型，处理语言模糊性能力更强
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2, // 降低温度，让格式更稳定
        max_tokens: 1024
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        // 明确抛出 401 错误信息以便前端捕获
        if (response.status === 401) {
             throw new Error("API Key 无效或已过期 (401)。请在设置中更新您的魔搭社区 API Key。");
        }
        throw new Error(`ModelScope API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    // --- JSON 清洗与提取逻辑 ---
    
    // 1. 移除 Markdown 代码块标记
    let jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();

    // 2. 提取最外层的 {}，忽略 AI 可能添加的前缀/后缀废话
    const startIndex = jsonString.indexOf('{');
    const endIndex = jsonString.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
        jsonString = jsonString.substring(startIndex, endIndex + 1);
    }

    // 3. 移除 JS 风格的单行注释 (// ...)，这是导致解析失败的主要原因
    // 正则解释：匹配 // 及其后的所有字符直到行尾，使用 multiline 模式
    jsonString = jsonString.replace(/\/\/.*$/gm, '');

    // 4. 尝试解析
    try {
        const result = JSON.parse(jsonString) as MatchResult;
        if (!result.suggestions) result.suggestions = [];
        return result;
    } catch (parseError) {
        console.error("JSON Parse Failed:", parseError);
        console.log("Raw AI Content:", content);
        console.log("Cleaned JSON String:", jsonString);
        throw new Error("AI 返回了无法解析的数据格式");
    }

  } catch (error) {
    console.error("Online AI match failed:", error);
    console.log("DEBUG - Key used:", apiKey.substring(0, 8) + "...");
    throw error;
  }
};
