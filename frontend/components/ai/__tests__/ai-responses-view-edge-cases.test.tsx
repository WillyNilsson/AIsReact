import { render, screen } from "@testing-library/react";
import { AIResponsesView } from "../ai-responses-view";
import { AIResponse } from "@/lib/types";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "123" }),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock Link component
jest.mock("next/link", () => {
  const MockLink = ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>;
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("AIResponsesView Edge Cases", () => {
  // Test with null responses
  it("handles null responses prop gracefully", () => {
    render(<AIResponsesView responses={null as any} />);

    expect(
      screen.getByText("No AI analyses available yet."),
    ).toBeInTheDocument();
  });

  // Test with undefined responses
  it("handles undefined responses prop gracefully", () => {
    render(<AIResponsesView responses={undefined as any} />);

    expect(
      screen.getByText("No AI analyses available yet."),
    ).toBeInTheDocument();
  });

  // Test with empty array
  it("handles empty responses array", () => {
    render(<AIResponsesView responses={[]} />);

    expect(
      screen.getByText("No AI analyses available yet."),
    ).toBeInTheDocument();
  });

  // Test with responses containing null/undefined items
  it("filters out null and undefined responses", () => {
    const responses: (AIResponse | null | undefined)[] = [
      null,
      undefined,
      {
        id: 1,
        post_id: 1,
        model_name: "gpt-4",
        response_data: { summary: "Test" },
        is_successful: true,
        response_time_ms: 100,
        token_count: 50,
        created_at: new Date().toISOString(),
        error_message: null,
      },
      null,
      {
        id: 2,
        post_id: 1,
        model_name: "claude-3",
        response_data: { summary: "Test 2" },
        is_successful: true,
        response_time_ms: 200,
        token_count: 75,
        created_at: new Date().toISOString(),
        error_message: null,
      },
    ] as (AIResponse | null | undefined)[];

    render(<AIResponsesView responses={responses as any} />);

    // Should only render valid responses
    expect(screen.getByText("AI Analyses")).toBeInTheDocument();
    expect(screen.getByText("2 successful")).toBeInTheDocument();
  });

  // Test with responses missing required fields
  it("handles responses missing id field", () => {
    const responses: AIResponse[] = [
      {
        id: null as unknown as number, // Missing ID
        post_id: 1,
        model_name: "gpt-4",
        response_data: { summary: "Test" },
        is_successful: true,
        response_time_ms: 100,
        token_count: 50,
        created_at: new Date().toISOString(),
        error_message: null,
      },
      {
        id: 2,
        post_id: 1,
        model_name: "claude-3",
        response_data: { summary: "Test 2" },
        is_successful: true,
        response_time_ms: 200,
        token_count: 75,
        created_at: new Date().toISOString(),
        error_message: null,
      },
    ];

    render(<AIResponsesView responses={responses} />);

    // Both are counted as successful (is_successful flag), but only one is rendered (has valid ID)
    expect(screen.getByText("2 successful")).toBeInTheDocument();
    // Should only render one card (the one with valid ID)
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(1);
  });

  // Test loading state
  it("displays loading state correctly", () => {
    render(<AIResponsesView responses={[]} isLoading={true} />);

    expect(screen.getByText("Analyzing with AI models...")).toBeInTheDocument();
  });

  // Test comparison tabs with missing data
  it("handles missing data in comparison tabs", () => {
    const responses: AIResponse[] = [
      {
        id: 1,
        post_id: 1,
        model_name: "gpt-4",
        response_data: {
          summary: "Summary 1",
          // Missing other fields
        },
        is_successful: true,
        response_time_ms: 100,
        token_count: 50,
        created_at: new Date().toISOString(),
        error_message: null,
      },
      {
        id: 2,
        post_id: 1,
        model_name: "claude-3",
        response_data: null, // Null response data
        is_successful: false,
        response_time_ms: 200,
        token_count: 75,
        created_at: new Date().toISOString(),
        error_message: "Failed to get response",
      },
    ];

    render(<AIResponsesView responses={responses} />);

    // The second response with null response_data and is_successful: false should show as failed
    expect(screen.getByText("1 successful")).toBeInTheDocument();
    expect(screen.getByText("• 1 failed")).toBeInTheDocument();

    // With only 1 successful response, comparison tabs should not be shown
    expect(screen.queryByText("Comparative Analysis")).not.toBeInTheDocument();
  });

  // Test with mixed successful and failed responses
  it("correctly counts successful and failed responses", () => {
    const responses: AIResponse[] = [
      {
        id: 1,
        post_id: 1,
        model_name: "gpt-4",
        response_data: { summary: "Test" },
        is_successful: true,
        response_time_ms: 100,
        token_count: 50,
        created_at: new Date().toISOString(),
        error_message: null,
      },
      {
        id: 2,
        post_id: 1,
        model_name: "claude-3",
        response_data: null,
        is_successful: false,
        response_time_ms: null,
        token_count: null,
        created_at: new Date().toISOString(),
        error_message: "API Error",
      },
      {
        id: 3,
        post_id: 1,
        model_name: "gemini-pro",
        response_data: { summary: "Test 2" },
        is_successful: true,
        response_time_ms: 150,
        token_count: 60,
        created_at: new Date().toISOString(),
        error_message: null,
      },
    ];

    render(<AIResponsesView responses={responses} />);

    expect(screen.getByText("2 successful")).toBeInTheDocument();
    expect(screen.getByText("• 1 failed")).toBeInTheDocument();
  });

  // Test without postId
  it("handles missing postId gracefully", () => {
    const responses: AIResponse[] = [
      {
        id: 1,
        post_id: 1,
        model_name: "gpt-4",
        response_data: { summary: "Test" },
        is_successful: true,
        response_time_ms: 100,
        token_count: 50,
        created_at: new Date().toISOString(),
        error_message: null,
      },
    ];

    render(<AIResponsesView responses={responses} postId={undefined} />);

    // Should render without progress component
    expect(screen.getByText("AI Analyses")).toBeInTheDocument();
    expect(screen.queryByText("AI Analysis Progress")).not.toBeInTheDocument();
  });

  // Test case for o3 model with null response_data (issue from post 30)
  it("handles o3 model with null response_data gracefully", () => {
    const responses: AIResponse[] = [
      {
        id: 1,
        post_id: 30,
        model_name: "gpt-4",
        response_data: {
          summary: "GPT-4 Summary",
          historical_context: "Historical context",
          future_development: "Future development",
          opinions: "Opinions",
        },
        is_successful: true,
        response_time_ms: 100,
        token_count: 50,
        created_at: new Date().toISOString(),
        error_message: undefined,
      },
      {
        id: 2,
        post_id: 30,
        model_name: "o3-mini",
        response_data: null, // o3 didn't finish analysis
        is_successful: false,
        response_time_ms: undefined,
        token_count: undefined,
        created_at: new Date().toISOString(),
        error_message: "Analysis incomplete",
      },
      {
        id: 3,
        post_id: 30,
        model_name: "claude-3-5-sonnet-20241022",
        response_data: {
          summary: "Claude Summary",
          historical_context: "Claude Historical",
          future_development: "Claude Future",
          opinions: "Claude Opinions",
        },
        is_successful: true,
        response_time_ms: 150,
        token_count: 60,
        created_at: new Date().toISOString(),
        error_message: undefined,
      },
    ];

    // Should render without throwing errors
    render(<AIResponsesView responses={responses} postId={30} />);

    // Should show 2 successful (excluding o3 with null response_data)
    expect(screen.getByText("2 successful")).toBeInTheDocument();
    expect(screen.getByText("• 1 failed")).toBeInTheDocument();

    // Should render 3 cards total (2 successful + 1 failed error card)
    // Failed card shows the error message
    const errorCard = screen.getByText("Analysis failed: Analysis incomplete");
    expect(errorCard).toBeInTheDocument();

    // Successful cards should be rendered (summaries appear both in cards and comparison)
    const gptSummaries = screen.getAllByText("GPT-4 Summary");
    const claudeSummaries = screen.getAllByText("Claude Summary");
    expect(gptSummaries.length).toBeGreaterThan(0);
    expect(claudeSummaries.length).toBeGreaterThan(0);

    // Comparative analysis should be shown with 2 successful responses
    const comparativeSection = screen.getByText("Comparative Analysis");
    expect(comparativeSection).toBeInTheDocument();

    // Click on summary tab and verify it handles responses correctly
    const summaryTab = screen.getByRole("tab", { name: /Summary/i });
    summaryTab.click();

    // Verify both summaries are shown in the comparison section
    const summaryContent = screen.getByText("Summaries");
    expect(summaryContent).toBeInTheDocument();
  });
});
