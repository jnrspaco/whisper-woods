import { GAME_SYSTEM_PROMPT } from '../../lib/gamePrompt';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { messages } = body ?? {};

  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: 'Messages array is required.' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: GAME_SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 512,
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq API error:', err);
      return Response.json({ error: 'Game engine failed.' }, { status: 500 });
    }

    const data = await response.json();
    const raw = data.choices[0].message.content;
    const cleaned = raw.replace(/```json\s?|```/g, '').trim();
    const gameResponse = JSON.parse(cleaned);

    return Response.json(gameResponse);
  } catch (err) {
    console.error('Game engine error:', err);
    return Response.json({ error: 'Game engine failed.' }, { status: 500 });
  }
}
