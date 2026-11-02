import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp, UserRole } from './context/AppContext';
import { PublicLayout } from './layouts/PublicLayout';
import {
  HomePage,
  MarketplacePage,
  MealDetailPage,
  DietitianDirectoryPage,
  PricingPage,
  InfoStaticPage,
} from './pages/public/HomeAndInfoPages';
import { LoginPage, RegisterPage } from './pages/auth/AuthPages';
import { PatientPortal } from './pages/patient/PatientPortal';
import { DietitianPortal } from './pages/dietitian/DietitianPortal';
import { KitchenPortal, DeliveryPortal } from './pages/operations/KitchenAndDeliveryPortals';
import { AdminPortal } from './pages/admin/AdminPortal';

const ProtectedPortalRoute: React.FC<{
  allowedRoles: UserRole[];
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { user, authLoading } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs font-medium text-slate-500">
        Verifying NutriSync clinical session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    const fallback =
      user.role === 'dietitian'
        ? '/portal/dietitian'
        : user.role === 'chef'
        ? '/portal/kitchen'
        : user.role === 'delivery'
        ? '/portal/delivery'
        : user.role === 'admin'
        ? '/portal/admin'
        : '/portal/patient';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Marketing & Smart Meal Marketplace Shell */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/meals/:id" element={<MealDetailPage />} />
            <Route path="/dietitians" element={<DietitianDirectoryPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/how-it-works" element={<InfoStaticPage variant="how" />} />
            <Route path="/about" element={<InfoStaticPage variant="about" />} />
            <Route path="/nutrition-approach" element={<InfoStaticPage variant="approach" />} />
            <Route path="/faq" element={<InfoStaticPage variant="faq" />} />
            <Route path="/contact" element={<InfoStaticPage variant="contact" />} />
            <Route path="/privacy" element={<InfoStaticPage variant="privacy" />} />
            <Route path="/terms" element={<InfoStaticPage variant="terms" />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Role-Scoped Clinical & Operational Workspaces */}
          <Route
            path="/portal/patient"
            element={
              <ProtectedPortalRoute allowedRoles={['patient']}>
                <PatientPortal />
              </ProtectedPortalRoute>
            }
          />
          <Route
            path="/portal/dietitian"
            element={
              <ProtectedPortalRoute allowedRoles={['dietitian', 'admin']}>
                <DietitianPortal />
              </ProtectedPortalRoute>
            }
          />
          <Route
            path="/portal/kitchen"
            element={
              <ProtectedPortalRoute allowedRoles={['chef', 'admin']}>
                <KitchenPortal />
              </ProtectedPortalRoute>
            }
          />
          <Route
            path="/portal/delivery"
            element={
              <ProtectedPortalRoute allowedRoles={['delivery', 'admin']}>
                <DeliveryPortal />
              </ProtectedPortalRoute>
            }
          />
          <Route
            path="/portal/admin"
            element={
              <ProtectedPortalRoute allowedRoles={['admin']}>
                <AdminPortal />
              </ProtectedPortalRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
