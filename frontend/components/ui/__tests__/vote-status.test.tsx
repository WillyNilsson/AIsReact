import React from "react";
import { render, screen } from "@testing-library/react";
import { VoteStatus } from "../vote-status";

describe("VoteStatus", () => {
  it("should render nothing when userVote is null", () => {
    const { container } = render(<VoteStatus userVote={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render accurate vote indicator with text", () => {
    render(<VoteStatus userVote={true} />);

    expect(screen.getByText("Voted Accurate")).toBeInTheDocument();
    // Check for CheckCircle2 icon by its parent container
    const container = screen.getByText("Voted Accurate").parentElement;
    expect(container).toHaveClass("bg-green-100", "text-green-700");
  });

  it("should render inaccurate vote indicator with text", () => {
    render(<VoteStatus userVote={false} />);

    expect(screen.getByText("Voted Inaccurate")).toBeInTheDocument();
    // Check for XCircle icon by its parent container
    const container = screen.getByText("Voted Inaccurate").parentElement;
    expect(container).toHaveClass("bg-red-100", "text-red-700");
  });

  it("should hide text when showText is false", () => {
    const { container } = render(
      <VoteStatus userVote={true} showText={false} />,
    );

    expect(screen.queryByText("Voted Accurate")).not.toBeInTheDocument();
    // But the container should still exist
    const voteStatus = container.firstChild as HTMLElement;
    expect(voteStatus).toHaveClass("bg-green-100");
  });

  it("should apply custom className", () => {
    render(<VoteStatus userVote={true} className="custom-class" />);

    const container = screen.getByText("Voted Accurate").parentElement;
    expect(container).toHaveClass("custom-class");
  });

  it("should render correct styles for accurate vote", () => {
    render(<VoteStatus userVote={true} />);

    const container = screen.getByText("Voted Accurate").parentElement;
    expect(container).toHaveClass(
      "flex",
      "items-center",
      "gap-1.5",
      "px-3",
      "py-1.5",
      "rounded-full",
      "text-sm",
      "font-medium",
      "bg-green-100",
      "text-green-700",
      "border",
      "border-green-200",
    );
  });

  it("should render correct styles for inaccurate vote", () => {
    render(<VoteStatus userVote={false} />);

    const container = screen.getByText("Voted Inaccurate").parentElement;
    expect(container).toHaveClass(
      "flex",
      "items-center",
      "gap-1.5",
      "px-3",
      "py-1.5",
      "rounded-full",
      "text-sm",
      "font-medium",
      "bg-red-100",
      "text-red-700",
      "border",
      "border-red-200",
    );
  });
});
