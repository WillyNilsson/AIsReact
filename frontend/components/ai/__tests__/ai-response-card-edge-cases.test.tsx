import { render, screen } from "@testing-library/react";
import { AIResponseCard } from "../ai-response-card";
import { AIResponse } from "@/lib/types";

describe("AIResponseCard Edge Cases", () => {
  // Test with completely empty response
  it("handles null/undefined response data gracefully", () => {
    const emptyResponse: AIResponse = {
      id: 1,
      post_id: 1,
      model_name: undefined,
      response_data: null,
      is_successful: true,
      response_time_ms: 100,
      token_count: 50,
      created_at: new Date().toISOString(),
      error_message: null,
    };

    const { container } = render(<AIResponseCard response={emptyResponse} />);

    // Should show "Unknown Model" for undefined model_name
    expect(screen.getByText("Unknown Model")).toBeInTheDocument();

    // Should show fallback text for missing data
    // ReactMarkdown might wrap the text, so let's check if the text exists in the container
    expect(container.textContent).toContain("No summary available");
  });

  // Test with missing model name
  it("handles missing model name", () => {
    const response: AIResponse = {
      id: 2,
      post_id: 1,
      model_name: undefined,
      response_data: {
        summary: "Test summary",
        historical_context: "Test history",
        future_development: "Test future",
        opinions: "Test opinions",
      },
      is_successful: true,
      response_time_ms: 100,
      token_count: 50,
      created_at: new Date().toISOString(),
      error_message: null,
    };

    render(<AIResponseCard response={response} />);

    expect(screen.getByText("Unknown Model")).toBeInTheDocument();
  });

  // Test with empty response_data object
  it("handles empty response_data object", () => {
    const response: AIResponse = {
      id: 3,
      post_id: 1,
      model_name: "gpt-4",
      response_data: {},
      is_successful: true,
      response_time_ms: 100,
      token_count: 50,
      created_at: new Date().toISOString(),
      error_message: null,
    };

    render(<AIResponseCard response={response} />);

    // Should show fallback text for all missing fields
    expect(screen.getByText("No summary available")).toBeInTheDocument();
    expect(
      screen.getByText(/No historical context available/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No future development available/),
    ).toBeInTheDocument();
    expect(screen.getByText(/No opinions available/)).toBeInTheDocument();
  });

  // Test with malformed data (non-string values)
  it("handles malformed response data with non-string values", () => {
    const response: AIResponse = {
      id: 4,
      post_id: 1,
      model_name: "claude-3",
      response_data: {
        summary: 123 as unknown as string, // Invalid type
        historical_context: null as unknown as string,
        future_development: undefined as unknown as string,
        opinions: { invalid: "object" } as unknown as string,
      },
      is_successful: true,
      response_time_ms: 100,
      token_count: 50,
      created_at: new Date().toISOString(),
      error_message: null,
    };

    // Should not crash
    const { container } = render(<AIResponseCard response={response} />);

    // Should handle non-string values gracefully
    // Numbers should be converted to string but objects should show fallback
    expect(container.textContent).toContain("No summary available"); // 123 is not a string, so fallback is used
    // Objects should not be rendered
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
  });

  // Test with unknown provider
  it("handles unknown AI provider gracefully", () => {
    const response: AIResponse = {
      id: 5,
      post_id: 1,
      model_name: "unknown-ai-model-xyz",
      response_data: {
        summary: "Test summary",
        historical_context: "Test history",
        future_development: "Test future",
        opinions: "Test opinions",
      },
      is_successful: true,
      response_time_ms: 100,
      token_count: 50,
      created_at: new Date().toISOString(),
      error_message: null,
    };

    render(<AIResponseCard response={response} />);

    // Should display the model name as-is when provider not recognized
    const modelNameElements = screen.getAllByText("unknown-ai-model-xyz");
    expect(modelNameElements).toHaveLength(2); // Should appear in both title and subtitle
  });

  // Test error state
  it("displays error message when response has error", () => {
    const response: AIResponse = {
      id: 6,
      post_id: 1,
      model_name: "gpt-4",
      response_data: null,
      is_successful: false,
      response_time_ms: null,
      token_count: null,
      created_at: new Date().toISOString(),
      error_message: "API rate limit exceeded",
    };

    render(<AIResponseCard response={response} />);

    expect(
      screen.getByText(/Analysis failed: API rate limit exceeded/),
    ).toBeInTheDocument();
  });

  // Test with missing response time and token count
  it("handles missing metrics gracefully", () => {
    const response: AIResponse = {
      id: 7,
      post_id: 1,
      model_name: "gemini-pro",
      response_data: {
        summary: "Test summary",
        historical_context: "Test history",
        future_development: "Test future",
        opinions: "Test opinions",
      },
      is_successful: true,
      response_time_ms: null,
      token_count: null,
      created_at: new Date().toISOString(),
      error_message: null,
    };

    render(<AIResponseCard response={response} />);

    // Should not crash when metrics are null
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
    expect(screen.getByText("Test summary")).toBeInTheDocument();
  });
});
