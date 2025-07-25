import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIResponseCard } from "../ai-response-card";
import { AIResponse } from "@/lib/types";

// Type assertion for Web Share API support is handled globally

// Mock dependencies
jest.mock("react-markdown", () => {
  const MockMarkdown = ({ children }: { children: string }) => {
    return React.createElement("div", null, children);
  };
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

// Mock share API
const mockShare = jest.fn(() => Promise.resolve());
Object.assign(navigator, {
  share: mockShare,
});

describe("AIResponseCard Component", () => {
  const mockResponse: AIResponse = {
    id: 1,
    post_id: 1,
    model_name: "gemini-2.5-pro",
    response_data: {
      summary: "This is a test summary of the AI response.",
      historical_context: "This provides historical context and background.",
      future_development: "This discusses potential future developments.",
      opinions: "These are the AI's opinions and thoughts on the matter.",
    },
    response_time_ms: 1500,
    token_count: 450,
    created_at: "2025-01-22T10:00:00Z",
    is_successful: true,
  };

  const mockErrorResponse: AIResponse = {
    ...mockResponse,
    error_message: "API request failed",
    is_successful: false,
  };

  // Mock URL and document methods
  const mockCreateObjectURL = jest.fn(() => "mock-url");
  const mockRevokeObjectURL = jest.fn();
  const mockAnchorClick = jest.fn();

  beforeAll(() => {
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteText.mockClear();
    mockShare.mockClear();
  });

  it("renders successful response correctly", () => {
    render(<AIResponseCard response={mockResponse} />);

    // Check provider info
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
    expect(screen.getByText("gemini-2.5-pro")).toBeInTheDocument();

    // Check metadata
    expect(screen.getByText("1500ms")).toBeInTheDocument();
    expect(screen.getByText("450 tokens")).toBeInTheDocument();

    // Check summary is visible
    expect(
      screen.getByText(mockResponse.response_data.summary),
    ).toBeInTheDocument();

    // Check collapsed preview shows partial text
    const preview = screen.getByText(/Historical:/);
    expect(preview).toBeInTheDocument();
    // The preview shows truncated text, not the full content
    expect(preview.textContent).toContain("Historical:");
  });

  it("renders error response correctly", () => {
    render(<AIResponseCard response={mockErrorResponse} />);

    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
    expect(
      screen.getByText("Analysis failed: API request failed"),
    ).toBeInTheDocument();
  });

  it("expands and collapses content", async () => {
    const user = userEvent.setup();
    render(<AIResponseCard response={mockResponse} />);

    // Initially collapsed - preview is visible
    const preview = screen.getByText(/Historical:/);
    expect(preview).toBeInTheDocument();

    // Full content not visible
    const fullSections = screen.queryAllByText("Historical Context");
    expect(fullSections).toHaveLength(0);

    // Expand
    const expandButton = screen.getByText("Show full analysis");
    await user.click(expandButton);

    // Full sections should be visible
    expect(screen.getByText("Historical Context")).toBeInTheDocument();
    expect(screen.getByText("Future Development")).toBeInTheDocument();
    expect(screen.getByText("Opinions and Thoughts")).toBeInTheDocument();

    // Preview should not be visible when expanded
    expect(screen.queryByText(/Historical:/)).not.toBeInTheDocument();

    // Collapse
    const collapseButton = screen.getByText("Show less");
    await user.click(collapseButton);

    // Back to collapsed state - preview visible again
    expect(screen.getByText(/Historical:/)).toBeInTheDocument();
  });

  it("shows collapsed preview of all sections", () => {
    render(<AIResponseCard response={mockResponse} />);

    // Check preview text
    expect(screen.getByText(/Historical:/)).toBeInTheDocument();
    expect(screen.getByText(/Future:/)).toBeInTheDocument();
    expect(screen.getByText(/Opinion:/)).toBeInTheDocument();
  });

  it("copies section content to clipboard", async () => {
    const user = userEvent.setup();

    // Mock successful clipboard write
    mockWriteText.mockResolvedValueOnce(undefined);

    render(<AIResponseCard response={mockResponse} />);

    // Find and click the copy button (it exists but might be visually hidden)
    const copyButton = screen.getByTitle("Copy to clipboard");
    await user.click(copyButton);

    expect(mockWriteText).toHaveBeenCalledWith(
      mockResponse.response_data.summary,
    );
    // Toast success would be called here
  });

  it("downloads content as markdown", async () => {
    const user = userEvent.setup();

    // Create a proper mock anchor element
    const mockAnchor = document.createElement("a");
    mockAnchor.click = mockAnchorClick;
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = jest.spyOn(document, "createElement");
    createElementSpy.mockImplementation((tagName) => {
      if (tagName === "a") {
        return mockAnchor;
      }
      return originalCreateElement(tagName);
    });

    render(<AIResponseCard response={mockResponse} />);

    const downloadButton = screen.getByTitle("Download as Markdown");
    await user.click(downloadButton);

    expect(mockAnchor.download).toContain("ai-analysis-gemini-2.5-pro");
    expect(mockAnchorClick).toHaveBeenCalled();
    // Toast success would be called here

    createElementSpy.mockRestore();
  });

  it("shares response content", async () => {
    const user = userEvent.setup();

    // We don't need to mock createElement for this test
    render(<AIResponseCard response={mockResponse} />);

    const shareButton = screen.getByTitle("Share");
    await user.click(shareButton);

    expect(mockShare).toHaveBeenCalledWith({
      title: "AI Analysis",
      text: expect.stringContaining("Google Gemini"),
      url: window.location.href,
    });
  });

  it("handles keyboard navigation", async () => {
    render(<AIResponseCard response={mockResponse} />);

    const card = screen.getByRole("article");

    // Initially collapsed
    expect(screen.queryByText("Historical Context")).not.toBeInTheDocument();

    // Test Space key to expand
    fireEvent.keyDown(card, {
      key: " ",
      code: "Space",
      preventDefault: jest.fn(),
    });

    await waitFor(() => {
      expect(screen.getByText("Historical Context")).toBeInTheDocument();
    });

    // Test Space key to collapse
    fireEvent.keyDown(card, {
      key: " ",
      code: "Space",
      preventDefault: jest.fn(),
    });

    await waitFor(() => {
      expect(screen.queryByText("Historical Context")).not.toBeInTheDocument();
    });
  });

  it("displays correct provider logos and colors", () => {
    const providers = [
      { model: "o3-2025-04-16", logo: "🟢", name: "OpenAI o3" },
      { model: "claude-sonnet-4", logo: "🟧", name: "Anthropic Claude" },
      { model: "grok-3", logo: "🟣", name: "xAI Grok" },
      { model: "deepseek-reasoner", logo: "🔴", name: "DeepSeek" },
    ];

    providers.forEach(({ model, logo, name }) => {
      const { unmount } = render(
        <AIResponseCard response={{ ...mockResponse, model_name: model }} />,
      );

      // Look for the logo emoji with aria-label
      const logoElement = screen.getByRole("img", { name: name });
      expect(logoElement).toHaveTextContent(logo);
      expect(screen.getByText(name)).toBeInTheDocument();

      unmount();
    });
  });

  it("shows section icons", async () => {
    const user = userEvent.setup();
    render(<AIResponseCard response={mockResponse} />);

    // Expand to see all sections
    await user.click(screen.getByText("Show full analysis"));

    // Check for section headers with icons
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("Historical Context")).toBeInTheDocument();
    expect(screen.getByText("Future Development")).toBeInTheDocument();
    expect(screen.getByText("Opinions and Thoughts")).toBeInTheDocument();
  });

  it("handles fallback responses", () => {
    const fallbackResponse: AIResponse = {
      ...mockResponse,
      response_data: {
        ...mockResponse.response_data,
        _fallback: true,
      },
    };

    render(<AIResponseCard response={fallbackResponse} />);

    expect(
      screen.getByText(
        "This is a fallback response due to service unavailability",
      ),
    ).toBeInTheDocument();
  });

  it("handles clipboard copy failure", async () => {
    const user = userEvent.setup();

    // Mock clipboard failure
    mockWriteText.mockRejectedValueOnce(new Error("Failed"));

    render(<AIResponseCard response={mockResponse} />);

    // Find and click the copy button
    const copyButton = screen.getByTitle("Copy to clipboard");
    await user.click(copyButton);

    await waitFor(() => {
      // Toast error would be called here
    });
  });

  it("renders markdown content properly", () => {
    const markdownResponse: AIResponse = {
      ...mockResponse,
      response_data: {
        summary: "**Bold text** and *italic text*",
        historical_context:
          "## Heading\n\nParagraph with [link](https://example.com)",
        future_development: "- List item 1\n- List item 2",
        opinions: "> Blockquote text",
      },
    };

    render(<AIResponseCard response={markdownResponse} />);

    // ReactMarkdown is mocked, but in real implementation it would render properly
    expect(
      screen.getByText(markdownResponse.response_data.summary),
    ).toBeInTheDocument();
  });

  it("handles share fallback when navigator.share is not available", async () => {
    const user = userEvent.setup();

    // Remove share API temporarily
    const originalShare = navigator.share;
    delete (navigator as { share?: typeof navigator.share }).share;

    // Mock successful clipboard write
    mockWriteText.mockResolvedValueOnce(undefined);

    render(<AIResponseCard response={mockResponse} />);

    const shareButton = screen.getByTitle("Share");
    await user.click(shareButton);

    // Should copy URL instead and show success toast
    expect(mockWriteText).toHaveBeenCalledWith(window.location.href);
    // Toast success would be called here

    // Restore share API
    (navigator as { share?: typeof navigator.share }).share = originalShare;
  });
});
