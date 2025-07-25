const dynamic = (loader) => {
  const Component = loader().then((mod) => mod.default || mod);
  Component.displayName = "dynamic";
  return Component;
};

export default dynamic;
