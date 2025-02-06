import globals from "globals";
import pluginJs from "@eslint/js";
import prettier from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.js", "**/*.mjs"], // Also include .mjs files
    ignores: ["**/node_modules/**"], // Exclude node_modules directory
    languageOptions: {
      sourceType: "module", // Set to "module" for ES modules
      ecmaVersion: "latest", // Use the latest ECMAScript version
      globals: {
        ...globals.browser, // Browser environment globals
        ...globals.node,    // Node.js environment globals
        process: "readonly", // Define 'process' as readonly
        __dirname: "readonly", // Define __dirname as readonly
        __filename: "readonly", // Define __filename as readonly
      },
    },
    rules: {
      "no-unused-vars": "warn", // Warn about unused variables
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off", // Warn in production, off in development
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off", // Warn in production, off in development
      // Add more rules as needed
    },
  },
  pluginJs.configs.recommended, // Use ESLint's recommended rules
  {
    plugins: {
      prettier: {
        // Configuration for the eslint-plugin-prettier plugin
        rules: {
          // Enforce that code matches Prettier's style
          "prettier/prettier": "error",
        },
      },
    },
  },
  prettier, // Integrate Prettier
];
