'use client';

/**
 * Chatbot UI Component - Right-side assistant drawer
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
  Bot,
  ExternalLink,
  ImagePlus,
  Maximize2,
  Minimize2,
  SendHorizontal,
  Settings,
  Sparkles,
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
  onClose: () => void;
  width?: number;
  onWidthChange?: (width: number) => void;
  gameData?: SaveData | null;
}

const PANEL_DEFAULT_WIDTH = 440;
const PANEL_WIDE_WIDTH = 640;
const PANEL_MIN_WIDTH = 380;
const PANEL_MAX_WIDTH = 720;

const SUGGESTED_PROMPTS = [
  'Where can I catch Wailmer in Pokemon Emerald?',
  'How do I clear Mirage Tower in Pokemon Emerald?',
  'Which Pokemon in my current party needs the most help?',
  'How do I wake Snorlax in Pokemon Crystal?',
  'What moves can Gardevoir learn in Pokemon Emerald?',
  'Where do I get the Clear Bell in Pokemon Crystal?',
];

function getImageExtension(mediaType: ChatImageAttachment['mediaType']): string {
  if (mediaType === 'image/jpeg') return 'jpg';
  if (mediaType === 'image/webp') return 'webp';
  return 'png';
}

function clampPanelWidth(width: number): number {
  if (typeof window === 'undefined') {
    return Math.min(Math.max(width, PANEL_MIN_WIDTH), PANEL_MAX_WIDTH);
  }

  return Math.min(
    Math.max(width, PANEL_MIN_WIDTH),
    Math.min(PANEL_MAX_WIDTH, window.innerWidth - 32)
  );
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

function getProviderLabel(provider?: ChatRuntimeConfig['provider']): string {
  if (provider === 'openrouter') return 'OpenRouter';
  if (provider === 'ai-sdk') return 'AI SDK / BYOK';
  if (provider === 'ollama') return 'Ollama';
  return '.env/app config';
}

function getProviderValueFromInfo(
  info: ChatProviderInfo | null
): ChatRuntimeConfig['provider'] | undefined {
  const label = info?.provider.toLowerCase() ?? '';
  if (label.includes('openrouter')) return 'openrouter';
  if (label.includes('ai sdk')) return 'ai-sdk';
  if (label.includes('ollama')) return 'ollama';
  return undefined;
}

function getProviderTone(provider?: string): string {
  const normalized = provider?.toLowerCase() ?? '';
  if (normalized.includes('ollama')) return 'from-orange-500/15 to-amber-500/10 text-orange-700 dark:text-orange-200';
  if (normalized.includes('openrouter')) return 'from-violet-500/15 to-fuchsia-500/10 text-violet-700 dark:text-violet-200';
  if (normalized.includes('ai sdk')) return 'from-sky-500/15 to-cyan-500/10 text-sky-700 dark:text-sky-200';
  return 'from-blue-500/15 to-cyan-500/10 text-blue-700 dark:text-blue-200';
}

function providerInfoMatchesSelection(
  info: ChatProviderInfo | null,
  provider?: ChatRuntimeConfig['provider']
): boolean {
  if (!info || !provider) return Boolean(info);
  const label = info.provider.toLowerCase();
  if (provider === 'ollama') return label.includes('ollama');
  if (provider === 'openrouter') return label.includes('openrouter');
  return label.includes('ai sdk');
}

export function ChatbotPanel({
  isOpen,
  onClose,
  width = PANEL_DEFAULT_WIDTH,
  onWidthChange,
  gameData,
}: ChatbotPanelProps) {
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
  const dragStateRef = useRef<{
    pointerId: number | null;
    startX: number;
    startWidth: number;
  }>({
    pointerId: null,
    startX: 0,
    startWidth: width,
  });
  const selectedProviderInfo = providerInfoMatchesSelection(providerInfo, runtimeConfig.provider)
    ? providerInfo
    : null;
  const envProvider = runtimeConfig.provider ? undefined : getProviderValueFromInfo(providerInfo);
  const effectiveProvider = runtimeConfig.provider || envProvider;
  const selectedProviderValue = effectiveProvider || '';
  const effectiveProviderName = runtimeConfig.provider
    ? getProviderLabel(runtimeConfig.provider)
    : selectedProviderInfo?.provider ?? '.env/app configured provider';
  const modelOverride = runtimeConfig.modelName?.trim();
  const effectiveModelName =
    modelOverride ||
    selectedProviderInfo?.modelName ||
    'Resolving configured model...';
  const modelSource = modelOverride
    ? 'temporary model override'
    : selectedProviderInfo
      ? 'model from .env/app config'
      : 'checking .env/app config';
  const providerTone = getProviderTone(effectiveProviderName);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      onWidthChange?.(clampPanelWidth(dragState.startWidth - (event.clientX - dragState.startX)));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragStateRef.current.pointerId !== event.pointerId) {
        return;
      }

      dragStateRef.current = {
        pointerId: null,
        startX: 0,
        startWidth: width,
      };
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [onWidthChange, width]);

  // Check provider status/model whenever the visible provider changes.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const abortController = new AbortController();

    const checkProvider = async () => {
      try {
        setProviderInfo(null);
        setProviderReady(false);
        const params = new URLSearchParams();
        if (runtimeConfig.provider) {
          params.set('provider', runtimeConfig.provider);
        }
        const response = await fetch(
          params.size > 0 ? `/api/chat?${params.toString()}` : '/api/chat',
          { signal: abortController.signal }
        );
        const info = (await response.json()) as ChatProviderInfo;
        if (abortController.signal.aborted) {
          return;
        }
        setProviderInfo(info);
        setProviderReady(response.ok && info.ready);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setProviderReady(false);
      }
    };

    checkProvider();

    return () => abortController.abort();
  }, [isOpen, runtimeConfig.provider]);

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
              effectiveProvider === 'ollama'
                ? runtimeConfig.endpoint?.trim() || undefined
                : undefined,
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

  const startResize = (event: React.PointerEvent<HTMLElement>) => {
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: width,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <>
      <div
        className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 lg:inset-y-0 lg:left-auto ${
          isOpen ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full lg:translate-y-0'
        }`}
        style={{ width: typeof window === 'undefined' ? width : undefined }}
      >
      <Card
        style={{
          width: `min(100vw, ${clampPanelWidth(width)}px)`,
        }}
        className="ml-auto h-[88vh] overflow-hidden rounded-t-3xl border-border/80 bg-background/95 py-0 shadow-2xl backdrop-blur-xl dark:bg-slate-950/95 lg:h-screen lg:rounded-none lg:border-y-0 lg:border-r-0"
      >
        <button
          type="button"
          aria-label="Resize chat panel"
          onPointerDown={startResize}
          className="absolute left-0 top-0 z-10 hidden h-full w-2 cursor-ew-resize touch-none bg-transparent transition hover:bg-primary/20 lg:block"
        />
        {/* Header */}
        <div className="border-b border-border/70 bg-gradient-to-br from-card via-card to-muted/60 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">Pokémon Assistant</h2>
                  <p className="truncate text-xs text-muted-foreground">Tool-backed gameplay copilot</p>
                </div>
              </div>
              <div className={`mt-3 rounded-2xl bg-gradient-to-r px-3 py-2 ${providerTone}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                      Active model
                    </p>
                    <p className="truncate text-sm font-semibold">{effectiveModelName}</p>
                    <p className="truncate text-[11px] opacity-80">
                      {effectiveProviderName} · {modelSource}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                      providerReady
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-200'
                    }`}
                  >
                    {providerReady ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="shrink-0"
              title="Close assistant"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant={showSettings ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowSettings((current) => !current)}
              className="h-8 flex-1 justify-start"
              title="Model settings"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onWidthChange?.(width >= PANEL_WIDE_WIDTH ? PANEL_DEFAULT_WIDTH : PANEL_WIDE_WIDTH)}
              className="h-8"
              title={width >= PANEL_WIDE_WIDTH ? 'Compact panel' : 'Expand panel'}
            >
              {width >= PANEL_WIDE_WIDTH ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await conversation.clearConversation();
                setStreamingMessage('');
                setStreamingThinking('');
              }}
              className="h-8"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
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
                Provider
              </label>
              <select
                id="chat-provider"
                value={selectedProviderValue}
                onChange={(event) => {
                  const selectedProvider =
                    event.target.value === 'ollama' ||
                    event.target.value === 'openrouter' ||
                    event.target.value === 'ai-sdk'
                      ? event.target.value
                      : undefined;
                  const currentEnvProvider = getProviderValueFromInfo(providerInfo);
                  setRuntimeConfig((current) => ({
                    ...current,
                    provider: selectedProvider === currentEnvProvider ? undefined : selectedProvider,
                  }));
                }}
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="" disabled hidden>
                  Loading provider...
                </option>
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
                  selectedProviderInfo?.modelName ||
                  (effectiveProvider === 'ai-sdk'
                    ? 'anthropic/claude-sonnet-4-5'
                    : 'Optional model override')
                }
                className="h-8"
              />
              {effectiveProvider === 'ai-sdk' && (
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  Use provider/model, for example anthropic/claude-sonnet-4-5, openai/gpt-4.1, or google/gemini-2.5-flash.
                </p>
              )}
            </div>
            {effectiveProvider === 'ollama' && (
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
                  placeholder={selectedProviderInfo?.endpoint || 'Optional endpoint override'}
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
                      : effectiveProvider === 'openrouter'
                        ? 'Optional OpenRouter API key'
                        : effectiveProvider === 'ai-sdk'
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
                  Uses .env/app default until changed. Off sends think: false to Ollama and reasoning: none to AI SDK.
                </span>
              </span>
              <input
                type="checkbox"
                checked={runtimeConfig.thinking ?? true}
                disabled={effectiveProvider === 'openrouter'}
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
              Blank fields use .env values when present, otherwise app fallbacks. Overrides stay in this page state and are sent only with chat requests.
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
              <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-muted/70 to-card p-4 text-sm text-muted-foreground">
                <div className="mb-4 flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">Ask about the current run</p>
                    <p className="mt-1">
                      Use save/live state, local tools, guide retrieval, or attach a screenshot.
                    </p>
                  </div>
                </div>
                {conversation.gameContext && (
                  <p className="mb-4 rounded-2xl bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                    {conversation.gameContext.trainerName} •{' '}
                    {conversation.gameContext.location}
                  </p>
                )}
                <div className="grid gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInputValue(prompt)}
                      className="rounded-2xl border border-border/70 bg-background/80 px-3 py-2 text-left text-xs text-foreground transition hover:border-primary/50 hover:bg-primary/5"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
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
                  className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border/70 bg-card text-card-foreground'
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
                  {runtimeConfig.thinking !== false && msg.thinking && (
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
                <div className="max-w-[86%] rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
                  {runtimeConfig.thinking !== false && streamingThinking && (
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
        <div className="border-t bg-card/90 px-4 py-3 backdrop-blur">
          {conversation.messages.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {SUGGESTED_PROMPTS.slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInputValue(prompt)}
                  disabled={conversation.isLoading}
                  className="shrink-0 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
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
              placeholder="Ask about the run, a guide, a move, or paste a screenshot..."
              disabled={conversation.isLoading}
              className="h-11 flex-1 rounded-2xl"
            />
            <Button
              onClick={handleSendMessage}
              disabled={
                (!inputValue.trim() && !imageAttachment) || conversation.isLoading
              }
              className="h-11 rounded-2xl bg-primary hover:bg-primary/90"
            >
              <SendHorizontal className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
      </Card>
      </div>
    </>
  );
}
