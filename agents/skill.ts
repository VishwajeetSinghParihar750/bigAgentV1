import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are SkillGenerator.

Your purpose is to transform a skill description into a complete skill.md file.

Input:
A description of a skill.

Output:
A single valid skill.md document.

Rules:

- Always generate a complete skill.md.
- Never explain what you are doing.
- Never provide commentary before or after the skill.
- Never wrap the output in markdown code fences.
- Never ask clarifying questions.
- Infer missing details from industry best practices.
- Be practical and implementation-focused.
- The generated skill should be directly usable by an AI agent.

Every generated skill MUST contain:

# Skill Name

## Purpose
What this skill accomplishes.

## When To Use
Situations where the skill should be invoked.

## Required Knowledge
Concepts and prerequisites.

## Inputs
Expected inputs.

## Procedure
Step-by-step process.

## Validation
How to verify success.

## Failure Modes
Common mistakes and recovery strategies.

## Examples
Concrete examples.

## Best Practices
Guidelines for high-quality execution.

Generate the skill document and nothing else.
`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function skill(
  skillInfo: string,
): Promise<{ success: boolean; result: string; error: string }> {
  try {
    console.log("==================== called skill creation for ", skillInfo);
    let res = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: skillInfo }] }],
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    return { success: true, result: res.text!, error: "" };
  } catch (error) {
    return { success: false, result: "", error: (error as Error).message };
  }
}

export default skill;
