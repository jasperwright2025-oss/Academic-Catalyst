import FeedbackForm from "@/components/app/FeedbackForm";

export const metadata = { title: "Give feedback" };

export default function FeedbackPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Give feedback</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        Two minutes of honest feedback helps us improve Academic Catalyst for every student. Tell us what worked,
        what did not, and whether you would recommend it to a classmate.
      </p>
      <div className="mt-8">
        <FeedbackForm />
      </div>
    </main>
  );
}
