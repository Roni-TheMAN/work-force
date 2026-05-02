import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import type { PropertyPayrollDetailPdfReport } from "./property-payroll-detail-report";

function resolvePythonExecutable(): string {
  if (process.env.PYTHON_EXECUTABLE) {
    return process.env.PYTHON_EXECUTABLE;
  }

  const bundledWindowsPython = path.join(
    os.homedir(),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "python",
    "python.exe"
  );

  if (existsSync(bundledWindowsPython)) {
    return bundledWindowsPython;
  }

  return "python";
}

function resolveRendererScriptPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "scripts", "render_property_payroll_detail_pdf.py"),
    path.resolve(process.cwd(), "backend", "scripts", "render_property_payroll_detail_pdf.py"),
  ];

  const resolvedPath = candidates.find((candidate) => existsSync(candidate));

  if (!resolvedPath) {
    throw new Error("Property payroll detail PDF renderer script not found.");
  }

  return resolvedPath;
}

export async function renderPropertyPayrollDetailPdf(report: PropertyPayrollDetailPdfReport): Promise<Buffer> {
  const pythonExecutable = resolvePythonExecutable();
  const rendererScriptPath = resolveRendererScriptPath();

  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(pythonExecutable, [rendererScriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Property payroll detail PDF renderer failed with exit code ${code}: ${Buffer.concat(stderrChunks)
              .toString("utf8")
              .trim()}`
          )
        );
        return;
      }

      resolve(Buffer.concat(stdoutChunks));
    });

    child.stdin.write(JSON.stringify(report));
    child.stdin.end();
  });
}
