export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="absolute top-0 left-0 p-4 bg-brand-primary text-white rounded-br-lg focus:z-50"
      >
        Skip to main content
      </a>
      <a
        href="#main-navigation"
        className="absolute top-0 left-32 p-4 bg-brand-primary text-white rounded-br-lg focus:z-50"
      >
        Skip to navigation
      </a>
    </div>
  );
}
