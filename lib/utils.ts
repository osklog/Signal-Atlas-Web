import clsx from "clsx";
import { format, formatDistanceToNowStrict } from "date-fns";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatRelativeTime(value: string) {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

export function formatAbsoluteTime(value: string) {
  return format(new Date(value), "MMM d, yyyy HH:mm 'UTC'");
}

export function hoursBetween(a: string | Date, b: string | Date) {
  const start = typeof a === "string" ? new Date(a).getTime() : a.getTime();
  const end = typeof b === "string" ? new Date(b).getTime() : b.getTime();
  return Math.abs(end - start) / (1000 * 60 * 60);
}

export function truncate(text: string, length: number) {
  if (text.length <= length) {
    return text;
  }

  return `${text.slice(0, length).trimEnd()}…`;
}

export function buildSearchQuery(
  params: Record<string, string | null | undefined>,
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function countBy<T extends string | number>(values: T[]) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    const key = String(value);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

export function sortByFrequency(values: string[]) {
  const counts = countBy(values);
  return Object.entries(counts)
    .sort((left, right) => {
      if (right[1] === left[1]) {
        return left[0].localeCompare(right[0]);
      }

      return right[1] - left[1];
    })
    .map(([key]) => key);
}
