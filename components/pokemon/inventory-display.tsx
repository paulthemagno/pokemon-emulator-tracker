"use client";

import { useState } from "react";
import { InventoryItem, InventorySection } from "@/lib/pokemon/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Backpack, Key, CircleDot, Disc, Cherry } from "lucide-react";
import { ItemIcon } from "./item-icon";
import { ItemInfoTooltip } from "./item-info-tooltip";

interface InventoryDisplayProps {
  items: InventorySection[] | InventoryItem[];
  generation?: number;
  className?: string;
}

const POCKET_ICONS: Record<string, React.ReactNode> = {
  Items: <Backpack className="h-4 w-4" />,
  "Key Items": <Key className="h-4 w-4" />,
  "Poke Balls": <CircleDot className="h-4 w-4" />,
  "TMs/HMs": <Disc className="h-4 w-4" />,
  Berries: <Cherry className="h-4 w-4" />,
};

export function InventoryDisplay({ items, generation, className }: InventoryDisplayProps) {
  const sections = items.reduce(
    (acc, entry) => {
      if ("items" in entry) {
        if (entry.items.length > 0) acc[entry.name] = entry.items;
        return acc;
      }

      const pocket = entry.pocket || "Items";
      if (!acc[pocket]) acc[pocket] = [];
      acc[pocket].push(entry);
      return acc;
    },
    {} as Record<string, InventoryItem[]>
  );

  const pocketNames = Object.keys(sections);
  const itemCount = Object.values(sections).reduce((total, sectionItems) => total + sectionItems.length, 0);

  if (pocketNames.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Backpack className="h-5 w-5 text-primary" />
            Inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No items in bag
          </p>
        </CardContent>
      </Card>
    );
  }

  // If only one pocket, don't show tabs
  if (pocketNames.length === 1) {
    const [pocketName] = pocketNames;
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <Backpack className="h-5 w-5 text-primary" />
              Inventory
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {itemCount} items
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ItemList items={sections[pocketName]} generation={generation} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Backpack className="h-5 w-5 text-primary" />
            Inventory
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {itemCount} items
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={pocketNames[0]} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0 mb-3">
            {pocketNames.map((pocket) => (
              <TabsTrigger
                key={pocket}
                value={pocket}
                className="flex items-center gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 rounded-md"
              >
                {POCKET_ICONS[pocket]}
                <span className="hidden sm:inline">{pocket}</span>
                <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                  {sections[pocket].length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          {pocketNames.map((pocket) => (
            <TabsContent key={pocket} value={pocket} className="mt-0">
              <ItemList items={sections[pocket]} generation={generation} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ItemList({ items, generation }: { items: InventoryItem[]; generation?: number }) {
  const [showAll, setShowAll] = useState(false);
  const displayItems = showAll ? items : items.slice(0, 12);
  const hasMore = items.length > 12;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
        {displayItems.map((item, index) => (
          <ItemInfoTooltip key={index} itemName={item.name} generation={generation}>
            <div className="flex cursor-help items-center gap-2 rounded-lg bg-muted/50 px-2 py-2">
              <ItemIcon
                itemName={item.name}
                generation={generation}
                className="h-8 w-8"
                imageClassName="h-6 w-6"
              />
              <span className="text-sm truncate flex-1" title={item.name}>
                {item.name}
              </span>
              <Badge variant="outline" className="ml-2 text-xs font-mono">
                x{item.quantity}
              </Badge>
            </div>
          </ItemInfoTooltip>
        ))}
      </div>
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Show {items.length - 12} more items...
        </button>
      )}
    </div>
  );
}
