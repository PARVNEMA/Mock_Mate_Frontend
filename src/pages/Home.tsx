import { Outlet } from "react-router-dom";
import Header from "../components/Header.tsx";
import Footer from "../components/Footer.tsx";

function Home() {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}

export default Home;
