import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><div className="text-muted-foreground">Sales module coming soon...</div></ProtectedRoute>} />
      <Route path="/bills" element={<ProtectedRoute><div className="text-muted-foreground">Bills module coming soon...</div></ProtectedRoute>} />
      <Route path="/items" element={<ProtectedRoute><div className="text-muted-foreground">Items module coming soon...</div></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><div className="text-muted-foreground">Inventory module coming soon...</div></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><div className="text-muted-foreground">Suppliers module coming soon...</div></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><div className="text-muted-foreground">Settings coming soon...</div></ProtectedRoute>} />
      <Route path="/install" element={<ProtectedRoute><Install /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
