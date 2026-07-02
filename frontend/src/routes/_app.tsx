import { createFileRoute, Outlet } from "@tanstack/react-router";
import Footer from "../components/footer";
import Header from "../components/header";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}
