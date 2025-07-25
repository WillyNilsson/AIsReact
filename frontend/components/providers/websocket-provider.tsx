"use client";

// WebSocket provider - commented out for simpler solution
// import { useWebSocketConnection } from '@/lib/hooks/useWebSocket';
// import { ConnectionStatus } from '@/components/ui/connection-status';

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  // WebSocket functionality disabled - just return children
  return <>{children}</>;

  /* Original implementation:
  // Establish WebSocket connection
  useWebSocketConnection();

  return (
    <>
      {children}
      <ConnectionStatus />
    </>
  );
  */
}
