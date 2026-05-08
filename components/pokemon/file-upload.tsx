"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileWarning, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  currentFile?: string | null;
  className?: string;
}

const ACCEPTED_EXTENSIONS = [".sav", ".srm", ".sa1", ".sa2", ".sn1", ".sn2"];

export function FileUpload({
  onFileSelect,
  isLoading = false,
  currentFile,
  className,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Invalid file type. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`);
      return false;
    }

    // Check file size (32KB for Gen 1/2, 128KB for Gen 3)
    // Allow some tolerance for different emulator save formats
    const size = file.size;
    const isGen1Or2 = size >= 32768 && size <= 33792; // 32KB with 1KB tolerance
    const isGen3 = size >= 131072 && size <= 132096; // 128KB with 1KB tolerance
    const isGen3Double = size >= 262144 && size <= 263168; // 256KB (some emulators)
    
    if (!isGen1Or2 && !isGen3 && !isGen3Double) {
      setError(
        `Invalid file size (${file.size} bytes / ${(file.size / 1024).toFixed(1)}KB). Expected: ~32KB (Gen 1/2) or ~128KB (Gen 3)`
      );
      return false;
    }

    setError(null);
    return true;
  };

  const handleFile = useCallback(
    (file: File) => {
      if (validateFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          isLoading && "pointer-events-none opacity-60"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleInputChange}
          className="hidden"
        />

        {isLoading ? (
          <RefreshCw className="h-10 w-10 text-primary animate-spin" />
        ) : (
          <Upload
            className={cn(
              "h-10 w-10 transition-colors",
              isDragOver ? "text-primary" : "text-muted-foreground"
            )}
          />
        )}

        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {isLoading
              ? "Parsing save file..."
              : currentFile
                ? "Drop new file to update"
                : "Drop your save file here"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentFile ? (
              <span className="font-mono text-primary">{currentFile}</span>
            ) : (
              "Supports .sav, .srm files (Gen 1-3)"
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <FileWarning className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
