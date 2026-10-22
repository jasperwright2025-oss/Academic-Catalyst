import "./globals.css";

export const metadata = {
  title: "Academic Catalyst",
  description: "Research proposals, data and dissertations, built with you.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
