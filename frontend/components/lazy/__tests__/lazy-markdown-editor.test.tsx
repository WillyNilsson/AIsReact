import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { LazyMarkdownEditor } from "../lazy-markdown-editor";

// Mock the dynamic import
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (
    fn: () => Promise<{ default: React.ComponentType }>,
    options: { loading?: React.ComponentType },
  ) => {
    // Return a component that renders the loading state initially
    const Component = (props: Record<string, unknown>) => {
      const [isLoading, setIsLoading] = React.useState(true);

      React.useEffect(() => {
        // Simulate async loading
        const timer = setTimeout(() => setIsLoading(false), 100);
        return () => clearTimeout(timer);
      }, []);

      if (isLoading && options.loading) {
        const LoadingComponent = options.loading;
        return <LoadingComponent />;
      }

      // Render a mock editor
      return (
        <div data-testid="markdown-editor" {...props}>
          Mock Markdown Editor
        </div>
      );
    };

    return Component;
  },
}));

describe("LazyMarkdownEditor", () => {
  it("should show loading state initially", () => {
    render(<LazyMarkdownEditor />);

    // Should show skeleton loaders
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons).toHaveLength(2);
  });

  it("should render the editor after loading", async () => {
    render(<LazyMarkdownEditor value="Test content" />);

    // Wait for the editor to load
    await waitFor(() => {
      expect(screen.getByTestId("markdown-editor")).toBeInTheDocument();
    });

    expect(screen.getByText("Mock Markdown Editor")).toBeInTheDocument();
  });

  it("should pass props to the loaded editor", async () => {
    const onChange = jest.fn();
    render(
      <LazyMarkdownEditor
        value="Test content"
        onChange={onChange}
        placeholder="Enter text..."
        className="custom-class"
      />,
    );

    await waitFor(() => {
      const editor = screen.getByTestId("markdown-editor");
      expect(editor).toHaveAttribute("value", "Test content");
      expect(editor).toHaveAttribute("placeholder", "Enter text...");
      expect(editor).toHaveAttribute("class", "custom-class");
    });
  });
});
