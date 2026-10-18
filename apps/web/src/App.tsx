import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { AppLayout } from "./components/AppLayout.tsx";
import { LoginPage } from "./features/auth/LoginPage.tsx";
import { RequireAuth } from "./features/auth/RequireAuth.tsx";
import { OrdersPage } from "./features/orders/OrdersPage.tsx";

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/orders",
    element: (
      <RequireAuth>
        <AppLayout>
          <OrdersPage />
        </AppLayout>
      </RequireAuth>
    ),
  },
  { path: "*", element: <Navigate to="/orders" replace /> },
]);

export const App = () => <RouterProvider router={router} />;
