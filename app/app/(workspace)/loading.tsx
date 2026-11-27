import { LoadingState } from "@/components/shared/loading-state";

export default function Loading() {
  return (
    <div className="p-6">
      <LoadingState label="Opening workspace" rows={2} />
    </div>
  );
}
