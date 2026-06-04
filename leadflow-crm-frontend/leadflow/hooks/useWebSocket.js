import { useEffect, useState, useRef } from 'react';

export default function useWebSocket() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    let ws = null;

    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Adjust WS URL based on environment
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = process.env.NEXT_PUBLIC_API_URL 
        ? new URL(process.env.NEXT_PUBLIC_API_URL).host 
        : 'localhost:8000';
      
      const wsUrl = `${protocol}//${host}/ws/notifications/?token=${token}`;
      
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket Connected');
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          
          // Dispatch global custom event
          const customEvent = new CustomEvent('ws_message', { detail: data });
          window.dispatchEvent(customEvent);
        } catch (e) {
          console.error('WebSocket parsing error:', e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket Disconnected. Reconnecting...');
        setIsConnected(false);
        // Attempt to reconnect every 5 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.close();
      };

      setSocket(ws);
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return { socket, isConnected, lastMessage };
}
