'use client';

/**
 * Hook for managing chatbot conversation state and history
 */

import { useState, useCallback, useEffect } from 'react';
import type { ChatMessage, ConversationState, GameContextSnapshot } from '../lib/chatbot/types';

const DB_NAME = 'pokemon-tracker-chatbot';
const STORE_NAME = 'conversations';

interface UseConversationOptions {
  autoSave?: boolean;
  maxHistorySize?: number;
}

export function useConversation(options: UseConversationOptions = {}) {
  const { autoSave = true, maxHistorySize = 100 } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [gameContext, setGameContext] = useState<GameContextSnapshot | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasDBSupport, setHasDBSupport] = useState(false);

  const persistConversation = useCallback(
    async (
      messagesToSave: ChatMessage[],
      contextToSave: GameContextSnapshot | undefined,
      id?: string
    ): Promise<string | null> => {
      if (!hasDBSupport || !autoSave) return null;

      const cid = id || conversationId || generateConversationId();

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const now = Date.now();
        const state: ConversationState = {
          messages: messagesToSave,
          gameContext: contextToSave,
          createdAt: now,
          updatedAt: now,
        };

        store.put(state, cid);

        return new Promise((resolve, reject) => {
          tx.oncomplete = () => {
            setConversationId(cid);
            resolve(cid);
          };
          tx.onerror = () => {
            reject(new Error('Failed to save conversation'));
          };
        });
      } catch (err) {
        console.error('Failed to save conversation:', err);
        return null;
      }
    },
    [autoSave, conversationId, hasDBSupport]
  );

  // Initialize IndexedDB support check
  useEffect(() => {
    if (typeof window !== 'undefined' && window.indexedDB) {
      setHasDBSupport(true);
    }
  }, []);

  // Load conversation from IndexedDB
  const loadConversation = useCallback(
    async (id: string): Promise<boolean> => {
      if (!hasDBSupport) return false;

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);

        return new Promise((resolve) => {
          request.onsuccess = () => {
            const data = request.result as ConversationState | undefined;
            if (data) {
              setMessages(data.messages);
              setGameContext(data.gameContext);
              setConversationId(id);
              resolve(true);
            } else {
              resolve(false);
            }
          };
          request.onerror = () => resolve(false);
        });
      } catch (err) {
        console.error('Failed to load conversation:', err);
        return false;
      }
    },
    [hasDBSupport]
  );

  // Save conversation to IndexedDB
  const saveConversation = useCallback(async (id?: string): Promise<string | null> => {
    return persistConversation(messages, gameContext, id);
  }, [messages, gameContext, persistConversation]);

  // Add message and optionally save
  const addMessage = useCallback(
    async (
      role: 'user' | 'assistant',
      content: string,
      metadata: Pick<
        ChatMessage,
        'attachments' | 'thinking' | 'knowledgeContext' | 'sources'
      > = {}
    ): Promise<void> => {
      const newMessage: ChatMessage = {
        role,
        content,
        timestamp: Date.now(),
        ...metadata,
      };

      let updatedMessages: ChatMessage[] = [];
      setMessages((prev) => {
        const next = [...prev, newMessage];
        if (next.length > maxHistorySize) {
          next.splice(0, next.length - maxHistorySize);
        }
        updatedMessages = next;
        return next;
      });

      if (autoSave) {
        await persistConversation(updatedMessages, gameContext);
      }
    },
    [autoSave, gameContext, maxHistorySize, persistConversation]
  );

  // Update game context
  const updateContext = useCallback(
    (context: GameContextSnapshot | undefined): void => {
      setGameContext(context);

      if (autoSave) {
        void persistConversation(messages, context);
      }
    },
    [autoSave, messages, persistConversation]
  );

  // Clear conversation
  const clearConversation = useCallback(async (): Promise<void> => {
    setMessages([]);
    setGameContext(undefined);
    setError(null);

    if (conversationId && hasDBSupport) {
      try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(conversationId);
      } catch (err) {
        console.error('Failed to delete conversation:', err);
      }
    }

    setConversationId(null);
  }, [conversationId, hasDBSupport]);

  // Create new conversation
  const newConversation = useCallback((): void => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return {
    messages,
    gameContext,
    isLoading,
    error,
    conversationId,
    hasDBSupport,
    addMessage,
    updateContext,
    saveConversation,
    loadConversation,
    clearConversation,
    newConversation,
    setIsLoading,
    setError,
  };
}

// IndexedDB utilities
function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}
