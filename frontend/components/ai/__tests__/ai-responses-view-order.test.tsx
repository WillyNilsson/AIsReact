import { render } from "@testing-library/react";
import { AIResponsesView } from "../ai-responses-view";
import { AIResponse } from "@/lib/types";

// Mock the ReactMarkdown component to avoid its complexity in tests
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("AIResponsesView Model Order", () => {
  const createMockResponse = (
    id: number,
    modelName: string,
    isSuccessful: boolean = true,
  ): AIResponse => ({
    id,
    post_id: 1,
    model_name: modelName,
    response_data: isSuccessful
      ? {
          summary: `Summary from ${modelName}`,
          historical_context: `Historical context from ${modelName}`,
          future_development: `Future development from ${modelName}`,
          opinions: `Opinions from ${modelName}`,
        }
      : null,
    is_successful: isSuccessful,
    created_at: new Date().toISOString(),
    response_time_ms: 1500,
    token_count: 100,
    error_message: null,
  });

  it("displays AI responses in the correct order: ChatGPT, Gemini, Grok, DeepSeek, Claude", () => {
    const responses = [
      createMockResponse(1, "claude-sonnet-4-20250514"),
      createMockResponse(2, "gpt-4o-2024-08-06"),
      createMockResponse(3, "deepseek-reasoner"),
      createMockResponse(4, "gemini-2.5-pro"),
      createMockResponse(5, "grok-4-0709"),
    ];

    const { container } = render(<AIResponsesView responses={responses} />);

    // Get all h5 elements which contain model names in the comparison view
    const modelHeaders = container.querySelectorAll("h5");
    const modelNames = Array.from(modelHeaders).map((el) => el.textContent);

    // The first 5 h5 elements should be from the Summary tab in the correct order
    expect(modelNames[0]).toBe("gpt-4o-2024-08-06");
    expect(modelNames[1]).toBe("gemini-2.5-pro");
    expect(modelNames[2]).toBe("grok-4-0709");
    expect(modelNames[3]).toBe("deepseek-reasoner");
    expect(modelNames[4]).toBe("claude-sonnet-4-20250514");
  });

  it("handles responses with partial model names correctly", () => {
    const responses = [
      createMockResponse(1, "Claude"),
      createMockResponse(2, "GPT-4"),
      createMockResponse(3, "DeepSeek"),
      createMockResponse(4, "Gemini"),
      createMockResponse(5, "Grok"),
    ];

    const { container } = render(<AIResponsesView responses={responses} />);

    const modelHeaders = container.querySelectorAll("h5");
    const modelNames = Array.from(modelHeaders).map((el) => el.textContent);

    // Verify the order still works with partial names
    expect(modelNames[0]).toBe("GPT-4");
    expect(modelNames[1]).toBe("Gemini");
    expect(modelNames[2]).toBe("Grok");
    expect(modelNames[3]).toBe("DeepSeek");
    expect(modelNames[4]).toBe("Claude");
  });

  it("handles unknown models by placing them at the end", () => {
    const responses = [
      createMockResponse(1, "unknown-model-1"),
      createMockResponse(2, "gpt-4o-2024-08-06"),
      createMockResponse(3, "unknown-model-2"),
      createMockResponse(4, "gemini-2.5-pro"),
    ];

    const { container } = render(<AIResponsesView responses={responses} />);

    const modelHeaders = container.querySelectorAll("h5");
    const modelNames = Array.from(modelHeaders).map((el) => el.textContent);

    // Known models should come first in order
    expect(modelNames[0]).toBe("gpt-4o-2024-08-06");
    expect(modelNames[1]).toBe("gemini-2.5-pro");
    // Unknown models should be at the end
    expect(modelNames[2]).toBe("unknown-model-1");
    expect(modelNames[3]).toBe("unknown-model-2");
  });

  it("handles empty or null model names gracefully", () => {
    const responses = [
      createMockResponse(1, ""),
      createMockResponse(2, "gpt-4o-2024-08-06"),
      { ...createMockResponse(3, "gemini-2.5-pro"), model_name: null } as any,
    ];

    const { container } = render(<AIResponsesView responses={responses} />);

    // Should still render the valid models
    const modelHeaders = container.querySelectorAll("h5");
    const modelNames = Array.from(modelHeaders)
      .map((el) => el.textContent)
      .filter((name) => name && name.trim() !== "");

    // Should have at least the valid model
    expect(modelNames).toContain("gpt-4o-2024-08-06");
  });

  it("filters out unsuccessful responses before sorting", () => {
    const responses = [
      createMockResponse(1, "claude-sonnet-4-20250514", false),
      createMockResponse(2, "gpt-4o-2024-08-06", true),
      createMockResponse(3, "gemini-2.5-pro", false),
      createMockResponse(4, "grok-4-0709", true),
    ];

    const { container } = render(<AIResponsesView responses={responses} />);

    // Only successful responses should be displayed
    const modelHeaders = container.querySelectorAll("h5");
    const modelNames = Array.from(modelHeaders).map((el) => el.textContent);

    // Only GPT and Grok should be present (successful responses), in that order
    expect(modelNames[0]).toBe("gpt-4o-2024-08-06");
    expect(modelNames[1]).toBe("grok-4-0709");

    // Check that unsuccessful models are not present
    expect(modelNames).not.toContain("claude-sonnet-4-20250514");
    expect(modelNames).not.toContain("gemini-2.5-pro");
  });

  // Test the sorting function logic directly
  it("sorts models correctly according to the defined order", () => {
    const modelOrder = ["gpt", "gemini", "grok", "deepseek", "claude"];

    const testCases = [
      {
        input: ["claude", "gpt", "gemini"],
        expected: ["gpt", "gemini", "claude"],
      },
      {
        input: ["deepseek", "grok", "gpt"],
        expected: ["gpt", "grok", "deepseek"],
      },
      {
        input: ["unknown", "gpt", "unknown2"],
        expected: ["gpt", "unknown", "unknown2"],
      },
    ];

    testCases.forEach(({ input, expected }) => {
      const sorted = [...input].sort((a, b) => {
        const aIndex = modelOrder.findIndex((model) =>
          a.toLowerCase().includes(model),
        );
        const bIndex = modelOrder.findIndex((model) =>
          b.toLowerCase().includes(model),
        );

        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        if (aIndex !== -1) {
          return -1;
        }
        if (bIndex !== -1) {
          return 1;
        }
        return 0;
      });

      expect(sorted).toEqual(expected);
    });
  });
});
