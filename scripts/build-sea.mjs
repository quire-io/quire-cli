#!/usr/bin/env node
// Build a Node SEA (Single Executable Application) binary for a target
// platform/arch. Used by CI on tagged releases (one invocation per
// matrix entry) and by `npm run package` for local development.
//
// Why SEA + an esbuild bundle step? The CLI is ESM (uses `@quire-io/api-client`
// which is ESM-only), so CJS-based packagers like @yao-pkg/pkg can't resolve
// it. SEA is ESM-aware and ships with Node 20+; esbuild bundles our source
// + dependencies into a single CJS file that the SEA blob points at.
//
// Pipeline:
//   1. esbuild: src/cli.ts + node_modules → dist-sea/bundle.cjs (single CJS
//      file; version inlined via --define so the runtime doesn't need a
//      sibling package.json).
//   2. node --experimental-sea-config → dist-sea/sea-prep.blob.
//   3. cp <node-binary> dist-bin/<output>; on macOS, strip xattrs +
//      existing signature so postject can rewrite the Mach-O.
//   4. npx postject: inject the blob into the binary at the SEA fuse.
//   5. macOS: ad-hoc resign so Sequoia will load the binary at all.
//      CI overwrites this with the real Developer ID signature.

import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEA_DIR = resolve(ROOT, "dist-sea");
const BIN_DIR = resolve(ROOT, "dist-bin");

// Standard sentinel fuse for Node SEA. Hard-coded in Node's source
// (see lib/internal/sea.js); identical across Node 20+.
const SEA_FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

// Node version we download when --node-binary is omitted. Pinned to a
// recent LTS so SEA semantics stay stable. Bump when a new LTS lands.
const DEFAULT_NODE_VERSION = "v22.10.0";

function parseArgs(argv) {
  const out = {
    output: "quire",
    nodeBinary: undefined,
    platform: process.platform,
    arch: process.arch,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--output") out.output = next();
    else if (arg === "--node-binary") out.nodeBinary = resolve(next());
    else if (arg === "--platform") out.platform = next();
    else if (arg === "--arch") out.arch = next();
    else if (arg === "--help" || arg === "-h") {
      process.stderr.write(usage());
      process.exit(0);
    } else {
      process.stderr.write(`Unknown arg: ${arg}\n${usage()}`);
      process.exit(2);
    }
  }
  return out;
}

function usage() {
  return `Usage: node scripts/build-sea.mjs [options]

Options:
  --output <name>         Output binary name (relative to dist-bin/, default: quire)
  --node-binary <path>    Node binary to inject into. If omitted, the official
                          Node ${DEFAULT_NODE_VERSION} for --platform/--arch is downloaded into
                          dist-sea/cache/. Required because some packaged Node
                          binaries (e.g. homebrew) ship without the SEA fuse.
  --platform <name>       Target platform: darwin | linux | win32 (default: current).
                          Affects whether codesign / postject Mach-O flags run.
  --arch <name>           Target arch: arm64 | x64 (default: current).
  -h, --help              Show this help
`;
}

function run(cmd, args, opts = {}) {
  process.stderr.write(`> ${cmd} ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}\n`);
  return execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

function nodeDownloadUrl(version, platform, arch) {
  // Node ships pre-built tarballs at https://nodejs.org/dist/<version>/
  // The naming convention follows `node-<version>-<os>-<arch>.<ext>`.
  const osTag = platform === "darwin" ? "darwin" : platform === "win32" ? "win" : "linux";
  const ext = platform === "win32" ? "zip" : "tar.gz";
  return `https://nodejs.org/dist/${version}/node-${version}-${osTag}-${arch}.${ext}`;
}

function ensureNodeBinary(platform, arch) {
  const cacheRoot = resolve(SEA_DIR, "cache");
  mkdirSync(cacheRoot, { recursive: true });
  const osTag = platform === "darwin" ? "darwin" : platform === "win32" ? "win" : "linux";
  const dirname = `node-${DEFAULT_NODE_VERSION}-${osTag}-${arch}`;
  const extractedRoot = resolve(cacheRoot, dirname);
  const binPath = platform === "win32"
    ? resolve(extractedRoot, "node.exe")
    : resolve(extractedRoot, "bin", "node");
  if (existsSync(binPath)) return binPath;

  process.stderr.write(`Downloading Node ${DEFAULT_NODE_VERSION} for ${osTag}-${arch}…\n`);
  const url = nodeDownloadUrl(DEFAULT_NODE_VERSION, platform, arch);
  if (platform === "win32") {
    const zipPath = resolve(cacheRoot, `${dirname}.zip`);
    run("curl", ["-fsSL", "-o", zipPath, url]);
    run("unzip", ["-q", "-o", zipPath, "-d", cacheRoot]);
  } else {
    const tarPath = resolve(cacheRoot, `${dirname}.tar.gz`);
    run("curl", ["-fsSL", "-o", tarPath, url]);
    run("tar", ["xzf", tarPath, "-C", cacheRoot]);
  }
  if (!existsSync(binPath)) {
    throw new Error(`Downloaded Node archive but binary not found at ${binPath}`);
  }
  return binPath;
}

async function main() {
  const opts = parseArgs(process.argv);
  mkdirSync(SEA_DIR, { recursive: true });
  mkdirSync(BIN_DIR, { recursive: true });

  // Resolve / download the Node binary template before bundling. Some
  // distros' Node (e.g. homebrew) ship without the SEA fuse, so we never
  // fall back to process.execPath silently — either the user passes
  // --node-binary, or we download the pinned official LTS.
  if (opts.nodeBinary === undefined) {
    opts.nodeBinary = ensureNodeBinary(opts.platform, opts.arch);
  }

  // 1. Bundle src/cli.ts into a single CJS file. esbuild handles the ESM
  // → CJS conversion + dependency walking. Inline the version so the
  // bundled binary doesn't need a sibling package.json (readVersion()'s
  // original strategy).
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const bundlePath = resolve(SEA_DIR, "bundle.cjs");
  await esbuild.build({
    entryPoints: [resolve(ROOT, "src/cli.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: bundlePath,
    define: {
      "process.env.QUIRE_CLI_VERSION": JSON.stringify(pkg.version),
      // src/version.ts uses `import.meta.url` only in the dev fallback
      // path (which is unreachable when QUIRE_CLI_VERSION is set, as it
      // is here). esbuild can't prove the gate, so it warns. Supply an
      // empty-string substitute to silence the warning without affecting
      // runtime behavior — the BUILD_TIME_VERSION branch always wins.
      "import.meta.url": "\"\"",
    },
    // The shebang is meaningless in a SEA payload (Node parses the blob
    // directly); strip the entry's shebang line by setting `banner` empty.
    banner: { js: "" },
    legalComments: "none",
    minify: false,
  });

  // 2. SEA config + blob. `useSnapshot: false` keeps the bundle small; flipping
  // it requires the entry to be a self-contained snapshot, which our async
  // entry point isn't.
  const seaConfigPath = resolve(SEA_DIR, "sea-config.json");
  const blobPath = resolve(SEA_DIR, "sea-prep.blob");
  const seaConfig = {
    main: bundlePath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
  };
  writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));
  // Use the *target* Node binary to generate the blob, not the system's
  // current Node — the SEA blob format can drift between Node majors,
  // so the version that creates the blob must match the version that
  // will load it.
  run(opts.nodeBinary, ["--experimental-sea-config", seaConfigPath]);

  // 3. Copy the Node binary template to dist-bin/<output>. Remove any prior
  // build first — copyFileSync can't overwrite read-only files, and the
  // homebrew-installed node we copy from is itself read-only. Force writable
  // mode after the copy.
  const outPath = resolve(BIN_DIR, opts.output);
  if (existsSync(outPath)) unlinkSync(outPath);
  copyFileSync(opts.nodeBinary, outPath);
  chmodSync(outPath, 0o755);

  // 4. macOS only: strip the existing signature + the `com.apple.provenance`
  // xattr that Sequoia adds to copied executables. Both block postject's
  // Mach-O rewriting. We re-sign in CI after injection.
  if (opts.platform === "darwin") {
    try {
      run("xattr", ["-cr", outPath]);
    } catch {
      // xattr is macOS-only; if missing or no xattrs to clear, that's fine.
    }
    run("codesign", ["--remove-signature", outPath]);
  }

  // 5. Inject the blob via postject.
  const postjectArgs = [
    "postject",
    outPath,
    "NODE_SEA_BLOB",
    blobPath,
    "--sentinel-fuse",
    SEA_FUSE,
  ];
  if (opts.platform === "darwin") {
    postjectArgs.push("--macho-segment-name", "NODE_SEA");
  }
  run("npx", ["--yes", ...postjectArgs]);

  // 6. macOS only: ad-hoc resign so the kernel will load the binary at all.
  // Without any signature, Sequoia kills the process with SIGKILL on launch.
  // CI overwrites this with the real Developer ID signature for releases.
  if (opts.platform === "darwin") {
    run("codesign", ["--sign", "-", outPath]);
  }

  process.stderr.write(`\nBuilt ${outPath}\n`);
}

main().catch((err) => {
  process.stderr.write(`build-sea failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
