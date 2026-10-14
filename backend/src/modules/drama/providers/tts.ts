export function silentWav(seconds = 1): Buffer {
  const sampleRate = 44100;
  const samples = Math.max(1, Math.round(sampleRate * seconds));
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

export async function synthesizeRemote(baseUrl: string, text: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice_id: 'default' }),
  });
  if (!response.ok) throw new Error(`tts ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
