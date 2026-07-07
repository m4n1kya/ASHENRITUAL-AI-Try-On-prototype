import { Route, Routes } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Landing from "@/pages/Landing";
import TryOn from "@/pages/TryOn";
import About from "@/pages/About";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/try-on" element={<TryOn />} />
        <Route path="/about" element={<About />} />
      </Route>
    </Routes>
  );
}

export default App;
