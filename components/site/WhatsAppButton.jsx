import { whatsappHref } from "@/lib/site/content";

// Floating click-to-chat button for the WhatsApp Business line. Works without JavaScript.
export default function WhatsAppButton() {
  return (
    <a
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Academic Catalyst on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 font-semibold text-white shadow-[0_12px_30px_-10px_rgba(0,0,0,0.45)] hover:bg-[#1ebe5b] sm:bottom-6 sm:right-6"
    >
      <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" fill="currentColor">
        <path d="M16.04 3C9.06 3 3.4 8.65 3.4 15.62c0 2.23.58 4.4 1.69 6.32L3.3 28.7l6.94-1.78a12.6 12.6 0 0 0 5.8 1.42h.01c6.97 0 12.64-5.66 12.64-12.63C28.69 8.66 23.02 3 16.04 3Zm0 23.1h-.01c-1.9 0-3.75-.5-5.37-1.47l-.39-.23-4.12 1.06 1.1-4.02-.25-.41a10.42 10.42 0 0 1-1.6-5.4c0-5.76 4.69-10.45 10.46-10.45 5.76 0 10.45 4.69 10.45 10.46 0 5.77-4.69 10.46-10.27 10.46Zm5.73-7.83c-.31-.16-1.86-.92-2.15-1.02-.29-.11-.5-.16-.71.16-.21.31-.82 1.02-1 1.23-.18.21-.37.24-.68.08-.31-.16-1.33-.49-2.53-1.56-.94-.83-1.57-1.86-1.75-2.18-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.55.16-.18.21-.31.31-.52.1-.21.05-.39-.03-.55-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.53-.71-.54h-.6c-.21 0-.55.08-.84.39-.29.31-1.1 1.07-1.1 2.62 0 1.55 1.13 3.04 1.28 3.25.16.21 2.22 3.39 5.38 4.75.75.32 1.34.52 1.8.66.76.24 1.44.21 1.99.13.61-.09 1.86-.76 2.12-1.5.26-.73.26-1.36.18-1.5-.08-.13-.29-.21-.6-.37Z" />
      </svg>
      <span className="hidden sm:inline">Chat on WhatsApp</span>
    </a>
  );
}
