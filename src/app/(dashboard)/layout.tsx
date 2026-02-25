import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AIProvider } from "@/components/ai/ai-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 bg-background overflow-hidden">
          <AIProvider>{children}</AIProvider>
        </main>
      </div>
    </div>
  );
}
