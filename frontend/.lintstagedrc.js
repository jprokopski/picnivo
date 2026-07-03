export default {
  "*.{ts,tsx}": (files) => [
    `eslint --fix ${files.join(" ")}`,
    `prettier --write ${files.join(" ")}`,
    `vitest related ${files.join(" ")} --run`,
    "tsc --noEmit",
  ],
  "*.{js,jsx,json,css,md}": (files) => [`prettier --write ${files.join(" ")}`],
};
