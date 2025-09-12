/* eslint-env node */
module.exports = {
  root: true,
  env: { es2023: true, node: true, browser: true },
  parser: "vue-eslint-parser",
  parserOptions: {
    parser: "@typescript-eslint/parser",
    ecmaVersion: 2023,
    sourceType: "module",
    ecmaFeatures: { jsx: false }
  },
  extends: [
    "plugin:vue/vue3-recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  rules: {
    "vue/multi-word-component-names": "off"
  },
  ignorePatterns: [
    "**/dist/**",
    "**/.quasar/**",
    "**/playwright-report/**",
    "**/test-results/**"
  ]
};

