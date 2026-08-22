import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

function loadOptionalAnalytics() {
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT?.trim().replace(/\/+$/, "");
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID?.trim();
  if (!endpoint || !websiteId || document.querySelector("script[data-bob-analytics]")) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `${endpoint}/umami`;
  script.dataset.websiteId = websiteId;
  script.dataset.bobAnalytics = "true";
  document.head.append(script);
}

loadOptionalAnalytics();

const queryClient = new QueryClient();

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
