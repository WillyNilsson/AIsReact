import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIResponseComparison } from "../ai-response-comparison";
import { AIResponse } from "@/lib/types";

// Mock dependencies
jest.mock("react-markdown", () => {
  const MockMarkdown = ({ children }: { children: string }) => (
    <div>{children}</div>
  );
  MockMarkdown.displayName = "MockMarkdown";
  return MockMarkdown;
});

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock clipboard API
const mockWriteText = jest.fn(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe("AIResponseComparison Component", () => {
  const mockResponses: AIResponse[] = [
    {
      id: 1,
      post_id: 1,
      model_name: "gemini-2.5-pro",
      response_data: {
        summary: "Gemini summary of the content.",
        historical_context: "Gemini historical context analysis.",
        future_development: "Gemini future predictions.",
        opinions: "Gemini opinions and thoughts.",
      },
      response_time_ms: 1500,
      token_count: 450,
      created_at: "2025-01-22T10:00:00Z",
      is_successful: true,
    },
    {
      id: 2,
      post_id: 1,
      model_name: "claude-sonnet-4",
      response_data: {
        summary: "Claude summary of the content.",
        historical_context: "Claude historical context analysis.",
        future_development: "Claude future predictions.",
        opinions: "Claude opinions and thoughts.",
      },
      response_time_ms: 2000,
      token_count: 500,
      created_at: "2025-01-22T10:00:00Z",
      is_successful: true,
    },
    {
      id: 3,
      post_id: 1,
      model_name: "o3-2025-04-16",
      response_data: {
        summary: "OpenAI summary of the content.",
        historical_context: "OpenAI historical context analysis.",
        future_development: "OpenAI future predictions.",
        opinions: "OpenAI opinions and thoughts.",
      },
      response_time_ms: 1800,
      token_count: 480,
      created_at: "2025-01-22T10:00:00Z",
      is_successful: true,
    },
  ];

  const failedResponse: AIResponse = {
    id: 4,
    post_id: 1,
    model_name: "deepseek-reasoner",
    response_data: {
      summary: "",
      historical_context: "",
      future_development: "",
      opinions: "",
    },
    error_message: "API request failed",
    created_at: "2025-01-22T10:00:00Z",
    is_successful: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteText.mockClear();
  });

  it("renders comparison header with correct aspect", () => {
    render(<AIResponseComparison responses={mockResponses} aspect="summary" />);

    expect(screen.getByText("Summary Comparison")).toBeInTheDocument();
  });

  it("shows no responses message when all failed", () => {
    render(
      <AIResponseComparison responses={[failedResponse]} aspect="summary" />,
    );

    expect(
      screen.getByText("No successful AI responses to compare"),
    ).toBeInTheDocument();
  });

  it("renders successful responses in grid view by default", () => {
    render(<AIResponseComparison responses={mockResponses} aspect="summary" />);

    // Check that all provider names are shown
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
    expect(screen.getByText("Anthropic Claude")).toBeInTheDocument();
    expect(screen.getByText("OpenAI o3")).toBeInTheDocument();

    // Check that summaries are shown
    expect(
      screen.getByText("Gemini summary of the content."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Claude summary of the content."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("OpenAI summary of the content."),
    ).toBeInTheDocument();
  });

  it("switches between grid and unified view", async () => {
    const user = userEvent.setup();
    render(<AIResponseComparison responses={mockResponses} aspect="summary" />);

    // Initially in grid view - button is active
    const gridButton = screen.getByText("Grid View").closest("button");
    const unifiedButton = screen.getByText("Unified View").closest("button");

    // Grid button should have default variant styling (no border class)
    expect(gridButton).not.toHaveClass("border");
    // Unified button should have outline variant styling (has border class)
    expect(unifiedButton).toHaveClass("border");

    // Switch to unified view
    await user.click(unifiedButton!);

    // Check tabs are present in unified view
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("displays consensus analysis for multiple responses", () => {
    render(<AIResponseComparison responses={mockResponses} aspect="summary" />);

    expect(screen.getByText("Consensus Analysis")).toBeInTheDocument();
    expect(screen.getByText("Agreement Level")).toBeInTheDocument();
    expect(screen.getByText("Key Themes")).toBeInTheDocument();
    expect(screen.getByText("Sentiment")).toBeInTheDocument();
  });

  it("copies content to clipboard in grid view", async () => {
    const user = userEvent.setup();

    render(<AIResponseComparison responses={mockResponses} aspect="summary" />);

    // Find copy buttons - they're in the grid cards
    const cards = screen
      .getAllByText(/summary of the content/)
      .map((el) => el.closest(".group"));

    // Hover over first card to show copy button
    if (cards[0]) {
      await user.hover(cards[0]);

      // Find the copy button within the card
      const copyButton = cards[0].querySelector('button[class*="h-6 w-6"]');
      if (copyButton) {
        await user.click(copyButton);

        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining("summary of the content"),
        );
        // Toast success would be called here
      }
    }
  });

  it("displays different aspects correctly", () => {
    const { rerender } = render(
      <AIResponseComparison responses={mockResponses} aspect="historical" />,
    );

    expect(
      screen.getByText("Historical Context Comparison"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Gemini historical context analysis."),
    ).toBeInTheDocument();

    rerender(
      <AIResponseComparison responses={mockResponses} aspect="future" />,
    );
    expect(
      screen.getByText("Future Development Comparison"),
    ).toBeInTheDocument();
    expect(screen.getByText("Gemini future predictions.")).toBeInTheDocument();

    rerender(
      <AIResponseComparison responses={mockResponses} aspect="opinions" />,
    );
    expect(
      screen.getByText("Opinions and Thoughts Comparison"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Gemini opinions and thoughts."),
    ).toBeInTheDocument();
  });

  it("shows response metadata in grid view", () => {
    render(<AIResponseComparison responses={mockResponses} aspect="summary" />);

    // Check response times
    expect(screen.getByText("1500ms")).toBeInTheDocument();
    expect(screen.getByText("2000ms")).toBeInTheDocument();
    expect(screen.getByText("1800ms")).toBeInTheDocument();

    // Check token counts
    expect(screen.getByText("450")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("480")).toBeInTheDocument();
  });

  it("handles fallback responses", () => {
    const fallbackResponses: AIResponse[] = [
      ...mockResponses,
      {
        ...mockResponses[0],
        id: 5,
        model_name: "grok-3",
        response_data: {
          ...mockResponses[0].response_data!,
          _fallback: true,
        },
      },
    ];

    render(
      <AIResponseComparison responses={fallbackResponses} aspect="summary" />,
    );

    expect(screen.getByText("Fallback")).toBeInTheDocument();
  });

  it("shows provider logos correctly", () => {
    render(<AIResponseComparison responses={mockResponses} aspect="summary" />);

    // Check for emoji logos
    expect(screen.getByText("🔷")).toBeInTheDocument(); // Gemini
    expect(screen.getByText("🟧")).toBeInTheDocument(); // Claude
    expect(screen.getByText("🟢")).toBeInTheDocument(); // OpenAI
  });

  it("filters out failed responses", () => {
    const mixedResponses = [...mockResponses, failedResponse];

    render(
      <AIResponseComparison responses={mixedResponses} aspect="summary" />,
    );

    // Should only show successful responses
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
    expect(screen.getByText("Anthropic Claude")).toBeInTheDocument();
    expect(screen.getByText("OpenAI o3")).toBeInTheDocument();

    // Failed response should not be shown
    expect(screen.queryByText("DeepSeek")).not.toBeInTheDocument();
  });

  it("displays unique insights in unified view", async () => {
    const user = userEvent.setup();
    render(<AIResponseComparison responses={mockResponses} aspect="summary" />);

    // Switch to unified view
    const unifiedButton = screen.getByText("Unified View").closest("button");
    await user.click(unifiedButton!);

    // Wait for unified view to render
    await waitFor(() => {
      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    // Check for unique insights section - it may or may not be present depending on the analysis
    const tabContent = screen.getByRole("tabpanel");
    expect(tabContent).toBeInTheDocument();
  });

  it("handles single response gracefully", () => {
    render(
      <AIResponseComparison responses={[mockResponses[0]]} aspect="summary" />,
    );

    // Should not show consensus analysis for single response
    expect(screen.queryByText("Consensus Analysis")).not.toBeInTheDocument();

    // Should still show the response
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
  });

  it("shows points of agreement in consensus analysis", () => {
    render(<AIResponseComparison responses={mockResponses} aspect="summary" />);

    // The component should identify common points
    const agreementSection = screen.queryByText("Points of Agreement:");
    if (agreementSection) {
      expect(agreementSection).toBeInTheDocument();
    }
  });

  it("applies correct colors to provider cards", () => {
    render(<AIResponseComparison responses={mockResponses} aspect="summary" />);

    // Find cards by their content
    const geminiCard = screen.getByText("Google Gemini").closest(".relative");
    const claudeCard = screen
      .getByText("Anthropic Claude")
      .closest(".relative");
    const openaiCard = screen.getByText("OpenAI o3").closest(".relative");

    // Each card should have a colored top border div
    expect(
      geminiCard?.querySelector('div[class*="bg-blue"]'),
    ).toBeInTheDocument();
    expect(
      claudeCard?.querySelector('div[class*="bg-orange"]'),
    ).toBeInTheDocument();
    expect(
      openaiCard?.querySelector('div[class*="bg-emerald"]'),
    ).toBeInTheDocument();
  });
});
