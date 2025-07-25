declare global {
  var websocketEventHandlers: Record<string, Function> | undefined;
}

export {};
