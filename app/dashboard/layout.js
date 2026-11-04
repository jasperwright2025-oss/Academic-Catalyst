import DashboardShell from "@/components/app/DashboardShell";

export const metadata = {
  title: "Dashboard",
  robots: { index: false },
};

export default function DashboardLayout({ children }) {
  return <DashboardShell>{children}</DashboardShell>;
}
