// Zero-dependency GraphQL endpoint. Returns canned data for the single query
// used by the repro, so the measured latency is the transport's, not the API's.
import http from "node:http";

const PORT = Number(process.env.PORT ?? 4000);
// Simulate a slow backend. The interesting threshold is React Router's
// `streamTimeout` (default 4950ms in `encodeViaTurboStream`).
const DELAY_MS = Number(process.env.DELAY_MS ?? 0);

const items = Array.from({ length: 20 }, (_, i) => ({
	__typename: "Item",
	id: String(i + 1),
	name: `Item ${i + 1}`,
	value: (i + 1) * 111,
}));

const payload = {
	data: {
		itemList: {
			__typename: "ItemList",
			total: 1425119,
			items,
		},
	},
};

let count = 0;

http
	.createServer((req, res) => {
		if (req.method === "OPTIONS") {
			res.writeHead(204, {
				"access-control-allow-origin": "*",
				"access-control-allow-headers": "*",
				"access-control-allow-methods": "POST, OPTIONS",
			}).end();
			return;
		}

		const chunks = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => {
			let op = "?";
			try {
				op = JSON.parse(Buffer.concat(chunks).toString()).operationName ?? "?";
			} catch {}
			count += 1;
			const ua = req.headers["user-agent"] ?? "none";
			console.log(
				`[${count}] ${req.method} op=${op} from=${ua.includes("Chrome") ? "browser" : "server"} delay=${DELAY_MS}ms`,
			);
			setTimeout(() => {
				res.writeHead(200, {
					"content-type": "application/json",
					"access-control-allow-origin": "*",
				});
				res.end(JSON.stringify(payload));
			}, DELAY_MS);
		});
	})
	.listen(PORT, () =>
		console.log(`mock GraphQL API on http://localhost:${PORT}/graphql`),
	);
