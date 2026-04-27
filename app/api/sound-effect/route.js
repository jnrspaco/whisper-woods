export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { prompt, duration } = body ?? {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return Response.json({ error: 'Sound prompt is required.' }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: prompt.trim(),
        duration_seconds: duration || 10,
        prompt_influence: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('ElevenLabs SFX error:', response.status, errText);
      return Response.json({ error: 'Sound generation failed.' }, { status: 502 });
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('SFX error:', err);
    return Response.json({ error: 'Sound generation failed.' }, { status: 500 });
  }
}
