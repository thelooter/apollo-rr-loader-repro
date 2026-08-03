import { ApolloHydrationHelper } from "@apollo/client-integration-react-router";
import type { ReactNode } from "react";
import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";

export function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<Meta />
				<Links />
			</head>
			<body>
				<ApolloHydrationHelper>{children}</ApolloHydrationHelper>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	const message = isRouteErrorResponse(error)
		? `${error.status} ${error.statusText}`
		: error instanceof Error
			? error.message
			: "Unknown error";
	return (
		<main>
			<h1 id="error-boundary">Oops!</h1>
			<pre>{message}</pre>
		</main>
	);
}
