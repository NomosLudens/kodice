import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  // CÓDICE is a fully-standalone SPA served from public/codice/index.html.
  // Render it in a full-viewport iframe so "/" opens the reader directly.
  return (
    <iframe
      src="/codice/"
      title="CÓDICE"
      style={{
        border: 0,
        width: "100vw",
        height: "100dvh",
        display: "block",
      }}
      allow="clipboard-write; fullscreen"
    />
  );
}
