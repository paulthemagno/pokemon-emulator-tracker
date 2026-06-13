"use client";

import { useMemo, useState } from "react";
import type { GameEventProgress, GameProgressFacts } from "@/lib/pokemon/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, BookOpen, ChevronDown, ChevronUp, Code2, ExternalLink, MapPin, Search } from "lucide-react";

interface EventsPanelProps {
  events?: GameEventProgress;
  progressFacts?: GameProgressFacts;
}

function formatImportance(value?: string): string {
  if (value === "story") return "Main story";
  if (value === "unlock") return "Key item / access";
  if (value === "optional") return "Optional / choice";
  return "Technical flag";
}

function formatFlowStatus(flag: GameEventProgress["flags"][number]): string {
  if (flag.flowStatus === "initial") return "Initial game state";
  if (flag.flowStatus === "state" && flag.stateKind === "visibility") return flag.rawSet ? "Hidden" : "Visible";
  if (flag.flowStatus === "state") return flag.rawSet ? "State active" : "State inactive";
  if (flag.completed) return "Completed";
  if (flag.alternativeCompleted && flag.alternativeCompleted.length > 0) return "Alternative done";
  if (flag.flowStatus === "blocked") return "Blocked";
  if (flag.flowStatus === "optional") return "Optional";
  return "Not completed";
}

function formatDescriptionKind(flag: GameEventProgress["flags"][number]): string {
  return flag.descriptionKind === "script-guided" ? "Verified guide" : "Auto description";
}

function sourceLabel(sourceRef: string): { label: string; icon: typeof Code2 } {
  if (sourceRef.includes("github.com/pret/")) return { label: "Game source", icon: Code2 };
  if (sourceRef.includes("bulbapedia")) return { label: "Bulbapedia guide", icon: BookOpen };
  if (sourceRef.includes("strategywiki")) return { label: "StrategyWiki guide", icon: BookOpen };
  if (sourceRef.includes("psypokes")) return { label: "Psypoke guide", icon: BookOpen };
  if (sourceRef.includes("game8.co")) return { label: "Game8 guide", icon: BookOpen };
  if (sourceRef.includes("thonky.com")) return { label: "Thonky guide", icon: BookOpen };
  return { label: "Reference", icon: BookOpen };
}

function categoryEmoji(category: string): string {
  if (category === "Story: Main") return "📖";
  if (category === "Story: Gyms and League") return "🏆";
  if (category === "Story: Rival") return "⚔️";
  if (category === "Key items and unlocks") return "🔑";
  if (category === "Optional rewards") return "🎁";
  if (category === "Items") return "🎒";
  if (category === "Trainers") return "🥊";
  if (category === "Map objects") return "🗺️";
  if (category === "Map progress") return "📍";
  if (category === "Daily") return "📅";
  if (category === "League challenge state") return "🏛️";
  if (category === "System state") return "⚙️";
  if (category === "Initial game state") return "⚙️";
  return "🧩";
}

const CATEGORY_ORDER = [
  "Story: Main",
  "Story: Gyms and League",
  "Story: Rival",
  "Key items and unlocks",
  "Optional rewards",
  "Items",
  "Trainers",
  "Map progress",
  "Map objects",
  "Daily",
  "League challenge state",
  "System state",
  "Initial game state",
  "Other",
];

export function EventsPanel({ events, progressFacts }: EventsPanelProps) {
  const [scope, setScope] = useState<"milestones" | "all">("milestones");
  const [mode, setMode] = useState<"missing" | "done" | "all">("missing");
  const [query, setQuery] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(CATEGORY_ORDER.filter((category) => category !== "Story: Main"))
  );

  const visibleProgressFacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!progressFacts) return [];
    if (!normalizedQuery) return progressFacts.facts;
    return progressFacts.facts.filter((fact) =>
      [fact.label, fact.value, fact.category, fact.description, fact.nextStep]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    );
  }, [progressFacts, query]);

  const grouped = useMemo(() => {
    if (!events) return [];
    const normalizedQuery = query.trim().toLowerCase();
    const visible = events.flags
      .filter((flag) => scope === "all" || flag.important)
      .filter((flag) => {
        if (mode === "all") return true;
        if (mode === "done") return flag.completed;
        return !flag.completed;
      })
      .filter((flag) => {
        if (!normalizedQuery) return true;
        return [flag.label, flag.key, flag.description, flag.location, flag.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      });
    const groups = new Map<string, typeof visible>();
    for (const flag of visible) {
      const group = groups.get(flag.category) ?? [];
      group.push(flag);
      groups.set(flag.category, group);
    }
    if (visibleProgressFacts.length && !groups.has("Story: Main")) {
      groups.set("Story: Main", []);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      const aIndex = CATEGORY_ORDER.indexOf(a);
      const bIndex = CATEGORY_ORDER.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [events, mode, query, scope, visibleProgressFacts]);

  const toggleExpanded = (key: string) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  if (!events) {
    return (
      <div className="rounded-lg border border-border/70 bg-card/45 p-5 text-sm text-muted-foreground">
        Event flags are not available for this source.
      </div>
    );
  }

  const blockedCount = events.flags.filter((flag) => flag.important && flag.flowStatus === "blocked").length;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-950 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">Event tracking is still being refined</p>
          <p className="mt-0.5 text-xs leading-relaxed opacity-80">
            Some flags, classifications, or descriptions may still be incomplete or inaccurate and will be corrected as each game is audited.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/45 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-foreground">Event progress</p>
            <Badge variant={scope === "milestones" ? "default" : "secondary"} className="rounded-full">
              {scope === "milestones" ? "🔑 Key events" : "🧩 All save states"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Key events are story progress and important access/item flags. All save states includes technical engine state. Completed {events.importantCompletedCount}/{events.importantTotalCount} · Blocked by known prerequisites {blockedCount} · All flags {events.completedCount}/{events.totalCount}
          </p>
        </div>
        <div className="w-full lg:w-auto">
          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search events, places, flags"
              className="pl-9"
            />
          </div>
        </div>
        <div className="grid w-full gap-3 border-t border-border/70 pt-3 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">Progress</p>
            <div className="flex flex-wrap gap-2">
              {(["missing", "done", "all"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={mode === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode(value)}
                >
                  {value === "missing" ? "⏳ Not completed" : value === "done" ? "✅ Completed" : "📋 Everything"}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">Event set</p>
            <div className="flex flex-wrap gap-2">
              {(["milestones", "all"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={scope === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScope(value)}
                >
                  {value === "milestones" ? "🔑 Key events" : "🧩 All save states"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-lg border border-border/70 bg-card/45 p-5 text-sm text-muted-foreground">
          No events match the current filter.
        </div>
      ) : (
        <>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCollapsedCategories(new Set(grouped.map(([category]) => category)))}
            >
              📁 Collapse all
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCollapsedCategories(new Set())}>
              📂 Expand all
            </Button>
          </div>
          {grouped.map(([category, flags]) => {
            const collapsed = collapsedCategories.has(category);
            const categoryFacts = category === "Story: Main" ? visibleProgressFacts : [];
            return (
          <section key={category} className="overflow-hidden rounded-lg border border-border/70 bg-card/20">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/35"
              onClick={() => toggleCategory(category)}
              aria-expanded={!collapsed}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-lg" aria-hidden="true">{categoryEmoji(category)}</span>
                <span className="truncate text-sm font-bold text-foreground">{category}</span>
                <Badge variant="outline" className="rounded-full">{flags.length + categoryFacts.length}</Badge>
              </span>
              {collapsed
                ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                : <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>
            {!collapsed && (
            <div className="grid gap-3 border-t border-border/70 p-3 lg:grid-cols-2">
              {categoryFacts.map((fact) => (
                <article
                  key={`story-context-${fact.key}`}
                  className="rounded-lg border border-emerald-500/35 bg-emerald-500/5 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{fact.label}</p>
                    <Badge variant="outline" className="rounded-full text-[10px] font-medium">
                      {fact.category}
                    </Badge>
                  </div>
                  <p className="mt-1 text-base font-bold text-foreground">{fact.value}</p>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/85">{fact.description}</p>
                  {fact.nextStep ? (
                    <div className="mt-3 border-l-2 border-emerald-500 pl-3">
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">Next step</p>
                      <p className="mt-0.5 text-sm text-foreground">{fact.nextStep}</p>
                    </div>
                  ) : null}
                  <a
                    href={fact.sourceRefs[0]}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Game source
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </article>
              ))}
              {flags.map((flag) => {
                const expanded = expandedKeys.has(flag.key);
                const hasDetails = Boolean(
                  flag.flowSteps?.length
                  || flag.prerequisites?.length
                  || flag.missingPrerequisites?.length
                  || flag.mutuallyExclusiveWith?.length
                  || flag.alternativeCompleted?.length
                  || flag.normalMissingReason
                  || flag.sourceRefs?.length
                );
                return (
                  <article key={`${flag.key}-${flag.id}`} className="rounded-lg border border-border/70 bg-card/45 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{flag.label}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="rounded-full capitalize">
                          {formatImportance(flag.importance)}
                        </Badge>
                        <Badge variant={flag.completed ? "default" : "secondary"} className="rounded-full">
                          {formatFlowStatus(flag)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {flag.location && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {flag.location}
                    </p>
                  )}
                  {flag.description && (
                    <p className="mt-3 text-sm leading-relaxed text-foreground/85">{flag.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(flag.descriptionKind === "script-guided" || flag.descriptionKind === "source-context") && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        {flag.descriptionKind === "source-context" ? "Code + guides" : formatDescriptionKind(flag)}
                      </Badge>
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground">{flag.key}</span>
                  </div>
                  {hasDetails && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-8 px-2"
                      onClick={() => toggleExpanded(flag.key)}
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {expanded ? "Hide details" : "Show guide and sources"}
                    </Button>
                  )}
                  {expanded && (
                    <div className="mt-3 border-t border-border/70 pt-3">
                      {flag.note && <p className="text-xs text-muted-foreground">{flag.note}</p>}
                      {flag.flowSteps && flag.flowSteps.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground">How this event is completed</p>
                          <ol className="mt-2 space-y-2">
                            {flag.flowSteps.map((step, index) => (
                              <li key={`${flag.key}-step-${index}`} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/50 text-[10px] font-bold text-primary">
                                  {index + 1}
                                </span>
                                <span className="pt-0.5">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {flag.actionHint && !flag.flowSteps?.includes(flag.actionHint) && (
                        <p className="mt-3 text-xs text-foreground/85">{flag.actionHint}</p>
                      )}
                      {flag.prerequisites && flag.prerequisites.length > 0 && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Prerequisites: <span className="font-mono">{flag.prerequisites.join(", ")}</span>
                        </p>
                      )}
                      {flag.missingPrerequisites && flag.missingPrerequisites.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Missing prerequisites: <span className="font-mono">{flag.missingPrerequisites.join(", ")}</span>
                        </p>
                      )}
                      {flag.mutuallyExclusiveWith && flag.mutuallyExclusiveWith.length > 0 && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Other choices in this branch: <span className="font-mono">{flag.mutuallyExclusiveWith.join(", ")}</span>
                        </p>
                      )}
                      {flag.alternativeCompleted && flag.alternativeCompleted.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Your completed choice: <span className="font-mono">{flag.alternativeCompleted.join(", ")}</span>
                        </p>
                      )}
                      {flag.normalMissingReason && <p className="mt-3 text-xs text-muted-foreground">{flag.normalMissingReason}</p>}
                      {flag.sourceRefs && flag.sourceRefs.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-foreground">Evidence and guides</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {flag.sourceRefs.map((sourceRef) => {
                              const source = sourceLabel(sourceRef);
                              const SourceIcon = source.icon;
                              return (
                                <a
                                  key={sourceRef}
                                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                                  href={sourceRef}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <SourceIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                  {source.label}
                                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  </article>
                );
              })}
            </div>
            )}
          </section>
            );
          })}
        </>
      )}
    </div>
  );
}
