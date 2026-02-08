import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBatchesByItem, type Batch } from '@/hooks/useBatches';
import type { ItemWithCategory } from '@/hooks/useItems';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface BatchBreakdownProps {
  item: ItemWithCategory;
  onAdjust: (batch: Batch) => void;
  compact?: boolean;
}

export function BatchBreakdown({ item, onAdjust, compact = true }: BatchBreakdownProps) {
  const { data: batches } = useBatchesByItem(item.id);
  const [expanded, setExpanded] = useState(false);
  
  if (!batches || batches.length === 0) {
    return <span className="text-muted-foreground text-xs">No batches</span>;
  }
  
  const activeBatches = batches.filter(b => b.remaining_quantity > 0);
  const conversionFactor = item.conversion_factor || null;
  const secondaryUnit = item.secondary_unit || null;
  
  // Show first 3 batches in compact mode, all if expanded or not compact
  const displayBatches = compact && !expanded ? activeBatches.slice(0, 3) : activeBatches;
  const hasMore = compact && activeBatches.length > 3;
  
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {displayBatches.map((batch) => {
          // Use batch-specific conversion factor if available
          const batchConversion = (batch as any).batch_conversion_factor ?? conversionFactor;
          const primaryQty = batch.remaining_quantity;
          const secondaryQty = batchConversion ? primaryQty * batchConversion : null;
          
          return (
            <Badge 
              key={batch.id} 
              variant="outline" 
              className="text-[10px] px-1.5 py-0.5 font-mono cursor-pointer hover:bg-accent transition-colors"
              title={`Click to adjust | Purchase: ₹${batch.purchase_price} | Selling: ₹${batch.selling_price}${batchConversion && batchConversion !== conversionFactor ? ` | Conversion: 1:${batchConversion}` : ''}`}
              onClick={() => onAdjust(batch)}
            >
              <span className="font-semibold">{batch.batch_name.split('/')[0]}</span>
              <span className="mx-0.5">:</span>
              <span>{primaryQty.toFixed(primaryQty % 1 === 0 ? 0 : 2)} {item.primary_unit}</span>
              {secondaryQty !== null && secondaryUnit && (
                <span className="text-muted-foreground ml-1">({secondaryQty.toFixed(1)} {secondaryUnit})</span>
              )}
            </Badge>
          );
        })}
      </div>
      
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-[10px] px-1 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3 mr-0.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 mr-0.5" />
              +{activeBatches.length - 3} more batches
            </>
          )}
        </Button>
      )}
    </div>
  );
}
