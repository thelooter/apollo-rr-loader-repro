import { PassThrough } from "node:stream";

import { ApolloProvider } from "@apollo/client/react";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { makeClient } from "./apollo";

// This is the value `react-router reveal` scaffolds. Raise it to 30_000 to see
// hydration succeed — and the ~5.5s TTFB that the default was masking.
export const streamTimeout = Number(process.env.STREAM_TIMEOUT ?? 5_000);

export default function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	routerContext: EntryContext,
) {
	return new Promise((resolve, reject) => {
		let shellRendered = false;
		const userAgent = request.headers.get("user-agent");

		const readyOption: keyof RenderToPipeableStreamOptions =
			(userAgent && isbot(userAgent)) || routerContext.isSpaMode
				? "onAllReady"
				: "onShellReady";

		let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
			() => abort(),
			streamTimeout + 1000,
		);

		const { pipe, abort } = renderToPipeableStream(
			<ApolloProvider client={makeClient(request)}>
				<ServerRouter context={routerContext} url={request.url} />
			</ApolloProvider>,
			{
				[readyOption]() {
					shellRendered = true;
					const body = new PassThrough({
						final(callback) {
							clearTimeout(timeoutId);
							timeoutId = undefined;
							callback();
						},
					});
					responseHeaders.set("Content-Type", "text/html");
					pipe(body);
					resolve(
						new Response(createReadableStreamFromReadable(body), {
							headers: responseHeaders,
							status: responseStatusCode,
						}),
					);
				},
				onShellError(error: unknown) {
					reject(error);
				},
				onError(error: unknown) {
					responseStatusCode = 500;
					if (shellRendered) {
						console.error(error);
					}
				},
			},
		);
	});
}
