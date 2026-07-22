"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-full bg-forest-900 text-white px-4 py-1.5 text-sm font-medium hover:bg-forest-800 transition"
    >
      {copied ? "¡Copiado!" : "Copiar link"}
    </button>
  );
}
