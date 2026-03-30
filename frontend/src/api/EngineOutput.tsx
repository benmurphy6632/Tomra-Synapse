export type EngineOutput = {
  id: string;
  deviceId: string;
  imageName: string;
  predictedLabel: string;
  confidence: number;
  model: string;
  classId: number;
  imageURL: string;
  latency: number;
  powerUsage: number;
  co2Emissions: number;
};

const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:8080/graphql";

const GRAPHQL_QUERY = `
  query EngineOutputs($projectId: String!) {
    engineOutputs(projectId: $projectId) {
      id
      deviceId
      imageName
      predictedLabel
      confidence
      model
      classId
      latency
      imageURL
      powerUsage
      co2Emissions
    }
  }
`;

export async function fetchEngineOutputs(projectId: string): Promise<EngineOutput[]> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: { projectId },
    }),
  });

  const json = await response.json();
  return json.data?.engineOutputs ?? [];
}

const GRAPHQL_QUERY_ALL = `
  query {
    engineOutputsAll {
      id
      deviceId
      imageName
      predictedLabel
      confidence
      model
      classId
      latency
      imageURL
      powerUsage
      co2Emissions
    }
  }
`;

export async function fetchAllEngineOutputs(): Promise<EngineOutput[]> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: GRAPHQL_QUERY_ALL,
    }),
  });

  const json = await response.json();
  return json.data?.engineOutputsAll ?? [];
}