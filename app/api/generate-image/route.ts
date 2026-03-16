import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const { won } = await req.json();

    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

    const prompt = won
      ? "A cinematic, highly detailed, photorealistic image of a futuristic, prosperous, and peaceful global city. Clean energy, flying vehicles, lush green parks integrated into skyscrapers. Bright, optimistic lighting, sunrise. The world has been saved from crisis."
      : "A cinematic, highly detailed, photorealistic image of a ruined, dystopian global city after a massive economic and geopolitical collapse. Smog, fires, ruined skyscrapers, abandoned streets. Dark, pessimistic lighting, stormy sky. The world has fallen into chaos.";

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      },
    });

    let base64EncodeString = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        base64EncodeString = part.inlineData.data;
        break;
      }
    }

    if (!base64EncodeString) {
      throw new Error('No image generated');
    }

    const imageUrl = `data:image/png;base64,${base64EncodeString}`;

    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    console.error('Error generating image:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate image' }, { status: 500 });
  }
}
