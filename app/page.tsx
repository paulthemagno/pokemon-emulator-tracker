"use client";

import { useState, useCallback, useMemo } from "react";
import { FileUpload } from "@/components/pokemon/file-upload";
import { Dashboard } from "@/components/pokemon/dashboard";
import { LiveSourceCard } from "@/components/pokemon/live-source-card";
import { useSaveData } from "@/hooks/use-save-data";
import { useLiveData } from "@/hooks/use-live-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Gamepad2, Info } from "lucide-react";
import type { SaveData } from "@/lib/pokemon/types";

function hasStoredPokemon(data: SaveData | null) {
  return Boolean(
    data?.pcBoxes.some((box) => box.pokemon.some((pokemon) => pokemon !== null))
  );
}

export default function Home() {
  const { saveData, isLoading, error, filename, uploadFile, clearData, lastUpdated } =
    useSaveData();
  const live = useLiveData(500);
  const [showInfo, setShowInfo] = useState(false);
  const activeSaveData = useMemo(() => {
    if (!live.data) return saveData;
    if (hasStoredPokemon(live.data) || !hasStoredPokemon(saveData)) return live.data;

    return {
      ...live.data,
      pcBoxes: saveData?.pcBoxes ?? live.data.pcBoxes,
    };
  }, [live.data, saveData]);
  const activeFilename = live.data ? "Live emulator memory" : filename;
  const activeUpdated = live.lastUpdated ?? lastUpdated;

  const handleFileSelect = useCallback(
    async (file: File) => {
      await uploadFile(file);
    },
    [uploadFile]
  );
  const handleClear = useCallback(() => {
    live.clear();
    clearData();
  }, [clearData, live]);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gamepad2 className="h-6 w-6 text-primary" />
              <div>
                <h1 className="font-bold text-lg text-foreground">Pokemon Save Companion</h1>
                <p className="text-xs text-muted-foreground">Gen 1-3 Save File Viewer</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowInfo(!showInfo)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Info className="h-4 w-4" />
              </Button>
              {activeSaveData && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Info Banner */}
      {showInfo && (
        <div className="bg-primary/10 border-b border-primary/20">
          <div className="mx-auto w-full max-w-[1800px] px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">How to Use</h3>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Open your emulator (mGBA, VBA, etc.) and load your Pokemon game</li>
                  <li>Save your game in the emulator</li>
                  <li>Find your .sav or .srm file (usually in the same folder as your ROM)</li>
                  <li>Drop the save file here to view your stats</li>
                  <li>Re-upload the file anytime to see updated data</li>
                </ol>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="outline" className="text-xs">Red/Blue/Yellow</Badge>
                  <Badge variant="outline" className="text-xs">Gold/Silver/Crystal</Badge>
                  <Badge variant="outline" className="text-xs">Ruby/Sapphire/Emerald</Badge>
                  <Badge variant="outline" className="text-xs">FireRed/LeafGreen</Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowInfo(false)}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* No Data State - Show Upload */}
        {!activeSaveData && (
          <div className="max-w-xl mx-auto py-12">
            <div className="text-center mb-8">
              <Gamepad2 className="h-16 w-16 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                View Your Pokemon Save Data
              </h2>
              <p className="text-muted-foreground">
                Upload your save file (.sav, .srm) to see trainer info, party, PC boxes, and inventory.
              </p>
            </div>
            <FileUpload
              onFileSelect={handleFileSelect}
              isLoading={isLoading}
              currentFile={filename}
            />
            <div className="mt-6">
              <LiveSourceCard
                isConnected={live.isConnected}
                isPolling={live.isPolling}
                source={live.source}
                error={live.error}
                lastUpdated={live.lastUpdated}
                onStart={live.start}
                onStop={live.stop}
              />
            </div>
            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground">
                Supports Generation 1-3 Pokemon games
              </p>
            </div>
          </div>
        )}

        {/* Data Loaded - Show Dashboard with small upload area */}
        {activeSaveData && (
          <div className="space-y-6">
            <LiveSourceCard
              isConnected={live.isConnected}
              isPolling={live.isPolling}
              source={live.source}
              error={live.error}
              lastUpdated={live.lastUpdated}
              onStart={live.start}
              onStop={live.stop}
            />

            {/* Small upload area for updates */}
            <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/45 p-4 sm:flex-row sm:items-center">
              <div className="w-full sm:max-w-xl">
                <FileUpload
                  onFileSelect={handleFileSelect}
                  isLoading={isLoading}
                  currentFile={filename}
                  compact
                  className="w-full"
                />
              </div>
              <p className="max-w-md text-sm text-muted-foreground">
                Re-upload your save file, or start a live adapter for HP and party updates.
              </p>
            </div>

            {/* Dashboard */}
            <Dashboard
              saveData={activeSaveData}
              filename={activeFilename}
              lastUpdated={activeUpdated}
              isLive={Boolean(live.data)}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>Pokemon Save Companion - View your game progress in real-time</p>
            <p className="text-xs">
              Pokemon is a trademark of Nintendo/Game Freak. This is a fan-made tool.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
