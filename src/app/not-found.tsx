import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-canvas text-primary">
      <h2 className="text-2xl font-bold">404 - Page Not Found</h2>
      <Link href="/" className="mt-4 text-accent underline">
        Voltar para a página inicial
      </Link>
    </div>
  );
}
