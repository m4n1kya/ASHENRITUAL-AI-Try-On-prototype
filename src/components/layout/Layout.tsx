import { Outlet } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

/**
 * Persistent app shell. Navbar and Footer stay mounted across route changes
 * while <Outlet /> swaps in the active page, so nav state (e.g. scroll
 * listener) doesn't reset on navigation.
 */
export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-void">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
