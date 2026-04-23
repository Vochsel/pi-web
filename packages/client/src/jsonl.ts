import { StringDecoder } from "node:string_decoder";

export interface JsonlFrameParser {
  pushChunk(chunk: string): string[];
  flush(): string[];
}

export function createJsonlFrameParser(initialBuffer = ""): JsonlFrameParser {
  let buffer = initialBuffer;

  return {
    pushChunk(chunk) {
      buffer += chunk;
      const lines: string[] = [];

      while (true) {
        const newlineIndex = buffer.indexOf("\n");

        if (newlineIndex === -1) {
          break;
        }

        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) {
          line = line.slice(0, -1);
        }

        lines.push(line);
      }

      return lines;
    },

    flush() {
      if (buffer.length === 0) {
        return [];
      }

      const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
      buffer = "";
      return [line];
    },
  };
}

export function serializeJsonLine(payload: unknown): string {
  return `${JSON.stringify(payload)}\n`;
}

export function attachJsonlStreamReader(
  stream: NodeJS.ReadableStream,
  onLine: (line: string) => void,
): () => void {
  const decoder = new StringDecoder("utf8");
  const parser = createJsonlFrameParser();

  const onData = (chunk: Buffer | string) => {
    const decoded = typeof chunk === "string" ? chunk : decoder.write(chunk);

    for (const line of parser.pushChunk(decoded)) {
      onLine(line);
    }
  };

  const onEnd = () => {
    const tail = decoder.end();

    for (const line of parser.pushChunk(tail)) {
      onLine(line);
    }

    for (const line of parser.flush()) {
      onLine(line);
    }
  };

  stream.on("data", onData);
  stream.on("end", onEnd);

  return () => {
    stream.off("data", onData);
    stream.off("end", onEnd);
  };
}
