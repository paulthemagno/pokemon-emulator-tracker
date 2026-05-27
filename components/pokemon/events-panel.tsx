"use client";

import { useMemo, useState } from "react";
import type { GameEventProgress } from "@/lib/pokemon/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface EventsPanelProps {
  events?: GameEventProgress;
}

function formatImportance(value?: string): string {
  if (value === "story") return "Main story";
  if (value === "unlock") return "Key item / access";
  if (value === "optional") return "Optional / choice";
  return "Technical flag";
}

function formatFlowStatus(flag: GameEventProgress["flags"][number]): string {
  if (flag.completed) return "Completed";
  if (flag.alternativeCompleted && flag.alternativeCompleted.length > 0) return "Alternative done";
  if (flag.flowStatus === "blocked") return "Blocked";
  if (flag.flowStatus === "optional") return "Optional";
  return "Not completed";
}

function formatDescriptionKind(flag: GameEventProgress["flags"][number]): string {
  return flag.descriptionKind === "script-guided" ? "Verified guide" : "Auto description";
}

export function EventsPanel({ events }: EventsPanelProps) {
  const [scope, setScope] = useState<"milestones" | "all">("milestones");
  const [mode, setMode] = useState<"missing" | "done" | "all">("missing");

  const grouped = useMemo(() => {
    if (!events) return [];
    const visible = events.flags
      .filter((flag) => scope === "all" || flag.important)
      .filter((flag) => {
        if (mode === "all") return true;
        if (mode === "done") return flag.completed;
        return !flag.completed;
      });
    const groups = new Map<string, typeof visible>();
    for (const flag of visible) {
      const group = groups.get(flag.category) ?? [];
      group.push(flag);
      groups.set(flag.category, group);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events, mode, scope]);

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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/45 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-foreground">Event progress</p>
            <Badge variant={scope === "milestones" ? "default" : "secondary"} className="rounded-full">
              {scope === "milestones" ? "Key events" : "All save flags"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Key events are story progress and important access/item flags. All save flags includes technical engine state. Completed {events.importantCompletedCount}/{events.importantTotalCount} · Blocked by known prerequisites {blockedCount} · All flags {events.completedCount}/{events.totalCount}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["missing", "done", "all"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={mode === value ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(value)}
            >
              {value === "missing" ? "Not completed" : value === "done" ? "Completed" : "Everything"}
            </Button>
          ))}
          {(["milestones", "all"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={scope === value ? "default" : "outline"}
              size="sm"
              onClick={() => setScope(value)}
            >
              {value === "milestones" ? "Key events" : "All save flags"}
            </Button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-lg border border-border/70 bg-card/45 p-5 text-sm text-muted-foreground">
          No events match the current filter.
        </div>
      ) : (
        grouped.map(([category, flags]) => (
          <section key={category} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">{category}</h3>
              <Badge variant="outline" className="rounded-full">{flags.length}</Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {flags.map((flag) => (
                <div key={`${flag.key}-${flag.id}`} className="rounded-lg border border-border/70 bg-card/45 p-3">
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
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{flag.key}</p>
                  {flag.description && (
                    <p className="mt-2 text-xs leading-relaxed text-foreground/85">{flag.description}</p>
                  )}
                  {(flag.descriptionKind === "script-guided" || flag.descriptionKind === "source-context") && (
                    <Badge variant="secondary" className="mt-2 rounded-full text-[10px]">
                      {flag.descriptionKind === "source-context" ? "Source-backed" : formatDescriptionKind(flag)}
                    </Badge>
                  )}
                  {flag.note && <p className="mt-2 text-xs text-muted-foreground">{flag.note}</p>}
                  {flag.flowSteps && flag.flowSteps.length > 0 && (
                    <ol className="mt-3 space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                      {flag.flowSteps.map((step, index) => (
                        <li key={`${flag.key}-step-${index}`} className="list-decimal">
                          {step}
                        </li>
                      ))}
                    </ol>
                  )}
                  {flag.actionHint && !flag.flowSteps?.includes(flag.actionHint) && (
                    <p className="mt-2 text-xs text-foreground/85">{flag.actionHint}</p>
                  )}
                  {flag.prerequisites && flag.prerequisites.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Prereq: <span className="font-mono">{flag.prerequisites.join(", ")}</span>
                    </p>
                  )}
                  {flag.missingPrerequisites && flag.missingPrerequisites.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Missing prereq: <span className="font-mono">{flag.missingPrerequisites.join(", ")}</span>
                    </p>
                  )}
                  {flag.mutuallyExclusiveWith && flag.mutuallyExclusiveWith.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Other choices in this branch: <span className="font-mono">{flag.mutuallyExclusiveWith.join(", ")}</span>
                    </p>
                  )}
                  {flag.alternativeCompleted && flag.alternativeCompleted.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Your completed choice: <span className="font-mono">{flag.alternativeCompleted.join(", ")}</span>
                    </p>
                  )}
                  {flag.normalMissingReason && <p className="mt-2 text-xs text-muted-foreground">{flag.normalMissingReason}</p>}
                  {flag.sourceRefs && flag.sourceRefs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {flag.sourceRefs.map((sourceRef, index) => (
                        <a
                          key={sourceRef}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          href={sourceRef}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source {index + 1}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
