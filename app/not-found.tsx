import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <div className="page-stack">
      <EmptyState
        title="Story not found"
        copy="That cluster may have dropped out of the current dataset or the link is no longer valid."
        actionLabel="Return to radar"
        actionHref="/"
      />
    </div>
  );
}
