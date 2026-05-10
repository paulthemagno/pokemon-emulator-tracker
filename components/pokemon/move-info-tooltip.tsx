"use client";

import { ReactNode, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMoveDescription } from "@/lib/pokemon/utils";

interface MoveInfoTooltipProps {
  moveId?: number | null;
  moveName?: string | null;
  generation?: number;
  children: ReactNode;
}

export function MoveInfoTooltip({
  moveId,
  moveName,
  generation,
  children,
}: MoveInfoTooltipProps) {
  const description = useMemo(
    () => getMoveDescription(moveId ?? 0, moveName ?? undefined, generation),
    [generation, moveId, moveName]
  );

  const label = moveName ?? (moveId && moveId > 0 ? `Move ${moveId}` : "Empty slot");

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-64 leading-relaxed" sideOffset={6}>
        <div className="space-y-1">
          <p className="font-semibold">{label}</p>
          <p>{description}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
