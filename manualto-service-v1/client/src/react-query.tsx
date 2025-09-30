import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FC } from "react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"


export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            refetchIntervalInBackground: false,
            retry: 3,
        },
        mutations: {
            retry: 3,
        }
    }
});

export const ReactQueryProvider: FC = ({ children }) => {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}