/**
 * /pyramids/[id] — pyramid detail with validator results.
 *
 * Server component. Fetches the pyramid and validation results from
 * the API gateway (tRPC).
 */
import { notFound } from "next/navigation";
import { PyramidViewer, type PyramidNode } from "@/components/PyramidViewer";

// TODO(M4): replace with real tRPC server-side call
async function fetchPyramid(_id: string): Promise<{ title: string; roots: PyramidNode[] } | null> {
  return null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PyramidDetailPage({ params }: PageProps) {
  const { id } = await params;
  const pyramid = await fetchPyramid(id);

  if (!pyramid) {
    notFound();
  }

  return (
    <div style={{ maxWidth: "900px" }}>
      <h1
        style={{
          fontSize: "var(--text-xl)",
          color: "var(--color-text-primary)",
          fontWeight: 600,
          letterSpacing: "var(--tracking-tight)",
          marginBottom: "16px",
        }}
      >
        {pyramid.title}
      </h1>

      <section>
        <h2
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-mono)",
            marginBottom: "8px",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-wide)",
          }}
        >
          Governance pyramid
        </h2>
        <PyramidViewer roots={pyramid.roots} />
      </section>
    </div>
  );
}
