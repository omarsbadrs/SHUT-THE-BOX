import { ResultsClient } from "./results-client";

export default async function ResultsPage(props: PageProps<"/results/[matchId]">) {
  const { matchId } = await props.params;
  return <ResultsClient matchId={matchId} />;
}
