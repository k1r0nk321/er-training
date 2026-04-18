import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req) {
  try {
    const { system, userMsg, history = [] } = await req.json();
    const messages = [
      ...history,
      { role: "user", content: userMsg }
    ];
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system,
      messages
    });
    const text = response.content?.[0]?.text ?? "（応答なし）";
    return Response.json({ text });
  } catch (e) {
    return Response.json({ text: "[エラー] " + e.message }, { status: 500 });
  }
}
