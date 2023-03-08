import { parse } from "https://deno.land/std@0.175.0/flags/mod.ts";
import { bold, red, cyan, green, gray } from "https://deno.land/std@0.178.0/fmt/colors.ts";
import prompts from "npm:prompts@2.4.2";
import { stderr } from "node:process";

const systemInput = `
Your goal is to generate terminal commands that performs a given prompt. Output only commands; do not write any explanations or line numbers.

Some information to help you:
- The computer is running macOS 13.3
- The shell is zsh
- The preferred editor is nvim
- brew, gh, and ghq are installed

Here is your prompt:
`.trim();

const COST_PER_TOKEN = 0.002 / 1000;

const flags = parse(Deno.args, {
    boolean: ["resetToken"],
    default: {
        resetToken: false,
    },
});

if (flags.resetToken) {
    localStorage.removeItem("openai-token");
    console.error(cyan("Token reset"));
    Deno.exit(0);
}

let input = flags._.join(" ").trim() ?? "";

if (!input) {
    const promptResult = await prompts({
        type: "text",
        name: "input",
        message: "Please enter your prompt",
        stdout: stderr,
    });

    if (!promptResult.input) {
        Deno.exit(1);
    }

    input = promptResult.input;
}

let token: string;

const storageToken = localStorage.getItem("openai-token");
if (storageToken) {
    token = storageToken;
} else {
    const promptResult = await prompts({
        type: "password",
        name: "token",
        message: "Please enter your OpenAI API key",
        stdout: stderr,
    });

    token = promptResult.token;
    localStorage.setItem("openai-token", token);
}

const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
            {
                role: "user",
                content: systemInput + "\n\n" + input,
            },
        ]
    }),
});

const json = await response.json();
if (json.error) {
    console.error(red(json.error.message));
    Deno.exit(1);
}

const command = json.choices[0].message.content.trim();
const tokens = json.usage.total_tokens;
const cost = tokens * COST_PER_TOKEN;
console.error(gray(`Tokens used: ${tokens.toLocaleString()} • Cost: $${cost.toFixed(6)}`));
console.error("");
console.error(bold("Command:"));
console.error(command);
console.error("");

const { action } = await prompts({
    type: "select",
    name: "action",
    message: "Choose an action",
    choices: [
        {
            title: "Execute command",
            value: "exec",
        },
        {
            title: "Copy to clipboard",
            value: "copy",
        },
        {
            title: "Abort",
            value: "abort",
        },
    ],
    stdout: stderr,
});

switch (action) {
    case "exec":
        console.error(cyan("Executing command"));
        console.log(command);
        break;
    case "copy":
        const process = Deno.run({
            cmd: ["pbcopy"],
            stdin: "piped",
        });

        await process.stdin.write(new TextEncoder().encode(command));
        process.stdin.close();

        const status = await process.status();
        if (status.success) {
            console.error(green("Copied to clipboard"));
            break;
        } else {
            console.error(red("Failed to copy to clipboard"));
            Deno.exit(1);
        }
    case "abort":
        console.error(gray("Aborted"));
        Deno.exit(2);
}
