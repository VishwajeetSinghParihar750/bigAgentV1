import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

let SYSTEM_INSTRUCTION = `
SYSTEM:

You are a model routing engine.

Your ONLY responsibility is selecting a model.


You MUST NOT:
- answer the user's request
- provide code
- explain anything
- perform the task

Routing goal:
Choose the lowest-cost model that can reliably complete the request.

Consider, in order:

1. Cost
2. Reasoning complexity
3. Coding difficulty
4. Context length requirements
5. Output length requirements
6. Need for speed vs quality
7. Thinking/reasoning capabilities
8. Multimodal requirements

Rules:
- Prefer cheaper models when multiple models can complete the task.
- Use expensive models only when clearly necessary.
- Choose exactly one model.

Available models:

{{AVAILABLE_MODELS_JSON}}

Return ONLY valid JSON:

{
  "model": "<model_name>", // this must be explicitly a name in AVAILABLE_MODELS_JSON
  "reason": "<reason_to_choose>"
}

`;

async function routing(
  userMessage: string,
): Promise<{ success: boolean; result: string; error: string }> {
  // keep a local rag that does not send to ai if can be identified trivially, which model to use
  // keep cheap gemini flash for routing or create your own rnn classifier

  // make a class of this

  const modelsRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY!}`,
  );
  const models: any = await modelsRes.json();

  const models10 = [];
  for (let model of models!.models as any[]) {
    models10.push({
      name: model.name.replace("models/", ""),
      inputTokenLimit: model.inputTokenLimit,
      outputTokenLimit: model.outputTokenLimit,
      temperature: model.temperature,
      topP: model.topP,
      topK: model.topK,
      maxTemperature: model.maxTemperature,
      thinking: model.thinking,
    });
    if (models10.length == 10) break;
  }

  const systemPrompt = SYSTEM_INSTRUCTION.replace(
    "{{AVAILABLE_MODELS_JSON}}",
    JSON.stringify(models, null, 2),
  );

  try {
    let USER_INSTRUCTION = `
USER:
Route this request:

<user_request>
{{USER_REQUEST}}
</user_request>

`;
    let res = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite", // cheap and fast
      contents: [
        {
          role: "user",
          parts: [
            { text: USER_INSTRUCTION.replace("USER_REQUEST", userMessage) },
          ],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            model: {
              type: Type.STRING,
              enum: models10.map((m) => m.name),
            },
            reason: {
              type: Type.STRING,
            },
          },
          required: ["model"],
        },
      },
    });

    const parsedInfo = JSON.parse(res.text!);
    const modelName = parsedInfo.model;

    return { success: true, result: modelName, error: "" };
  } catch (error) {
    return { success: false, result: "", error: (error as Error).message };
  }
}

export default routing;
