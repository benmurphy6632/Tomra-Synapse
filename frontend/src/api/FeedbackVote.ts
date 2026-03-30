export type FeedbackVote = {
  resultId: string;
  projectId: string;
  model: string;
  imageName: string;
  deviceId: string;
  imageURL: string;
  vote: "UP" | "DOWN" | "UNSURE";
};

const FEEDBACK_VOTES_QUERY = `
  query FeedbackVote($projectId: String!) {
    feedbackVotes(projectId: $projectId) {
      resultId
      projectId
      model
      imageName
      deviceId
      imageURL
      vote
    }
  }
`;

export async function fetchFeedbackVotes(projectId: string): Promise<FeedbackVote[]> {
  const endpoint =
    process.env.NEXT_PUBLIC_GRAPHQL_URL!;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: FEEDBACK_VOTES_QUERY,
        variables: { projectId },
      }),
      cache: "no-store",
    });

    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.feedbackVotes ?? [];
  } catch {
    return [];
  }
}