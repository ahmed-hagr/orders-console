import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App as AntApp, ConfigProvider } from "antd";
import { StyleProvider } from "@ant-design/cssinjs";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.tsx";
import { queryClient } from "./lib/queryClient.ts";
import { theme } from "./theme.ts";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StyleProvider layer>
      <ConfigProvider theme={theme}>
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </AntApp>
      </ConfigProvider>
    </StyleProvider>
  </StrictMode>,
);
