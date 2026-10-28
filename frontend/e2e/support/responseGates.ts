import { expect, type APIRequestContext } from "@playwright/test";

type GateResponse = { path: string; method: string; status: number };
type GateState = { responses: GateResponse[]; completed: number; aborted: number; pending: number };

async function readGate(request: APIRequestContext, controls: string, name: string): Promise<GateState> {
  const response = await request.get(`${controls}/gates/${name}`);
  expect(response.status(), `inspect gate ${name}`).toBe(200);
  return response.json();
}

export async function waitForResponseGate(
  request: APIRequestContext, controls: string, name: string, apiPath: string,
): Promise<void> {
  await expect.poll(async () => {
    const gate = await readGate(request, controls, name);
    expect(gate.responses.every(row => row.path === apiPath && row.method === "GET" && row.status === 200),
      `gate ${name} contains only successful GETs for ${apiPath}`).toBe(true);
    return gate.responses.length;
  }).toBeGreaterThan(0);
}

export async function releaseResponseGate(request: APIRequestContext, controls: string, name: string) {
  expect((await request.post(`${controls}/gates/${name}/release`)).status()).toBe(200);
  // More requests may already be computing when capture is sealed. Observe
  // their actual lifecycle, not a fixed count or an arbitrary sleep.
  await expect.poll(async () => {
    const gate = await readGate(request, controls, name);
    // A cancellation may precede capture, so terminal counts can exceed captured
    // responses. Every selected request must have left the middleware.
    return gate.pending === 0 && gate.responses.length > 0 &&
      gate.completed + gate.aborted >= gate.responses.length;
  }).toBe(true);
}
