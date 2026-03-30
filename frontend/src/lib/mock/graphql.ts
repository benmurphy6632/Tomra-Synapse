// .env.local --placeholder in here for now.
const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || '/mockAPI/graphql';

export async function graphqlQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify ({
            query,
            variables,
        }),
        cache: 'no-store',
    });

    if(!res.ok){
        throw new Error(`GraphQL request failed: ${res.statusText}`);
    }

    const json = await res.json();

    if(json.errors) {
        console.error('GraphQL Errors: ', json.errors);
        throw new Error(json.errors[0]?.message || 'Query failed');
    }

    return json.data;
}