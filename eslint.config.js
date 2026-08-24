import path from "node:path";
import tseslint from "typescript-eslint";

const coreRoot = path.resolve("src/core");
const cliRoot = path.resolve("src/cli");

const coreBoundaryRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Keep core module references inside src/core.",
    },
    schema: [],
  },
  create(context) {
    const reportIfOutsideCore = (node, sourceNode) => {
      const specifier = sourceNode?.value ?? sourceNode?.literal?.value;
      if (typeof specifier !== "string") {
        return;
      }

      const filePath = context.getFilename();
      const resolved = path.resolve(path.dirname(filePath), specifier);
      const relative = path.relative(coreRoot, resolved);
      const typesRoot = path.resolve("src/types");
      const isInsideCore =
        (relative !== "" && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) ||
        resolved === typesRoot ||
        resolved.startsWith(`${typesRoot}${path.sep}`);

      if (!isInsideCore) {
        context.report({
          node,
          message: "core references must resolve to a module inside src/core.",
        });
      }
    };

    return {
      ImportDeclaration(node) {
        reportIfOutsideCore(node, node.source);
      },
      ExportAllDeclaration(node) {
        reportIfOutsideCore(node, node.source);
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          reportIfOutsideCore(node, node.source);
        }
      },
      ImportExpression(node) {
        reportIfOutsideCore(node, node.source);
      },
      TSImportType(node) {
        reportIfOutsideCore(node, node.argument);
      },
    };
  },
};

const adaptersBoundaryRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Keep adapters from depending on the CLI layer.",
    },
    schema: [],
  },
  create(context) {
    const reportIfCli = (node, sourceNode) => {
      const specifier = sourceNode?.value ?? sourceNode?.literal?.value;
      if (typeof specifier !== "string") {
        return;
      }

      const filePath = context.getFilename();
      const resolved = path.resolve(path.dirname(filePath), specifier);
      const relative = path.relative(cliRoot, resolved);
      const isInsideCli =
        relative === "" || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));

      if (isInsideCli) {
        context.report({
          node,
          message: "adapters must not depend on the CLI layer.",
        });
      }
    };

    return {
      ImportDeclaration(node) {
        reportIfCli(node, node.source);
      },
      ExportAllDeclaration(node) {
        reportIfCli(node, node.source);
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          reportIfCli(node, node.source);
        }
      },
      ImportExpression(node) {
        reportIfCli(node, node.source);
      },
      TSImportType(node) {
        reportIfCli(node, node.argument);
      },
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "require") {
          reportIfCli(node, node.arguments[0]);
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!\\.{1,2}/|\\.\\./types/).+",
              message: "core imports must use core-relative paths or shared types.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message: "core must not use dynamic import().",
        },
      ],
      "no-restricted-globals": [
        "error",
        "process",
        "fetch",
        "globalThis",
        "require",
        "__dirname",
        "__filename",
      ],
      "architecture/core-boundary": "error",
    },
    plugins: {
      architecture: {
        rules: {
          "core-boundary": coreBoundaryRule,
        },
      },
    },
  },
  {
    files: ["src/config/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(node:|[^./])",
              message: "config must not import Node built-ins or third-party packages.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message: "config must not use dynamic import().",
        },
        {
          selector: "TSImportType",
          message: "config must not use type imports that bypass its boundary.",
        },
      ],
      "no-restricted-globals": ["error", "process", "fetch", "require", "__dirname", "__filename"],
    },
  },
  {
    files: ["src/adapters/**/*.ts"],
    plugins: {
      architecture: {
        rules: {
          "adapters-boundary": adaptersBoundaryRule,
        },
      },
    },
    rules: {
      "architecture/adapters-boundary": "error",
    },
  },
);
