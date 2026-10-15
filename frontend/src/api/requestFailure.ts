// Messages for failures that carry no server-provided message: the browser
// could not reach the API, or a proxy answered with a body that is not JSON.
// Each tells the viewer what happened and what to do next.
export const NETWORK_FAILURE_MESSAGE =
  "We can't reach the server. Check your connection, then try again.";

export function fallbackErrorMessage(status: number): string {
  return status >= 500
    ? "The service is temporarily unavailable. Please try again in a moment."
    : "We couldn't complete that request. Please try again.";
}
