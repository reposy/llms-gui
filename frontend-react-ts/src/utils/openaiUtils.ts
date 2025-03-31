import { LLMNodeData, LLMResult } from '../types/nodes';

export async function executeOpenAINode(data: LLMNodeData): Promise<LLMResult> {
  const { model, prompt } = data;
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: data.temperature || 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    content: result.choices[0].message.content,
    text: result.choices[0].message.content,
    raw: result,
  };
} 