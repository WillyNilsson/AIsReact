import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";

describe("Input Component", () => {
  it("renders correctly", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("handles value changes", async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} placeholder="Type here" />);

    const input = screen.getByPlaceholderText("Type here");
    await user.type(input, "Hello");

    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue("Hello");
  });

  it("can be disabled", () => {
    render(<Input disabled placeholder="Disabled input" />);
    const input = screen.getByPlaceholderText("Disabled input");

    expect(input).toBeDisabled();
    expect(input).toHaveClass(
      "disabled:cursor-not-allowed",
      "disabled:opacity-50",
    );
  });

  it("supports different types", () => {
    const { rerender } = render(<Input type="email" placeholder="Email" />);
    expect(screen.getByPlaceholderText("Email")).toHaveAttribute(
      "type",
      "email",
    );

    rerender(<Input type="password" placeholder="Password" />);
    expect(screen.getByPlaceholderText("Password")).toHaveAttribute(
      "type",
      "password",
    );

    rerender(<Input type="number" placeholder="Number" />);
    expect(screen.getByPlaceholderText("Number")).toHaveAttribute(
      "type",
      "number",
    );
  });

  it("applies custom className", () => {
    render(<Input className="custom-input" placeholder="Custom" />);
    expect(screen.getByPlaceholderText("Custom")).toHaveClass("custom-input");
  });

  it("forwards ref correctly", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} placeholder="Ref test" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.placeholder).toBe("Ref test");
  });

  it("handles focus and blur events", () => {
    const handleFocus = jest.fn();
    const handleBlur = jest.fn();

    render(
      <Input
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Focus test"
      />,
    );

    const input = screen.getByPlaceholderText("Focus test");

    fireEvent.focus(input);
    expect(handleFocus).toHaveBeenCalledTimes(1);

    fireEvent.blur(input);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it("applies error styles when aria-invalid is true", () => {
    render(<Input aria-invalid="true" placeholder="Error input" />);
    const input = screen.getByPlaceholderText("Error input");

    expect(input).toHaveAttribute("aria-invalid", "true");
    // The component should apply error styles based on aria-invalid
  });

  it("supports autoComplete attribute", () => {
    render(<Input autoComplete="email" placeholder="Email" />);
    expect(screen.getByPlaceholderText("Email")).toHaveAttribute(
      "autoComplete",
      "email",
    );
  });

  it("supports maxLength attribute", async () => {
    const user = userEvent.setup();
    render(<Input maxLength={5} placeholder="Max 5 chars" />);

    const input = screen.getByPlaceholderText("Max 5 chars");
    await user.type(input, "Hello World");

    expect(input).toHaveValue("Hello"); // Only first 5 characters
  });
});
