"use client";

import { ReactNode, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getItemDescription } from "@/lib/pokemon/utils";

interface ItemInfoTooltipProps {
  itemName?: string | null;
  generation?: number;
  children: ReactNode;
}

export function ItemInfoTooltip({
  itemName,
  generation,
  children,
}: ItemInfoTooltipProps) {
  const description = useMemo(
    () => (itemName ? getItemDescription(itemName, generation) : "No item."),
    [generation, itemName]
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-64 leading-relaxed" sideOffset={6}>
        <div className="space-y-1">
          <p className="font-semibold">{itemName ?? "No item"}</p>
          <p>{description}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
