import { notFound } from "next/navigation";
import ServicePage from "@/components/site/ServicePage";
import { SERVICES, serviceBySlug } from "@/lib/site/content";

const GROUP = "services";

export function generateStaticParams() {
  return SERVICES.filter((s) => s.group === GROUP).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const s = serviceBySlug(slug);
  if (!s || s.group !== GROUP) return {};
  return { title: s.name, description: s.intro, alternates: { canonical: `/${GROUP}/${s.slug}` } };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const s = serviceBySlug(slug);
  if (!s || s.group !== GROUP) notFound();
  return <ServicePage service={s} />;
}
