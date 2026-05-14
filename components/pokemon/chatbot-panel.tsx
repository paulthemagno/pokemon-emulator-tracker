'use client';

/**
 * Chatbot UI Component - Floating Bubble + Draggable Chat Window
 */

import { useState, useRef, useEffect } from 'react';
import { useConversation } from '@/hooks/use-conversation';
import { packGameContext } from '@/lib/chatbot/context-packer';
import type { SaveData } from '@/lib/pokemon/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, X, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatbotPanelProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  gameData?: SaveData | null;
}

type FloatingPosition = {
  x: number;
  y: number;
};

type FloatingSize = {
  width: number;
  height: number;
};

type DragTarget = 'bubble' | 'panel' | 'resize' | null;

const BUBBLE_SIZE = 56;
const SCREEN_MARGIN = 16;
const PANEL_DEFAULT_WIDTH = 600;
const PANEL_DEFAULT_HEIGHT = 700;
const PANEL_MIN_WIDTH = 360;
const PANEL_MIN_HEIGHT = 420;
const PANEL_MAX_WIDTH = 960;

function clampPanelSize(size: FloatingSize): FloatingSize {
  if (typeof window === 'undefined') {
    return size;
  }

  return {
    width: Math.min(
      Math.max(size.width, PANEL_MIN_WIDTH),
      Math.min(PANEL_MAX_WIDTH, window.innerWidth - SCREEN_MARGIN * 2)
    ),
    height: Math.min(
      Math.max(size.height, PANEL_MIN_HEIGHT),
      window.innerHeight - SCREEN_MARGIN * 2
    ),
  };
}

function getDefaultPanelSize(): FloatingSize {
  return clampPanelSize({
    width: PANEL_DEFAULT_WIDTH,
    height: Math.floor(typeof window === 'undefined' ? PANEL_DEFAULT_HEIGHT : window.innerHeight * 0.8),
  });
}

function clampBubblePosition(position: FloatingPosition): FloatingPosition {
  if (typeof window === 'undefined') {
    return position;
  }

  return {
    x: Math.min(
      Math.max(position.x, SCREEN_MARGIN),
      window.innerWidth - BUBBLE_SIZE - SCREEN_MARGIN
    ),
    y: Math.min(
      Math.max(position.y, SCREEN_MARGIN),
      window.innerHeight - BUBBLE_SIZE - SCREEN_MARGIN
    ),
  };
}

function clampPanelPosition(position: FloatingPosition, size: FloatingSize): FloatingPosition {
  if (typeof window === 'undefined') {
    return position;
  }

  return {
    x: Math.min(
      Math.max(position.x, SCREEN_MARGIN),
      window.innerWidth - size.width - SCREEN_MARGIN
    ),
    y: Math.min(
      Math.max(position.y, SCREEN_MARGIN),
      window.innerHeight - size.height - SCREEN_MARGIN
    ),
  };
}

function getDefaultBubblePosition(): FloatingPosition {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }

  return {
    x: window.innerWidth - BUBBLE_SIZE - SCREEN_MARGIN,
    y: window.innerHeight - BUBBLE_SIZE - SCREEN_MARGIN,
  };
}

function getDefaultPanelPosition(): FloatingPosition {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }

  const panelSize = getDefaultPanelSize();

  return {
    x: window.innerWidth - panelSize.width - SCREEN_MARGIN,
    y: Math.max(SCREEN_MARGIN, window.innerHeight - panelSize.height - 80),
  };
}

export function ChatbotPanel({ isOpen, onOpen, onClose, gameData }: ChatbotPanelProps) {
  const conversation = useConversation({ autoSave: true });
  const [inputValue, setInputValue] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [providerReady, setProviderReady] = useState(false);
  const [bubblePosition, setBubblePosition] = useState<FloatingPosition>({ x: 0, y: 0 });
  const [panelPosition, setPanelPosition] = useState<FloatingPosition>({ x: 0, y: 0 });
  const [panelSize, setPanelSize] = useState<FloatingSize>({
    width: PANEL_DEFAULT_WIDTH,
    height: PANEL_DEFAULT_HEIGHT,
  });
  const dragStateRef = useRef<{
    target: DragTarget;
    pointerId: number | null;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  }>({
    target: null,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    startWidth: PANEL_DEFAULT_WIDTH,
    startHeight: PANEL_DEFAULT_HEIGHT,
  });
  const dragMovedRef = useRef(false);
  const suppressBubbleClickRef = useRef(false);
  const isStreaming = conversation.isLoading || streamingMessage.length > 0;

  useEffect(() => {
    const defaultPanelSize = getDefaultPanelSize();
    const bubbleDefault = getDefaultBubblePosition();
    const panelDefault = getDefaultPanelPosition();

    setBubblePosition(clampBubblePosition(bubbleDefault));
    setPanelSize(defaultPanelSize);
    setPanelPosition(clampPanelPosition(panelDefault, defaultPanelSize));

    const handleResize = () => {
      setBubblePosition((current) => clampBubblePosition(current));
      setPanelSize((current) => {
        const nextSize = clampPanelSize(current);
        setPanelPosition((currentPosition) => clampPanelPosition(currentPosition, nextSize));
        return nextSize;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState.target || dragState.pointerId !== event.pointerId) {
        return;
      }

      if (dragState.target === 'resize') {
        const nextSize = clampPanelSize({
          width: dragState.startWidth + (event.clientX - dragState.startX),
          height: dragState.startHeight + (event.clientY - dragState.startY),
        });

        dragMovedRef.current = true;
        setPanelSize(nextSize);
        setPanelPosition((current) => clampPanelPosition(current, nextSize));
        return;
      }

      const nextPosition = {
        x: event.clientX - dragState.offsetX,
        y: event.clientY - dragState.offsetY,
      };

      dragMovedRef.current = true;

      if (dragState.target === 'bubble') {
        setBubblePosition(clampBubblePosition(nextPosition));
        return;
      }

      setPanelPosition(clampPanelPosition(nextPosition, panelSize));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragStateRef.current.pointerId !== event.pointerId) {
        return;
      }

      if (dragStateRef.current.target === 'bubble' && dragMovedRef.current) {
        suppressBubbleClickRef.current = true;
      }

      dragStateRef.current = {
        target: null,
        pointerId: null,
        offsetX: 0,
        offsetY: 0,
        startX: 0,
        startY: 0,
        startWidth: panelSize.width,
        startHeight: panelSize.height,
      };
      dragMovedRef.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [panelSize]);

  // Check provider status on mount
  useEffect(() => {
    const checkProvider = async () => {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '',
            history: [],
          }),
        });
        setProviderReady(response.status !== 503);
      } catch {
        setProviderReady(false);
      }
    };

    if (isOpen) {
      checkProvider();
    }
  }, [isOpen]);

  // Update game context when gameData changes
  useEffect(() => {
    const context = packGameContext(gameData ?? null);
    conversation.updateContext(context);
  }, [gameData, conversation.updateContext]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages, streamingMessage]);

  const handleCommand = async (cmd: string) => {
    const trimmed = cmd.trim();

    // /reset - clear conversation
    if (trimmed === '/reset') {
      await conversation.clearConversation();
      setStreamingMessage('');
      return true;
    }

    // /clear - same as reset
    if (trimmed === '/clear') {
      await conversation.clearConversation();
      setStreamingMessage('');
      return true;
    }

    // /help - show commands
    if (trimmed === '/help') {
      const helpText = `Available commands:
/reset or /clear - Clear conversation history
/help - Show this message
`;
      await conversation.addMessage('assistant', helpText);
      return true;
    }

    return false;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || conversation.isLoading || !providerReady) {
      return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');

    // Check for commands
    if (userMessage.startsWith('/')) {
      const isCommand = await handleCommand(userMessage);
      if (isCommand) return;
    }

    try {
      conversation.setIsLoading(true);
      conversation.setError(null);
      setStreamingMessage('');

      // Add user message
      await conversation.addMessage('user', userMessage);

      // Call chat API with streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: conversation.messages,
          gameContext: conversation.gameContext,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response from chatbot');
      }

      // Read streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream');

      const decoder = new TextDecoder();
      let fullMessage = '';
      let pending = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          try {
            const parsed = JSON.parse(line) as { chunk?: string; error?: string };
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.chunk) {
              fullMessage += parsed.chunk;
              setStreamingMessage(fullMessage);
            }
          } catch {
            // Ignore malformed lines from partial chunks
          }
        }
      }

      if (pending.trim()) {
        try {
          const parsed = JSON.parse(pending.trim()) as { chunk?: string; error?: string };
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.chunk) {
            fullMessage += parsed.chunk;
            setStreamingMessage(fullMessage);
          }
        } catch {
          // Ignore incomplete trailing JSON
        }
      }

      // Save complete message
      if (fullMessage) {
        await conversation.addMessage('assistant', fullMessage);
      }
      setStreamingMessage('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      conversation.setError(errorMessage);
      console.error('Chat error:', error);
    } finally {
      conversation.setIsLoading(false);
    }
  };

  const startDrag = (target: DragTarget, event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dragMovedRef.current = false;

    dragStateRef.current = {
      target,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panelSize.width,
      startHeight: panelSize.height,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const stopHeaderActionPointer = (event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const handleBubbleClick = () => {
    if (suppressBubbleClickRef.current) {
      suppressBubbleClickRef.current = false;
      return;
    }

    onOpen();
  };

  // Floating bubble when closed
  if (!isOpen) {
    return (
      <button
        onClick={handleBubbleClick}
        onPointerDown={(event) => startDrag('bubble', event)}
        style={{ left: bubblePosition.x, top: bubblePosition.y }}
        className={`fixed z-40 h-14 w-14 rounded-full bg-blue-500 text-white shadow-lg transition-all flex items-center justify-center hover:bg-blue-600 hover:shadow-xl touch-none ${
          isStreaming ? 'animate-pulse' : ''
        }`}
        title="Open Pokémon Assistant"
      >
        <MessageSquare className="h-6 w-6" />
        <span
          className={`absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-4 font-semibold text-white ${
            providerReady ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        >
          {providerReady ? 'on' : '!'}
        </span>
      </button>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <Card
        style={{
          left: panelPosition.x,
          top: panelPosition.y,
          width: panelSize.width,
          height: panelSize.height,
        }}
        className="pointer-events-auto fixed overflow-hidden flex flex-col bg-white dark:bg-slate-950 shadow-2xl"
      >
        {/* Header */}
        <div
          onPointerDown={(event) => startDrag('panel', event)}
          className="flex cursor-move items-center justify-between border-b px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg touch-none"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Pokémon Assistant</h2>
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                providerReady ? 'bg-emerald-500/90' : 'bg-amber-500/90'
              }`}
            >
              {providerReady ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onPointerDown={stopHeaderActionPointer}
              onClick={async () => {
                await conversation.clearConversation();
                setStreamingMessage('');
              }}
              className="text-white hover:bg-blue-700"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPointerDown={stopHeaderActionPointer}
              onClick={onClose}
              className="text-white hover:bg-blue-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Status */}
        {!providerReady && (
          <div className="border-b bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
            ⚠️ Ollama not connected. Start Ollama at http://127.0.0.1:11434
          </div>
        )}

        {/* Messages */}
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full px-4 py-4">
            <div className="space-y-4 pr-4">
            {conversation.messages.length === 0 && streamingMessage === '' && (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                <p className="mb-2 text-lg">👋 Hi! I'm your Pokemon assistant.</p>
                <p>Ask me anything about your game.</p>
                {conversation.gameContext && (
                  <p className="mt-4 text-xs text-gray-400">
                    👤 {conversation.gameContext.trainerName} • 📍{' '}
                    {conversation.gameContext.location}
                  </p>
                )}
                <p className="mt-6 text-xs text-gray-400">
                  💡 Commands: /reset, /clear, /help
                </p>
              </div>
            )}

            {conversation.messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs rounded-lg px-4 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                  }`}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-1">{children}</ol>,
                        code: ({ children }) => (
                          <code className="bg-black/20 px-1 rounded text-xs">{children}</code>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {streamingMessage && (
              <div className="flex justify-start">
                <div className="max-w-xs rounded-lg px-4 py-2 text-sm bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-1">{children}</ol>,
                        code: ({ children }) => (
                          <code className="bg-black/20 px-1 rounded text-xs">{children}</code>
                        ),
                      }}
                    >
                      {streamingMessage}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {conversation.isLoading && !streamingMessage && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Spinner className="h-4 w-4" />
                <span>Thinking...</span>
              </div>
            )}

            {conversation.error && (
              <div className="rounded bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                ❌ {conversation.error}
              </div>
            )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3 bg-gray-50 dark:bg-slate-900 rounded-b-lg">
          <div className="flex space-x-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message... (/help for commands)"
              disabled={conversation.isLoading || !providerReady}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={
                !inputValue.trim() || conversation.isLoading || !providerReady
              }
              className="bg-blue-500 hover:bg-blue-600"
            >
              Send
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Resize chat window"
          onPointerDown={(event) => startDrag('resize', event)}
          className="absolute bottom-0 right-0 h-5 w-5 cursor-se-resize touch-none bg-gradient-to-tl from-blue-500/35 to-transparent"
        >
          <span className="absolute bottom-1 right-1 block h-2 w-2 rounded-sm border-r-2 border-b-2 border-blue-600/80" />
        </button>
      </Card>
    </div>
  );
}
