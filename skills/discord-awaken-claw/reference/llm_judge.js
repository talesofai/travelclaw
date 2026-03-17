const fetch = require('node-fetch');

async function callLLM() {
  const prompt = `用户心中想着一个虚构角色。已知线索：
- 用户给出的词/描述：秦时明月
- 已回答问题：[]
- 已排除的角色：[]

请判断你的确信程度：

A) 如果有 85% 以上的把握，直接猜测：
{
  "action": "guess",
  "character": "角色中文名",
  "from": "《作品名》",
  "emoji": "单个 emoji",
  "color": "#十六进制主题色",
  "desc": "一句话特质（≤20 字）",
  "greet": "角色第一句话（可用\\n 换行）"
}

B) 如果还不够确定，生成追问：
{
  "action": "question",
  "question": "追问（1 句，具体可见的特征）",
  "options": ["特征 1", "特征 2", "特征 3"]
}

只输出 JSON，不要其他文字。`;

  const response = await fetch('https://litellm.talesofai.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk-7d8f9a2b3c4e5f6a7b8c9d0e1f2a3b4c',
    },
    body: JSON.stringify({
      model: 'litellm/qwen3.5-plus',
      messages: [
        { role: 'system', content: '你是一个"龙虾宝宝"，正在等待破壳成为用户心中的角色。用户心中想着一个著名虚构角色，你通过追问逐步识别它。所有输出必须是严格的 JSON，不包含任何其他文字。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API 错误：${response.status} ${error}`);
  }
  
  const data = await response.json();
  console.log(data.choices[0].message.content);
}

callLLM().catch(console.error);
