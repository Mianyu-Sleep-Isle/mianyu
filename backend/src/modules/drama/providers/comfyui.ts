export interface WorkflowNode {
  inputs?: Record<string, unknown>;
  _meta?: { title?: string };
}

export function patchWorkflow(workflow: Record<string, WorkflowNode>, patch: {
  positive: string;
  negative: string;
  seed: number;
  width: number;
  height: number;
  filenamePrefix: string;
}): Record<string, WorkflowNode> {
  const copy = structuredClone(workflow);
  const titles = new Set<string>();
  for (const node of Object.values(copy)) {
    const title = node._meta?.title;
    if (!title || !node.inputs) continue;
    titles.add(title);
    if (title === 'positive') node.inputs.text = patch.positive;
    if (title === 'negative') node.inputs.text = patch.negative;
    if (title === 'sampler') node.inputs.seed = patch.seed;
    if (title === 'latent') {
      node.inputs.width = patch.width;
      node.inputs.height = patch.height;
    }
    if (title === 'save') node.inputs.filename_prefix = patch.filenamePrefix;
  }
  for (const required of ['positive', 'negative', 'sampler', 'latent', 'save']) {
    if (!titles.has(required)) throw new Error(`workflow missing ${required}`);
  }
  return copy;
}

export async function renderWithComfy(baseUrl: string, workflow: Record<string, WorkflowNode>, clientId: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const root = baseUrl.replace(/\/$/, '');
  const submitted = await fetchImpl(`${root}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });
  if (!submitted.ok) throw new Error(`comfy prompt ${submitted.status}`);
  const body = await submitted.json() as { prompt_id?: string };
  const promptId = body.prompt_id;
  if (!promptId) throw new Error('comfy missing prompt_id');
  const started = Date.now();
  while (Date.now() - started < 180_000) {
    const history = await fetchImpl(`${root}/history/${promptId}`);
    if (!history.ok) throw new Error(`comfy history ${history.status}`);
    const payload = await history.json() as Record<string, { outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> }>;
    const images = Object.values(payload[promptId]?.outputs ?? {}).flatMap((output) => output.images ?? []);
    const image = images[0];
    if (image) {
      const view = new URL(`${root}/view`);
      view.searchParams.set('filename', image.filename);
      view.searchParams.set('subfolder', image.subfolder ?? '');
      view.searchParams.set('type', image.type ?? 'output');
      const file = await fetchImpl(view);
      if (!file.ok) throw new Error(`comfy view ${file.status}`);
      return Buffer.from(await file.arrayBuffer());
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('comfy timeout');
}
