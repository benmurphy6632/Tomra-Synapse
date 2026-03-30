export type AvailableModel = {
  name: string;
  status?: "Stable" | "Canary" | "Archived";
};

const GRAPHQL_QUERY = `
  query {
    availableModels {
      name
    }
  }
`;

export async function fetchAvailableModels(): Promise<AvailableModel[]> {
  const endpoint =
    process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:8080/graphql";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: GRAPHQL_QUERY }),
  });

  const json = await response.json();
  return json.data?.availableModels ?? [];
}