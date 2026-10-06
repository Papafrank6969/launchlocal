import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored Draco decoder (from three/examples), served to /villa.
    "public/draco/**",
    // Remotion subproject, own deps and tsconfig.
    "video/**",
    // Reference-only scripts for Frank's 3D house prototype (not app code).
    "docs/house-prototype/**",
  ]),
]);

export default eslintConfig;
