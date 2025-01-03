import { defineConfig, type Options } from "tsup";
import fs from "node:fs";
import inlineWorkerPlugin from "esbuild-plugin-inline-worker";

const banner = `/**
 * @license bippy
 *
 * Copyright (c) Aiden Bai, Million Software, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */`;

/**
 * @see https://gist.github.com/manzt/689e4937f5ae998c56af72efc9217ef0
 *
 * @param {Pick<import('esbuild').BuildOptions, 'minify' | 'format' | 'plugins'>}
 * @return {import('esbuild').Plugin}
 */

const DEFAULT_OPTIONS: Options = {
	entry: [],
	banner: {
		js: banner,
	},
	clean: true,
	outDir: "./dist",
	splitting: false,
	sourcemap: false,
	format: [],
	target: "esnext",
	platform: "browser",
	treeshake: true,
	dts: true,
	minify: false,
	env: {
		NODE_ENV: process.env.NODE_ENV ?? "development",
		VERSION: JSON.parse(fs.readFileSync("package.json", "utf8")).version,
	},
	esbuildPlugins: [inlineWorkerPlugin()],
	external: ["react", "react-dom", "react-reconciler"],
};

export default defineConfig([
	{
		...DEFAULT_OPTIONS,
		format: ["esm", "cjs"],
		entry: ["./src/index.ts", "./src/core.ts", "./src/scan/index.ts"],
	},
	{
		...DEFAULT_OPTIONS,
		format: ["iife"],
		minify: process.env.NODE_ENV === "production" ? "terser" : false,
		globalName: "Bippy",
		entry: ["./src/index.ts", "./src/core.ts"],
	},
	{
		...DEFAULT_OPTIONS,
		format: ["iife"],
		minify: process.env.NODE_ENV === "production" ? "terser" : false,
		globalName: "ReactScan",
		entry: ["./src/scan/index.ts"],
	},
]);
