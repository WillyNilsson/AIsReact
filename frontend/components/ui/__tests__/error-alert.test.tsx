/**
 * Tests for Error Alert Component
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorAlert } from "../error-alert";

describe("ErrorAlert", () => {
  it("should render error message", () => {
    render(<ErrorAlert error="Something went wrong" />);
    expect(
      screen.getByText(
        "An unexpected error occurred. Please try again or contact support if the problem persists.",
      ),
    ).toBeInTheDocument();
  });

  it("should render specific network error message", () => {
    render(<ErrorAlert error="network error" />);
    expect(
      screen.getByText(
        "Unable to connect to the server. Please check your internet connection and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("should show recovery suggestions", () => {
    render(<ErrorAlert error="network error" />);
    expect(screen.getByText("Try these steps:")).toBeInTheDocument();
    expect(
      screen.getByText("Check your internet connection"),
    ).toBeInTheDocument();
    expect(screen.getByText("Try refreshing the page")).toBeInTheDocument();
  });

  it("should show retry button for retryable errors", () => {
    const onRetry = jest.fn();
    render(<ErrorAlert error="network error" onRetry={onRetry} />);

    const retryButton = screen.getByText("Try Again");
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should not show retry button for non-retryable errors", () => {
    const onRetry = jest.fn();
    render(<ErrorAlert error="rate limit exceeded" onRetry={onRetry} />);

    expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
  });

  it("should show dismiss button when onDismiss provided", () => {
    const onDismiss = jest.fn();
    render(<ErrorAlert error="test error" onDismiss={onDismiss} />);

    const dismissButton = screen.getByLabelText("Dismiss error");
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("should not show dismiss button when onDismiss not provided", () => {
    render(<ErrorAlert error="test error" />);
    expect(screen.queryByLabelText("Dismiss error")).not.toBeInTheDocument();
  });

  it("should use context for specific error messages", () => {
    render(
      <ErrorAlert error="permission denied" context={{ action: "verify" }} />,
    );
    expect(
      screen.getByText(
        "You do not have permission to verify posts. Only verified users can participate in verification.",
      ),
    ).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <ErrorAlert error="test" className="custom-class" />,
    );
    const alert = container.querySelector(".custom-class");
    expect(alert).toBeInTheDocument();
  });

  it("should handle Error objects", () => {
    const error = new Error("network error");
    render(<ErrorAlert error={error} />);
    expect(
      screen.getByText(
        "Unable to connect to the server. Please check your internet connection and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("should not show suggestions for errors without suggestions", () => {
    render(<ErrorAlert error="unknown error xyz" />);
    expect(screen.queryByText("Try these steps:")).not.toBeInTheDocument();
  });

  it("should show alert icon", () => {
    const { container } = render(<ErrorAlert error="test error" />);
    const icon = container.querySelector("svg.lucide-circle-alert");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("h-5 w-5");
  });
});
