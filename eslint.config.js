import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Complexity rules
      complexity: ["error", 15],
      "max-lines-per-function": [
        "error",
        { max: 75, skipBlankLines: true, skipComments: true },
      ],
      "max-nested-callbacks": ["error", 4],
      "max-depth": ["error", 4],

      // Code quality
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-explicit-any": "error",

      // Relaxed for common patterns
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
    },
  },
  { ignores: ["dist/", "node_modules/", "*.js"] }
);
