const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { text, voice_id } = body ?? {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return Response.json({ error: 'Text is required.' }, { status: 400 });
  }

  const voiceId = voice_id || DEFAULT_VOICE_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.3,
            similarity_boost: 0.85,
            style: 0.4,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('ElevenLabs TTS error:', response.status, errText);
      return Response.json({ error: 'Narration failed.' }, { status: 502 });
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
    console.error('Narration error:', err);
    return Response.json({ error: 'Narration failed.' }, { status: 500 });
  }
}
