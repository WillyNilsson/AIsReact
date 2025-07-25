"use client";

// WebSocket connection status component - commented out for simpler solution
// import { useEffect, useState } from 'react';
// import { websocket, ConnectionState } from '@/lib/websocket';
// import { cn } from '@/lib/utils';
// import { WifiOff, Wifi, AlertCircle, Loader2 } from 'lucide-react';

export function ConnectionStatus() {
  // Return null for now - WebSocket functionality disabled
  return null;

  /* Original implementation commented out:
  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    websocket.getConnectionState()
  );
  const [isVisible, setIsVisible] = useState(false);
  const [hideTimer, setHideTimer] = useState<NodeJS.Timeout | null>(null);
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);

  useEffect(() => {
    const unsubscribe = websocket.onConnectionStateChange((state) => {
      setConnectionState(state);

      // Track if we've connected at least once
      if (state.status === 'connected') {
        setHasConnectedOnce(true);
      }

      // Only show status changes after first connection or for errors/disconnections
      if (hasConnectedOnce || state.status === 'error' || state.status === 'disconnected') {
        setIsVisible(true);
      }

      // Clear any existing timer
      if (hideTimer) {
        clearTimeout(hideTimer);
        setHideTimer(null);
      }

      // If connected, hide after a delay
      if (state.status === 'connected' && hasConnectedOnce) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setHideTimer(null);
        }, 3000);
        setHideTimer(timer);
      }
    });

    return () => {
      unsubscribe();
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
    };
  }, [hideTimer, hasConnectedOnce]);

  if (!isVisible) return null;

  const statusConfig = {
    connecting: {
      icon: Loader2,
      message: 'Connecting...',
      className: 'bg-blue-900/80 border-blue-700 text-blue-200',
      iconClassName: 'animate-spin'
    },
    connected: {
      icon: Wifi,
      message: 'Connected',
      className: 'bg-green-900/80 border-green-700 text-green-200',
      iconClassName: ''
    },
    disconnected: {
      icon: WifiOff,
      message: 'Disconnected',
      className: 'bg-yellow-900/80 border-yellow-700 text-yellow-200',
      iconClassName: ''
    },
    reconnecting: {
      icon: Loader2,
      message: `Reconnecting... (Attempt ${connectionState.reconnectAttempts}/10)`,
      className: 'bg-orange-900/80 border-orange-700 text-orange-200',
      iconClassName: 'animate-spin'
    },
    error: {
      icon: AlertCircle,
      message: connectionState.lastError || 'Connection error',
      className: 'bg-red-900/80 border-red-700 text-red-200',
      iconClassName: ''
    }
  };

  const config = statusConfig[connectionState.status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg border shadow-lg transition-all duration-300',
        config.className
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon
        className={cn('h-4 w-4', config.iconClassName)}
      />
      <span className="text-sm font-medium">
        {config.message}
      </span>
      {connectionState.nextReconnectTime && connectionState.status === 'reconnecting' && (
        <span className="text-xs opacity-75">
          ({Math.ceil((connectionState.nextReconnectTime - Date.now()) / 1000)}s)
        </span>
      )}
    </div>
  );
  */
}
