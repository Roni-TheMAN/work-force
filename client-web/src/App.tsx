import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { AppRouter } from "@/app/router";
import { AppProviders } from "@/providers/app-providers";

function App() {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: "easeOut" }}>
      <AppProviders>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </AppProviders>
    </MotionConfig>
  );
}

export default App;
