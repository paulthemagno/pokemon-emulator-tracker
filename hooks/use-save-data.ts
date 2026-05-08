"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import useSWR from "swr";
import { SaveData } from "@/lib/pokemon/types";

interface UseSaveDataOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseSaveDataReturn {
  saveData: SaveData | null;
  isLoading: boolean;
  error: string | null;
  filename: string | null;
  uploadFile: (file: File) => Promise<void>;
  clearData: () => void;
  lastUpdated: number | null;
  isWatching: boolean;
  startWatching: () => void;
  stopWatching: () => void;
}

async function parseSaveFile(file: File): Promise<SaveData> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/parse", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Failed to parse save file");
  }

  return result.data;
}

export function useSaveData(options: UseSaveDataOptions = {}): UseSaveDataReturn {
  const { autoRefresh = false, refreshInterval = 2000 } = options;

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const watchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastModifiedRef = useRef<number>(0);

  // Use SWR for caching and revalidation
  const {
    data: saveData,
    error,
    isLoading,
    mutate,
  } = useSWR(
    currentFile ? `save-file-${filename}` : null,
    () => (currentFile ? parseSaveFile(currentFile) : null),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 1000,
    }
  );

  const uploadFile = useCallback(async (file: File) => {
    setCurrentFile(file);
    setFilename(file.name);
    setLastUpdated(Date.now());
    lastModifiedRef.current = file.lastModified;
  }, []);

  const clearData = useCallback(() => {
    setCurrentFile(null);
    setFilename(null);
    setLastUpdated(null);
    setIsWatching(false);
    if (watchIntervalRef.current) {
      clearInterval(watchIntervalRef.current);
      watchIntervalRef.current = null;
    }
    mutate(null, false);
  }, [mutate]);

  // File watching simulation - checks if user re-uploads a file
  const startWatching = useCallback(() => {
    setIsWatching(true);
  }, []);

  const stopWatching = useCallback(() => {
    setIsWatching(false);
  }, []);

  // Auto-refresh when file is re-uploaded with new data
  useEffect(() => {
    if (currentFile && currentFile.lastModified !== lastModifiedRef.current) {
      lastModifiedRef.current = currentFile.lastModified;
      setLastUpdated(Date.now());
      mutate();
    }
  }, [currentFile, mutate]);

  return {
    saveData: saveData ?? null,
    isLoading,
    error: error?.message ?? null,
    filename,
    uploadFile,
    clearData,
    lastUpdated,
    isWatching,
    startWatching,
    stopWatching,
  };
}
