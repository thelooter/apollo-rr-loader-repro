import { HttpLink, InMemoryCache } from "@apollo/client";
import {
	ApolloClient,
	createApolloLoaderHandler,
} from "@apollo/client-integration-react-router";

export const makeClient = (_request?: Request) =>
	new ApolloClient({
		cache: new InMemoryCache(),
		link: new HttpLink({ uri: "http://localhost:4000/graphql" }),
	});

export const apolloLoader = createApolloLoaderHandler(makeClient);
