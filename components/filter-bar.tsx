import Link from "next/link";

import type { FilterOptions } from "@/lib/types";
import { buildSearchQuery, cn } from "@/lib/utils";

interface FilterBarProps {
  basePath: string;
  filters: FilterOptions;
  currentTopic?: string;
  currentRegion?: string;
}

function FilterSection({
  label,
  values,
  activeValue,
  otherParams,
  basePath,
  paramKey,
}: {
  label: string;
  values: string[];
  activeValue?: string;
  otherParams: Record<string, string | undefined>;
  basePath: string;
  paramKey: "topic" | "region";
}) {
  return (
    <div className="filter-section">
      <span className="filter-label">{label}</span>
      <div className="filter-chip-row">
        <Link
          href={`${basePath}${buildSearchQuery({
            ...otherParams,
            [paramKey]: undefined,
          })}`}
          className={cn("filter-chip", !activeValue && "filter-chip-active")}
        >
          All
        </Link>
        {values.map((value) => (
          <Link
            key={value}
            href={`${basePath}${buildSearchQuery({
              ...otherParams,
              [paramKey]: value,
            })}`}
            className={cn("filter-chip", activeValue === value && "filter-chip-active")}
          >
            {value}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function FilterBar({
  basePath,
  filters,
  currentTopic,
  currentRegion,
}: FilterBarProps) {
  return (
    <section className="filter-bar" aria-label="Story filters">
      <FilterSection
        label="Topic"
        values={filters.topics}
        activeValue={currentTopic}
        otherParams={{ region: currentRegion }}
        basePath={basePath}
        paramKey="topic"
      />
      <FilterSection
        label="Region"
        values={filters.regions}
        activeValue={currentRegion}
        otherParams={{ topic: currentTopic }}
        basePath={basePath}
        paramKey="region"
      />
    </section>
  );
}
