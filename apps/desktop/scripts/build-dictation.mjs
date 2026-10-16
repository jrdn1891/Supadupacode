import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";

// oxlint-disable-next-line supacode/no-global-process-runtime -- The Swift compiler targets the actual host; this script has no Effect runtime.
const hostArch = process.arch;
// oxlint-disable-next-line supacode/no-global-process-runtime -- Speech transcription only builds on the actual macOS host.
const hostPlatform = process.platform;

const { values } = NodeUtil.parseArgs({
  options: { output: { type: "string" }, arch: { type: "string", default: hostArch } },
});

if (hostPlatform === "darwin") {
  const targets = { arm64: ["arm64"], x64: ["x86_64"], universal: ["arm64", "x86_64"] }[
    values.arch
  ];
  if (targets === undefined) throw new Error(`Unsupported macOS architecture: ${values.arch}`);
  const root = NodeURL.fileURLToPath(new URL("../../../native/dictation/", import.meta.url));
  const source = NodePath.resolve(root, "main.swift");
  const output =
    values.output ?? NodePath.resolve(root, "build", values.arch, "supacode-dictation");
  let current = false;
  try {
    current =
      NodeFS.statSync(output).mtimeMs >=
      Math.max(
        NodeFS.statSync(source).mtimeMs,
        NodeFS.statSync(NodeURL.fileURLToPath(import.meta.url)).mtimeMs,
      );
  } catch {
    /* The first build has no output yet. */
  }
  if (!current) {
    NodeFS.mkdirSync(NodePath.dirname(output), { recursive: true });
    const temporaries = targets.map((target) => `${output}.${target}.${process.pid}.tmp`);
    try {
      targets.forEach((target, index) =>
        NodeChildProcess.execFileSync(
          "xcrun",
          [
            "swiftc",
            "-O",
            "-target",
            `${target}-apple-macos26.0`,
            source,
            "-o",
            temporaries[index],
          ],
          { stdio: "inherit" },
        ),
      );
      NodeChildProcess.execFileSync("lipo", [
        "-create",
        ...temporaries,
        "-output",
        `${output}.${process.pid}.tmp`,
      ]);
      NodeFS.renameSync(`${output}.${process.pid}.tmp`, output);
    } finally {
      for (const temporary of [...temporaries, `${output}.${process.pid}.tmp`])
        NodeFS.rmSync(temporary, { force: true });
    }
  }
}
