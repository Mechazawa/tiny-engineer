import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

const controlFlow = [
  "if",
  "for",
  "while",
  "do",
  "switch",
  "try",
  "return",
  "throw",
  "break",
  "continue",
];

export default [
  { ignores: ["dist/"] },
  js.configs.recommended,
  {
    plugins: { "@stylistic": stylistic },
    languageOptions: { globals: globals.browser },
    rules: {
      curly: ["error", "all"],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-arrow-callback": "error",
      "prefer-const": "error",
      "prefer-template": "error",
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: controlFlow },
        { blankLine: "always", prev: "block-like", next: "*" },
        { blankLine: "always", prev: ["const", "let"], next: "*" },
        { blankLine: "any", prev: ["const", "let"], next: ["const", "let"] },
      ],
    },
  },
  {
    files: ["*.config.js"],
    languageOptions: { globals: globals.node },
  },
];
