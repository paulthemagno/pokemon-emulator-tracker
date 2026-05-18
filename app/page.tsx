"use client";

import { useState, useCallback, useMemo } from "react";
import { FileUpload } from "@/components/pokemon/file-upload";
import { Dashboard } from "@/components/pokemon/dashboard";
import { LiveSourceCard } from "@/components/pokemon/live-source-card";
import { ChatbotPanel } from "@/components/pokemon/chatbot-panel";
import { useSaveData } from "@/hooks/use-save-data";
import { useLiveData } from "@/hooks/use-live-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Gamepad2, Info, MessageSquare } from "lucide-react";
import { mergeLiveWithSavePcBoxes } from "@/lib/pokemon/pc-box-merge";

export default function Home() {
  const { saveData, isLoading, error, filename, uploadFile, clearData, lastUpdated } =
    useSaveData();
  const live = useLiveData(250);
  const [showInfo, setShowInfo] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const activeSaveData = useMemo(() => {
    if (!live.data) return saveData;
    return mergeLiveWithSavePcBoxes(live.data, saveData);
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
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-no-repeat opacity-20"
        style={{
          backgroundImage: "url('/pokemon-emulator-tracker-wallpaper.png')",
          backgroundPosition: "top center",
          backgroundSize: "min(900px, 92vw) auto",
        }}
      />
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Pokemon Emulator Tracker logo"
                className="h-10 w-10 rounded-md [image-rendering:pixelated]"
                draggable={false}
              />
              <div>
                <h1 className="font-bold text-lg text-foreground">Pokemon Emulator Tracker</h1>
                <p className="text-xs text-muted-foreground">Live emulator and save progress dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowChatbot(true)}
                className="gap-2"
                title="Open Pokémon Assistant"
              >
                <MessageSquare className="h-4 w-4" />
                Chat AI
              </Button>
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
        <div className="relative z-10 bg-primary/10 border-b border-primary/20">
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
      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
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
                Track Your Pokemon Run
              </h2>
              <p className="text-muted-foreground">
                Upload a save file or connect mGBA live memory to inspect party, Pokédex, PC boxes, inventory, and map progress.
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

      {/* Chatbot Panel */}
      <ChatbotPanel
        isOpen={showChatbot}
        onOpen={() => setShowChatbot(true)}
        onClose={() => setShowChatbot(false)}
        gameData={activeSaveData}
      />

      {/* Footer */}
      <footer className="relative z-10 border-t border-border mt-12">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>Pokemon Emulator Tracker - Track game progress from saves and live emulator memory</p>
            <p className="text-xs">
              Pokemon is a trademark of Nintendo/Game Freak. This is a fan-made tool.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
