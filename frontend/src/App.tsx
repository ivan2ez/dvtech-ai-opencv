import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { CustomerLayout } from './components/layouts/CustomerLayout';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { PublicLayout } from './components/layouts/PublicLayout';
import { Toaster } from './components/ui/sonner';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { ManageProducts } from './pages/admin/ManageProducts';
import { ManageBrands } from './pages/admin/ManageBrands';
import { ManageBtuFactors } from './pages/admin/ManageBtuFactors';
import { ManageServices } from './pages/admin/ManageServices';
import { ManageQuotations } from './pages/admin/ManageQuotations';
import { ProductsPage } from './pages/public/ProductsPage';
import { ServicesPage } from './pages/public/ServicesPage';
import { ServiceRequestForm } from './pages/customer/ServiceRequestForm';
import { MyRequests } from './pages/customer/MyRequests';
import { MyQuotations } from './pages/customer/MyQuotations';
import { ManageRequests } from './pages/admin/ManageRequests';
import { ManageSchedules } from './pages/admin/ManageSchedules';
import { MyTasks } from './pages/technician/MyTasks';
import { TaskDetail } from './pages/technician/TaskDetail';
import { AiRecommendation } from './pages/customer/AiRecommendation';
import { ChatPage } from './pages/customer/ChatPage';
import { Troubleshooting } from './pages/customer/Troubleshooting';
import { Reports } from './pages/admin/Reports';
import { ManageAccounts } from './pages/admin/ManageAccounts';
import { HomePage } from './pages/public/HomePage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProfilePage } from './pages/ProfilePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Public routes with navbar */}
        <Route element={<PublicLayout />}>
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/products" element={<ProductsPage />} />
        </Route>

        {/* Profile route - accessible to all authenticated users */}
        <Route element={<ProtectedRoute allowedRoles={['customer', 'admin', 'technician']} />}>
          <Route element={<CustomerLayout />}>
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Customer routes */}
        <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
          <Route element={<CustomerLayout />}>
            <Route path="/service-request" element={<ServiceRequestForm />} />
            <Route path="/my-requests" element={<MyRequests />} />
            <Route path="/my-quotations" element={<MyQuotations />} />
            <Route path="/ai-recommendation" element={<AiRecommendation />} />
            <Route path="/troubleshooting" element={<Troubleshooting />} />
            <Route path="/chat" element={<ChatPage />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/requests" element={<ManageRequests />} />
            <Route path="/admin/schedules" element={<ManageSchedules />} />
            <Route path="/admin/quotations" element={<ManageQuotations />} />
            <Route path="/admin/products" element={<ManageProducts />} />
            <Route path="/admin/brands" element={<ManageBrands />} />
            <Route path="/admin/services" element={<ManageServices />} />
            <Route path="/admin/btu-factors" element={<ManageBtuFactors />} />
            <Route path="/admin/accounts" element={<ManageAccounts />} />
            <Route path="/admin/reports" element={<Reports />} />
          </Route>
        </Route>

        {/* Technician routes */}
        <Route element={<ProtectedRoute allowedRoles={['technician']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/technician" element={<Navigate to="/technician/tasks" replace />} />
            <Route path="/technician/tasks" element={<MyTasks />} />
            <Route path="/technician/tasks/:id" element={<TaskDetail />} />
          </Route>
        </Route>
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

export default App;
