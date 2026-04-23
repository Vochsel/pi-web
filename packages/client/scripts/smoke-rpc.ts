import { PiRpcClient } from "../src/node.js";

async function main(): Promise<void> {
  const client = new PiRpcClient("smoke-test", {
    sessionMode: "ephemeral",
    extraArgs: ["--no-tools"],
    responseTimeoutMs: 45_000,
  });

  client.onUiEvent((event) => {
    if (event.type === "message.delta" && event.assistantEvent.type === "text_delta") {
      process.stdout.write(event.assistantEvent.delta);
    }
  });

  try {
    const initialState = await client.getState();
    console.log("Initial session state:", initialState.sessionId ?? "unknown");

    await client.promptAndWait(
      "Reply with the single word PONG. Do not use tools or markdown.",
      {},
      45_000,
    );

    const messages = await client.getMessages();
    const assistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");

    console.log("\nFinal assistant message:");
    console.log(
      assistant && "content" in assistant
        ? assistant.content
            .map((block) =>
              typeof block === "object" &&
              block !== null &&
              "type" in block &&
              block.type === "text" &&
              "text" in block &&
              typeof block.text === "string"
                ? block.text
                : "",
            )
            .join("")
        : "(no assistant message)",
    );
  } finally {
    await client.stop();
  }
}

await main();
