"use client";

import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import { getItemSpriteUrls } from "@/lib/pokemon/utils";
import { cn } from "@/lib/utils";

interface ItemIconProps {
  itemName?: string | null;
  generation?: number;
  className?: string;
  imageClassName?: string;
}

export function ItemIcon({
  itemName,
  generation,
  className,
  imageClassName,
}: ItemIconProps) {
  const urls = useMemo(
    () => (itemName ? getItemSpriteUrls(itemName, generation) : []),
    [generation, itemName]
  );
  const [urlIndex, setUrlIndex] = useState(0);
  const currentUrl = urls[urlIndex];

  useEffect(() => {
    setUrlIndex(0);
  }, [generation, itemName]);

  return (
    <div
      className={cn(
        "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-amber-400/20 bg-amber-400/10",
        className
      )}
    >
      {currentUrl ? (
        <img
          src={currentUrl}
          alt={itemName ?? "Item"}
          className={cn("h-5 w-5 object-contain pixelated", imageClassName)}
          loading="lazy"
          onError={() => setUrlIndex((index) => index + 1)}
        />
      ) : (
        <Package className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}
