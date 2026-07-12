"use client";

import { useState, useCallback, useMemo, useEffect, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { FileUpload } from "@/components/pokemon/file-upload";
import { LiveSourceCard } from "@/components/pokemon/live-source-card";
import { SupportedGamesStrip } from "@/components/pokemon/supported-games-strip";
import { useSaveData } from "@/hooks/use-save-data";
import { useLiveData } from "@/hooks/use-live-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Bot, FileArchive, Gamepad2, Github, Info, MessageSquare, Radio } from "lucide-react";
import { mergeLiveWithSavePcBoxes } from "@/lib/pokemon/pc-box-merge";

const Dashboard = dynamic(
  () => {
    return import("@/components/pokemon/dashboard").then((module) => module.Dashboard);
  },
  {
    ssr: false,
    loading: () => {
      return (
        <div className="rounded-xl border border-border/70 bg-card/45 p-4 text-sm text-muted-foreground">
          Loading dashboard...
        </div>
      );
    },
  }
);

const ChatbotPanel = dynamic(
  () => {
    return import("@/components/pokemon/chatbot-panel").then((module) => module.ChatbotPanel);
  },
  {
    ssr: false,
    loading: () => {
      return null;
    },
  }
);

export default function Home() {
  const { saveData, isLoading, error, filename, uploadFile, clearData, lastUpdated } =
    useSaveData();
  const live = useLiveData(250);
  const [showInfo, setShowInfo] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(440);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const hasActiveLiveData = live.isPolling && Boolean(live.data);
  const activeSaveData = useMemo(() => {
    if (!hasActiveLiveData || !live.data) return saveData;
    return mergeLiveWithSavePcBoxes(live.data, saveData);
  }, [hasActiveLiveData, live.data, saveData]);
  const activeFilename = hasActiveLiveData ? "Live emulator memory" : filename;
  const activeUpdated = hasActiveLiveData ? live.lastUpdated : lastUpdated;

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateDesktopLayout = () => setIsDesktopLayout(mediaQuery.matches);
    updateDesktopLayout();
    mediaQuery.addEventListener("change", updateDesktopLayout);
    return () => mediaQuery.removeEventListener("change", updateDesktopLayout);
  }, []);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-background transition-[padding] duration-300"
      style={
        {
          paddingRight: showChatbot && isDesktopLayout ? chatPanelWidth : 0,
        } as CSSProperties
      }
    >
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
                variant={showChatbot ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setShowChatbot((current) => !current)}
                className="gap-2"
                title={showChatbot ? 'Close Pokémon Assistant' : 'Open Pokémon Assistant'}
              >
                <MessageSquare className="h-4 w-4" />
                {showChatbot ? 'Hide AI' : 'Chat AI'}
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
                <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                  <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <p className="mb-1 font-semibold text-foreground">1. Upload a save</p>
                    <p>Drop a `.sav` or `.srm` file to inspect trainer, party, Pokédex, PC boxes, inventory, badges, and map progress.</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <p className="mb-1 font-semibold text-foreground">2. Optional live mode</p>
                    <p>Run the app locally, load the matching mGBA Lua adapter, then press Start Live for memory updates.</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                    <p className="mb-1 font-semibold text-foreground">3. Optional Chat AI</p>
                    <p>Use Ollama, OpenRouter, or BYOK provider keys to ask questions about the loaded save or live session.</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Hosted Vercel builds can parse uploaded saves. Live mGBA and Ollama need a local app because they connect to localhost.
                </p>
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
          <div className="mx-auto max-w-5xl py-12">
            <div className="text-center mb-8">
              <Gamepad2 className="h-16 w-16 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Track your Pokemon saves and live emulator runs
              </h2>
              <p className="text-muted-foreground">
                Upload save files for many games, or run the app locally with an mGBA Lua adapter for live memory updates.
              </p>
            </div>
            <div className="mb-6 grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <FileArchive className="mb-3 h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Static save analysis</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Works on local and hosted builds. Upload <code>.sav</code> / <code>.srm</code> files to inspect progress.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <Radio className="mb-3 h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">mGBA live</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Local only. Load <code>mgba-gen1</code>, <code>mgba-gen2</code>, or <code>mgba-gen3</code> Lua and press Start Live.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                <Bot className="mb-3 h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Chat AI</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ollama, OpenRouter, or BYOK assistant that answers with the current save/live context.
                </p>
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
              <section className="rounded-2xl border border-primary/25 bg-card/70 p-5 shadow-sm backdrop-blur">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-lg bg-primary/15 p-2 text-primary">
                    <FileArchive className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Mode 1</p>
                    <h3 className="text-xl font-bold text-foreground">Analyze a static save file</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Best for the hosted demo or quick checks. Drag a save file here and the app parses it once.
                    </p>
                  </div>
                </div>
                <FileUpload
                  onFileSelect={handleFileSelect}
                  isLoading={isLoading}
                  currentFile={filename}
                  hideHint
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Accepted: <code>.sav</code>, <code>.srm</code>, <code>.sa1</code>, <code>.sa2</code>, <code>.sn1</code>, <code>.sn2</code>.
                </p>
              </section>

              <section className="rounded-2xl border border-emerald-500/25 bg-card/70 p-5 shadow-sm backdrop-blur">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400">
                    <Radio className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Mode 2</p>
                    <h3 className="text-xl font-bold text-foreground">Connect live mGBA memory</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Local only. Run this app on your machine, load the Lua script in mGBA, then start live polling.
                    </p>
                  </div>
                </div>
                <LiveSourceCard
                  isConnected={live.isConnected}
                  isPolling={live.isPolling}
                  source={live.source}
                  error={live.error}
                  lastUpdated={live.lastUpdated}
                  onStart={live.start}
                  onStop={live.stop}
                  embedded
                />
              </section>
            </div>
            <div className="mt-6">
              <SupportedGamesStrip />
            </div>
            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground">
                Supports Gen 1-3 saves. Live mode requires local services; Chat AI can use local or hosted providers.
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
              isLive={hasActiveLiveData}
            />
          </div>
        )}
      </div>

      {/* Chatbot Panel */}
      <ChatbotPanel
        isOpen={showChatbot}
        onClose={() => setShowChatbot(false)}
        width={chatPanelWidth}
        onWidthChange={setChatPanelWidth}
        gameData={activeSaveData}
      />

      {/* Footer */}
      <footer className="relative z-10 border-t border-border mt-12">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <p>Pokemon Emulator Tracker - Track game progress from saves and live emulator memory</p>
              <a
                href="https://github.com/paulthemagno/pokemon-emulator-tracker"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Github className="h-4 w-4" aria-hidden="true" />
                View source on GitHub
              </a>
            </div>
            <p className="text-xs">
              Pokemon is a trademark of Nintendo/Game Freak. This is a fan-made tool.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
