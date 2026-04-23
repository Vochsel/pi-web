import { describe, expect, it } from "bun:test";

import { createJsonlFrameParser } from "./jsonl.js";

describe("createJsonlFrameParser", () => {
  it("splits only on LF and keeps unicode separators inside JSON payloads", () => {
    const parser = createJsonlFrameParser();
    const lines = parser.pushChunk(
      '{"text":"hello\u2028world"}\n{"text":"again\u2029now"}\n',
    );

    expect(lines).toEqual([
      '{"text":"hello\u2028world"}',
      '{"text":"again\u2029now"}',
    ]);
  });

  it("handles CRLF and chunk boundaries", () => {
    const parser = createJsonlFrameParser();
    expect(parser.pushChunk('{"id":1}\r')).toEqual([]);
    expect(parser.pushChunk('\n{"id":2}')).toEqual(['{"id":1}']);
    expect(parser.flush()).toEqual(['{"id":2}']);
  });
});
