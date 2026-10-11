import { DurableObject } from "cloudflare:workers";

type Env = { BUILD_SANDBOX: DurableObjectNamespace<BuildSandbox> };
const REPO = "https://github.com/takraw369/masahiro-yamada-com.git";
const DEFAULT_REF = "master";
const decoder = new TextDecoder();

export class BuildSandbox extends DurableObject<Env> {
  private async run(cmd: string[], cwd?: string) {
    const process = await this.ctx.container!.exec(cmd, cwd ? { cwd } : undefined);
    const output = await process.output();
    return {
      command: cmd,
      exitCode: output.exitCode,
      stdout: decoder.decode(output.stdout).slice(-12000),
      stderr: decoder.decode(output.stderr).slice(-12000),
    };
  }

  async health() {
    return { ok: true, running: Boolean(this.ctx.container?.running) };
  }

  async build(ref: string) {
    if (!/^[a-zA-Z0-9._/-]{1,120}$/.test(ref) || ref.startsWith("-") || ref.includes("..")) {
      throw new Error("Invalid ref");
    }
    const container = this.ctx.container;
    if (!container) throw new Error("Container binding missing");
    if (!container.running) container.start({ enableInternet: true });
    await container.setInactivityTimeout(10 * 60 * 1000);
    const steps = [
      ["git", "clone", "--depth", "1", "--branch", ref, REPO, "/workspace/repo"],
      ["npm", "ci", "--ignore-scripts"],
      ["npm", "test"],
      ["npm", "run", "build"],
    ];
    const results = [];
    for (const [i, command] of steps.entries()) {
      const result = await this.run(command, i === 0 ? undefined : "/workspace/repo");
      results.push(result);
      if (result.exitCode !== 0) break;
    }
    return { ok: results.length === steps.length && results.every(r => r.exitCode === 0), ref, results };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // Worker is service-binding only; workers_dev is disabled in Wrangler.
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({ ok: true, service: "masa-sandbox-runner", containerStarted: false });
    }
    if (url.pathname !== "/build" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }
    const body = await request.json().catch(() => null) as { taskId?: string; ref?: string } | null;
    if (!body?.taskId || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.taskId)) {
      return Response.json({ error: "Invalid taskId" }, { status: 400 });
    }
    const sandbox = env.BUILD_SANDBOX.get(env.BUILD_SANDBOX.idFromName(body.taskId));
    try {
      return Response.json(await sandbox.build(body.ref ?? DEFAULT_REF));
    } catch (error) {
      return Response.json({ ok: false, error: String(error) }, { status: 500 });
    }
  },
};
