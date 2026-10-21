export const metadata = {
  title: 'Academic Catalyst Workspace',
  description: 'Premium Elite Research Workspace Platform',
};

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased">
      {children}
    </div>
  );
}
