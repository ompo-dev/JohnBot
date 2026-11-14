import { LoadingFace } from "../components/loading-face";

export default function Loading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-canvas">
      <LoadingFace size={96} />
      <span className="sr-only">Loading johnBot...</span>
    </div>
  );
}
