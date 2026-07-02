'use client';

/**
 * Chatbot UI Component - Floating Bubble + Draggable Chat Window
 */

import { useState, useRef, useEffect, type ClipboardEvent } from 'react';
import { useConversation } from '@/hooks/use-conversation';
import { packGameContext } from '@/lib/chatbot/context-packer';
import type { SaveData } from '@/lib/pokemon/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Eye,
  EyeOff,
  Brain,
  ExternalLink,
  ImagePlus,
  MessageSquare,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type {
  ChatImageAttachment,
  ChatProviderInfo,
  ChatRuntimeConfig,
  ChatSource,
} from '@/lib/chatbot/types';

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

function getImageExtension(mediaType: ChatImageAttachment['mediaType']): string {
  if (mediaType === 'image/jpeg') return 'jpg';
  if (mediaType === 'image/webp') return 'webp';
  return 'png';
}

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

function safeDecodeUrlText(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function humanizeUrlText(value: string): string {
  return safeDecodeUrlText(value).replace(/_/g, ' ').replace(/\\/g, '').trim();
}

function getSourceDisplay(source: ChatSource, index: number) {
  if (!source.url) {
    return {
      label: `${index + 1}. ${source.displayName ?? source.name}`,
      siteName: source.siteName ?? source.name,
      logoUrl: source.logoUrl,
      fallbackIcon: source.icon ?? '↗',
    };
  }

  let url: URL;
  try {
    url = new URL(source.url);
  } catch {
    return {
      label: `${index + 1}. ${source.displayName ?? source.name}`,
      siteName: source.siteName ?? source.name,
      logoUrl: source.logoUrl,
      fallbackIcon: source.icon ?? '↗',
    };
  }

  const host = url.hostname.replace(/^www\./, '');
  let label = source.displayName;
  let siteName = source.siteName ?? host;

  if (!label && host === 'github.com' && url.pathname.startsWith('/pret/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const repo = parts[1] ?? 'pret';
    const fileName = parts[4] ? parts.slice(4).join('/').split('/').pop() : repo;
    label = `PRET ${repo}: ${fileName}`;
    siteName = 'PRET';
  }

  if (!label && host === 'bulbapedia.bulbagarden.net') {
    const section = url.hash ? humanizeUrlText(url.hash.slice(1)) : '';
    const walkthroughMatch = source.url.match(/Walkthrough%3A([^/]+)\/Part_(\d+)/);
    if (walkthroughMatch) {
      const game = humanizeUrlText(walkthroughMatch[1]);
      label = `Bulbapedia walkthrough: ${game} Part ${walkthroughMatch[2]}${
        section ? ` - ${section}` : ''
      }`;
    } else {
      const title = url.searchParams.get('title');
      label = `Bulbapedia: ${title ? humanizeUrlText(title) : section || 'article'}`;
    }
    siteName = 'Bulbapedia';
  }

  if (!label) {
    const lastPath = humanizeUrlText(url.pathname.split('/').filter(Boolean).pop() ?? host);
    label = `${siteName}: ${lastPath}`;
  }

  return {
    label: `${index + 1}. ${label}`,
    siteName,
    logoUrl: source.logoUrl ?? `${url.origin}/favicon.ico`,
    fallbackIcon: source.icon ?? siteName.slice(0, 2).toUpperCase(),
  };
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
  const [streamingThinking, setStreamingThinking] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [providerReady, setProviderReady] = useState(false);
  const [providerInfo, setProviderInfo] = useState<ChatProviderInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<ChatRuntimeConfig>({
    provider: undefined,
    endpoint: '',
    modelName: '',
    apiKey: '',
  });
  const [imageAttachment, setImageAttachment] = useState<ChatImageAttachment | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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
  const isStreaming =
    conversation.isLoading ||
    streamingMessage.length > 0 ||
    streamingThinking.length > 0;

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
        const response = await fetch('/api/chat');
        const info = (await response.json()) as ChatProviderInfo;
        setProviderInfo(info);
        setProviderReady(response.ok && info.ready);
      } catch {
        setProviderReady(false);
      }
    };

    if (isOpen) {
      checkProvider();
    }
  }, [isOpen]);

  const handleImageSelection = async (file?: File) => {
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      conversation.setError('Use a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      conversation.setError('Images must be 5 MB or smaller.');
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read image.'));
      reader.readAsDataURL(file);
    });

    const mediaType = file.type as ChatImageAttachment['mediaType'];
    setImageAttachment({
      kind: 'image',
      name: file.name || `pasted-image.${getImageExtension(mediaType)}`,
      mediaType,
      data: dataUrl.slice(dataUrl.indexOf(',') + 1),
    });
    conversation.setError(null);
  };

  const handleInputPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const imageFile =
      Array.from(event.clipboardData.items)
        .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
        ?.getAsFile() ||
      Array.from(event.clipboardData.files).find((file) =>
        file.type.startsWith('image/')
      );

    if (!imageFile) {
      return;
    }

    event.preventDefault();
    void handleImageSelection(imageFile);
  };

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
      setStreamingThinking('');
      return true;
    }

    // /clear - same as reset
    if (trimmed === '/clear') {
      await conversation.clearConversation();
      setStreamingMessage('');
      setStreamingThinking('');
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
    if ((!inputValue.trim() && !imageAttachment) || conversation.isLoading) {
      return;
    }

    const userMessage = inputValue.trim() || 'Describe this image in the context of my current game.';
    const pendingAttachment = imageAttachment;
    setInputValue('');
    setImageAttachment(null);

    // Check for commands
    if (userMessage.startsWith('/')) {
      const isCommand = await handleCommand(userMessage);
      if (isCommand) return;
    }

    try {
      conversation.setIsLoading(true);
      conversation.setError(null);
      setStreamingMessage('');
      setStreamingThinking('');

      // Add user message
      await conversation.addMessage(
        'user',
        userMessage,
        pendingAttachment ? { attachments: [pendingAttachment] } : {}
      );

      // Call chat API with streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: conversation.messages,
          gameContext: conversation.gameContext,
          stream: true,
          attachments: pendingAttachment ? [pendingAttachment] : [],
          runtimeConfig: {
            provider: runtimeConfig.provider,
            endpoint:
              runtimeConfig.provider === 'openrouter' || runtimeConfig.provider === 'ai-sdk'
                ? undefined
                : runtimeConfig.endpoint?.trim() || undefined,
            modelName: runtimeConfig.modelName?.trim() || undefined,
            apiKey: runtimeConfig.apiKey?.trim() || undefined,
            thinking: runtimeConfig.thinking,
          },
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
      let fullThinking = '';
      let knowledgeContext = '';
      let sources: ChatSource[] = [];
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
          let parsed: {
            chunk?: string;
            thinking?: string;
            error?: string;
            meta?: ChatProviderInfo;
            knowledgeContext?: string;
            sources?: ChatSource[];
          };
          try {
            parsed = JSON.parse(line);
          } catch {
            // Ignore malformed lines from partial chunks
            continue;
          }
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.meta) {
            setProviderInfo(parsed.meta);
            setProviderReady(parsed.meta.ready);
          }
          if (parsed.chunk) {
            fullMessage += parsed.chunk;
            setStreamingMessage(fullMessage);
          }
          if (parsed.thinking) {
            fullThinking += parsed.thinking;
            setStreamingThinking(fullThinking);
          }
          if (parsed.knowledgeContext) {
            knowledgeContext = parsed.knowledgeContext;
          }
          if (parsed.sources) {
            sources = parsed.sources;
          }
        }
      }

      if (pending.trim()) {
        let parsed: {
          chunk?: string;
          thinking?: string;
          error?: string;
          meta?: ChatProviderInfo;
          knowledgeContext?: string;
          sources?: ChatSource[];
        } | null = null;
        try {
          parsed = JSON.parse(pending.trim());
        } catch {
          // Ignore incomplete trailing JSON
        }
        if (parsed?.error) {
          throw new Error(parsed.error);
        }
        if (parsed?.meta) {
          setProviderInfo(parsed.meta);
          setProviderReady(parsed.meta.ready);
        }
        if (parsed?.chunk) {
          fullMessage += parsed.chunk;
          setStreamingMessage(fullMessage);
        }
        if (parsed?.thinking) {
          fullThinking += parsed.thinking;
          setStreamingThinking(fullThinking);
        }
        if (parsed?.knowledgeContext) {
          knowledgeContext = parsed.knowledgeContext;
        }
        if (parsed?.sources) {
          sources = parsed.sources;
        }
      }

      // Save complete message
      if (fullMessage || fullThinking) {
        await conversation.addMessage(
          'assistant',
          fullMessage || 'No final response was returned.',
          {
            ...(fullThinking ? { thinking: fullThinking } : {}),
            ...(knowledgeContext ? { knowledgeContext } : {}),
            ...(sources.length > 0 ? { sources } : {}),
          }
        );
      }
      setStreamingMessage('');
      setStreamingThinking('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      conversation.setError(errorMessage);
      setStreamingMessage('');
      setStreamingThinking('');
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
            <span className="max-w-48 truncate text-xs text-blue-100">
              {providerInfo
                ? `${providerInfo.provider}: ${providerInfo.modelName}`
                : runtimeConfig.modelName || 'model unknown'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onPointerDown={stopHeaderActionPointer}
              onClick={() => setShowSettings((current) => !current)}
              className="text-white hover:bg-blue-700"
              title="Model settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPointerDown={stopHeaderActionPointer}
              onClick={async () => {
                await conversation.clearConversation();
                setStreamingMessage('');
                setStreamingThinking('');
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
            Chat provider is not connected. Start local Ollama, configure OpenRouter, or select AI SDK / BYOK and enter a provider/model plus matching API key.
          </div>
        )}

        {showSettings && (
          <div className="space-y-3 border-b bg-slate-50 px-4 py-3 text-xs dark:bg-slate-900">
            <div>
              <label className="mb-1 block font-medium" htmlFor="chat-provider">
                Provider override
              </label>
              <select
                id="chat-provider"
                value={runtimeConfig.provider || ''}
                onChange={(event) =>
                  setRuntimeConfig((current) => ({
                    ...current,
                    provider:
                      event.target.value === 'ollama' ||
                      event.target.value === 'openrouter' ||
                      event.target.value === 'ai-sdk'
                        ? event.target.value
                        : undefined,
                  }))
                }
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Server default</option>
                <option value="ollama">Ollama</option>
                <option value="openrouter">OpenRouter</option>
                <option value="ai-sdk">AI SDK / BYOK</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium" htmlFor="chat-model">
                Model override
              </label>
              <Input
                id="chat-model"
                value={runtimeConfig.modelName}
                onChange={(event) =>
                  setRuntimeConfig((current) => ({
                    ...current,
                    modelName: event.target.value,
                  }))
                }
                placeholder={
                  providerInfo?.modelName ||
                  (runtimeConfig.provider === 'openrouter'
                    ? 'Uses OPENROUTER_MODEL'
                    : runtimeConfig.provider === 'ai-sdk'
                      ? 'anthropic/claude-sonnet-4-5'
                      : 'Uses OLLAMA_MODEL')
                }
                className="h-8"
              />
              {runtimeConfig.provider === 'ai-sdk' && (
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  Use provider/model, for example anthropic/claude-sonnet-4-5, openai/gpt-4.1, or google/gemini-2.5-flash.
                </p>
              )}
            </div>
            {runtimeConfig.provider !== 'openrouter' && runtimeConfig.provider !== 'ai-sdk' && (
              <div>
                <label className="mb-1 block font-medium" htmlFor="chat-endpoint">
                  Ollama endpoint override
                </label>
                <Input
                  id="chat-endpoint"
                  value={runtimeConfig.endpoint}
                  onChange={(event) =>
                    setRuntimeConfig((current) => ({
                      ...current,
                      endpoint: event.target.value,
                    }))
                  }
                  placeholder={providerInfo?.endpoint || 'Uses OLLAMA_ENDPOINT'}
                  className="h-8"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block font-medium" htmlFor="chat-api-key">
                API key override
              </label>
              <div className="flex gap-2">
                <Input
                  id="chat-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={runtimeConfig.apiKey}
                  onChange={(event) =>
                    setRuntimeConfig((current) => ({
                      ...current,
                      apiKey: event.target.value,
                    }))
                  }
                  placeholder={
                    providerInfo?.credentialSource === 'environment'
                      ? 'Environment secret is configured'
                      : runtimeConfig.provider === 'openrouter'
                        ? 'Optional OpenRouter API key'
                        : runtimeConfig.provider === 'ai-sdk'
                          ? 'Provider API key matching provider/model'
                          : 'Optional Bearer token'
                  }
                  autoComplete="off"
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKey((current) => !current)}
                  className="h-8 px-2"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded border bg-white px-3 py-2 dark:bg-slate-950">
              <span>
                <span className="block font-medium">Enable model thinking</span>
                <span className="text-slate-500 dark:text-slate-400">
                  Uses the server default until changed. Off sends think: false to Ollama and reasoning: none to AI SDK.
                </span>
              </span>
              <input
                type="checkbox"
                checked={runtimeConfig.thinking ?? true}
                disabled={runtimeConfig.provider === 'openrouter'}
                onChange={(event) =>
                  setRuntimeConfig((current) => ({
                    ...current,
                    thinking: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-blue-600"
              />
            </label>
            <p className="text-slate-500 dark:text-slate-400">
              Blank fields use server environment secrets. Overrides stay in this page state and are sent only with chat requests.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full px-4 py-4">
            <div className="space-y-4 pr-4">
            {conversation.messages.length === 0 &&
              streamingMessage === '' &&
              streamingThinking === '' && (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                <p className="mb-2 text-lg">Pokemon assistant</p>
                <p>Ask about the loaded save or live session: party, items, badges, Pokédex, PC boxes, and location.</p>
                {conversation.gameContext && (
                  <p className="mt-4 text-xs text-gray-400">
                    {conversation.gameContext.trainerName} •{' '}
                    {conversation.gameContext.location}
                  </p>
                )}
                <p className="mt-6 text-xs text-gray-400">
                  Commands: /reset, /clear, /help
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
                  {msg.attachments?.map((attachment) => (
                    <figure key={`${msg.timestamp}-${attachment.name}`} className="mb-2">
                      <img
                        src={`data:${attachment.mediaType};base64,${attachment.data}`}
                        alt={attachment.name}
                        className="max-h-64 w-full rounded-md object-contain"
                      />
                      <figcaption
                        className={`mt-1 truncate text-[10px] ${
                          msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {attachment.name}
                      </figcaption>
                    </figure>
                  ))}
                  {runtimeConfig.thinking && msg.thinking && (
                    <details className="mb-2 rounded border border-slate-400/30 bg-black/5 px-2 py-1 dark:bg-white/5">
                      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium">
                        <Brain className="h-3.5 w-3.5" />
                        Model thinking
                      </summary>
                      <div className="mt-2 whitespace-pre-wrap border-t border-slate-400/20 pt-2 text-xs opacity-80">
                        {msg.thinking}
                      </div>
                    </details>
                  )}
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
                  {msg.sources && msg.sources.length > 0 && (
                    <details className="mt-2 rounded border border-slate-400/30 bg-black/5 px-2 py-1 text-xs dark:bg-white/5">
                      <summary className="cursor-pointer font-medium">
                        Sources used ({msg.sources.length})
                      </summary>
                      <ul className="mt-2 space-y-1 border-t border-slate-400/20 pt-2">
                        {msg.sources.map((source, sourceIndex) => {
                          const sourceDisplay = getSourceDisplay(source, sourceIndex);
                          return (
                            <li key={`${source.url ?? source.name}-${sourceIndex}`}>
                              {source.url ? (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-start gap-2 rounded px-1 py-1 text-blue-700 hover:bg-white/50 hover:underline dark:text-blue-300 dark:hover:bg-black/20"
                              >
                                <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center overflow-hidden rounded bg-white p-0.5 text-[10px] font-bold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                                  {sourceDisplay.logoUrl ? (
                                    <img
                                      src={sourceDisplay.logoUrl}
                                      alt={`${sourceDisplay.siteName} logo`}
                                      className="h-4 w-4 object-contain"
                                      loading="lazy"
                                    />
                                  ) : (
                                    sourceDisplay.fallbackIcon
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block break-words">
                                    {sourceDisplay.label}
                                  </span>
                                  <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                                    {sourceDisplay.siteName}
                                  </span>
                                </span>
                                <ExternalLink className="mt-1 h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-white px-1 text-[10px] font-bold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                                  {sourceDisplay.fallbackIcon}
                                </span>
                                {sourceDisplay.label}
                              </span>
                            )}
                          </li>
                          );
                        })}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            ))}

            {(streamingMessage || streamingThinking) && (
              <div className="flex justify-start">
                <div className="max-w-xs rounded-lg px-4 py-2 text-sm bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                  {runtimeConfig.thinking && streamingThinking && (
                    <details open className="mb-2 rounded border border-slate-400/30 bg-black/5 px-2 py-1 dark:bg-white/5">
                      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium">
                        <Brain className="h-3.5 w-3.5" />
                        Thinking...
                      </summary>
                      <div className="mt-2 whitespace-pre-wrap border-t border-slate-400/20 pt-2 text-xs opacity-80">
                        {streamingThinking}
                      </div>
                    </details>
                  )}
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
          {imageAttachment && (
            <div className="mb-2 flex items-center gap-3 rounded border bg-white px-3 py-2 text-xs dark:bg-slate-950">
              <img
                src={`data:${imageAttachment.mediaType};base64,${imageAttachment.data}`}
                alt={imageAttachment.name}
                className="h-14 w-14 rounded object-cover"
              />
              <span className="min-w-0 flex-1 truncate">{imageAttachment.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setImageAttachment(null)}
                className="h-6 px-2"
              >
                Remove
              </Button>
            </div>
          )}
          <div className="flex space-x-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                void handleImageSelection(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => imageInputRef.current?.click()}
              disabled={conversation.isLoading}
              title="Attach image (vision model required)"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPaste={handleInputPaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message... (/help for commands)"
              disabled={conversation.isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={
                (!inputValue.trim() && !imageAttachment) || conversation.isLoading
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
