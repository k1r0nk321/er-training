import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req) {
  try {
    const body = await req.json();
    const { system, userMsg, history = [], imageUrl } = body;

    const messages = [
      ...history,
      {
        role: "user",
        content: imageUrlh
          ? [
              {
                type: "image",
                source: { type: "url", url: imageUrl }
              },
              { type: "text", text: userMsg }
            ]
          : userMsg
      }
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      system,
      messages
    });

    const text = response.content?.[0]?.text ?? "（応答なし）";
    return Response.json({ text });
  } catch (e) {
    return Response.json({ text: "[エラー] " + e.message }, { status: 500 });
  }
}
