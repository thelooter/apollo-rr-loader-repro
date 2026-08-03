import { gql, type TypedDocumentNode } from "@apollo/client";
import { useReadQuery } from "@apollo/client/react";
import { Suspense } from "react";
import { apolloLoader } from "../apollo";
import type { Route } from "./+types/home";

interface ItemListData {
	itemList: {
		total: number;
		items: Array<{ id: string; name: string; value: number }>;
	};
}

const ITEM_LIST_QUERY: TypedDocumentNode<
	ItemListData,
	Record<string, never>
> = gql`
  query ItemList {
    itemList {
      total
      items {
        id
        name
        value
      }
    }
  }
`;

export const loader = apolloLoader<Route.LoaderArgs>()(({ preloadQuery }) => {
	return { queryRef: preloadQuery(ITEM_LIST_QUERY) };
});

export default function Home({ loaderData }: Route.ComponentProps) {
	return (
		<Suspense fallback={<p id="fallback">loading…</p>}>
			<ItemList queryRef={loaderData.queryRef} />
		</Suspense>
	);
}

function ItemList({
	queryRef,
}: {
	queryRef: Route.ComponentProps["loaderData"]["queryRef"];
}) {
	const { data } = useReadQuery(queryRef);
	return (
		<div>
			<p id="total">{data.itemList.total.toLocaleString("en-US")} items found</p>
			<ul>
				{data.itemList.items.map((item) => (
					<li key={item.id}>
						{item.name} — {item.value}
					</li>
				))}
			</ul>
		</div>
	);
}
