import { PLANS } from "@/lib/site/content";

export default function PlanGrid() {
  return (
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {PLANS.map((p) => (
        <div
          key={p.name}
          className={`flex flex-col gap-2.5 rounded-[18px] border p-6 ${p.featured ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}
        >
          <span className="text-[15px] font-bold">{p.name}</span>
          <span className="font-serif text-[40px] font-medium leading-none">
            {p.price}
            {p.per && <span className="ml-1 font-sans text-[15px] font-medium opacity-75">{p.per}</span>}
          </span>
          <span className="text-sm leading-relaxed opacity-85">{p.what}</span>
        </div>
      ))}
    </div>
  );
}
