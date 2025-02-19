import type { Config, Context } from "@netlify/functions";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config: Config = {
  method: "POST",
  path: "/dalle",
};

export default async (req: Request, context: Context) => {
  try {
    const text = await req.text();
    const { message } = JSON.parse(text || "{}");

    if (!message) {
      return new Response("Message is required", { status: 400 });
    }

    // Check if this is an image generation request with more flexible detection
    const isImageRequest = message.toLowerCase().match(/(generate|create|draw|make).*(image|picture|artwork|drawing)/i);

    if (isImageRequest) {
      // Clean up the prompt by removing the request language
      const imagePrompt = message.replace(/(can you |please |could you )?(generate|create|draw|make)( me)?( an?| the)? (image|picture|artwork|drawing)( of| for)?/i, "").trim();

      // Handle image generation
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
      });

      return new Response(JSON.stringify(response.data[0].url), { 
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    } else {
      // Handle chat completion
      const stream = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: message }],
        stream: true,
      });

      // Create a readable stream
      const readable = new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
          controller.close();
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
};