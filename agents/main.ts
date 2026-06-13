import { GoogleGenAI, Type } from "@google/genai";
import { exec } from "child_process";
import readline from "readline/promises";
import { stdout as output, stdin as input } from "process";
import { promisify } from "util";
import skill from "./skill";

const execAsync = promisify(exec);

const SYSTEM_INSTRUCTION = `
You are an autonomous coding assistant.

Your goal is to complete the user's request by using the available tools.

You have access to two tools:

bash(command: string) : { success: boolean; stdout: string; stderr: string }
skill(specificSkillDescription: string) : {success : boolean , result : string }

Rules:
- Use bash whenever information or actions are needed.
- Use skill whenever you need a particular skill for task.
- Explore the filesystem before making assumptions.
- Read files before modifying them.
- Prefer small, incremental changes.
- Verify your work by running commands and tests when possible.
- If a command fails, inspect the error and try to recover.
- Continue working until the task is complete.
- When finished, provide a concise summary of what was done.

Output either:
1. A tool call
or
2. A final response

Never invent command outputs. Only use information obtained from tool results.
`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const bashFunction = {
  name: "bash",
  description: `
GNU bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)
pass command and it will return the stdout, stderr of that command
  `,
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: {
        type: Type.STRING,
        description: "command to run on bash ex. ls -a",
      },
    },
    required: ["command"],
  },
};

const bash = async (
  command: string,
): Promise<{ success: boolean; stdout: string; stderr: string }> => {
  console.log("==================== called bash for ", command);
  try {
    let res = await execAsync(command);
    return { ...res, success: true };
  } catch (error) {
    return { success: false, stdout: "", stderr: (error as Error).message };
  }
};

//

const skillFunction = {
  name: "skill",
  description:
    "this takes the specific skill description and returns skill.md file for that skill",
  parameters: {
    type: Type.OBJECT,
    properties: {
      specificSkillDescription: {
        type: Type.STRING,
        description:
          "the specific skill you want ex. react skill or deployment skill",
      },
    },
  },
};

async function main() {
  let context: any = [];

  const rl = readline.createInterface({ input, output });

  while (true) {
    let userMessage = await rl.question("> ");

    while (true) {
      context.push({ role: "user", parts: [{ text: userMessage }] });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: context,
        config: {
          tools: [{ functionDeclarations: [bashFunction, skillFunction] }],
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      context.push(response!.candidates![0]!.content);

      if (response.functionCalls && response.functionCalls.length > 0) {
        // run
        for (let fc of response.functionCalls) {
          switch (fc.name) {
            case "bash":
              {
                let bashRes = await bash(fc.args!.command as string);
                context.push({
                  role: "user",
                  parts: [
                    {
                      functionResponse: {
                        name: fc.name,
                        response: bashRes,
                        id: fc.id,
                      },
                    },
                  ],
                });
              }
              break;

            case "skill":
              {
                let skillRes = await skill(
                  fc.args!.specificSkillDescription as string,
                );
                context.push({
                  role: "user",
                  parts: [
                    {
                      functionResponse: {
                        name: fc.name,
                        response: skillRes,
                        id: fc.id,
                      },
                    },
                  ],
                });
              }
              break;
            default:
              break;
          }
        }
      } else {
        //

        console.log(response.text);

        break;
      }
    }
  }

  //
}

main();
