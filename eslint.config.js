const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const { defineConfig } = require('eslint/config');
const unusedImports = require('eslint-plugin-unused-imports');
const pluginJest = require('eslint-plugin-jest');

module.exports = defineConfig(
    eslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
        files: ["**/*.ts"],
        rules: {
            "@typescript-eslint/unbound-method": "off",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/require-await": "off",
            "unused-imports/no-unused-imports": "error",

            "unused-imports/no-unused-vars": ["error", {
                vars: "all",
                varsIgnorePattern: "^_",
                args: "after-used",
                argsIgnorePattern: "^_",
            }],
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
            },
        },
        plugins: {
            "unused-imports": unusedImports,
        }
    },
    {
        files: ["**/*.test.ts"],
        ...pluginJest.configs['flat/recommended'],
        rules: {
            ...pluginJest.configs['flat/recommended'].rules,
            "@typescript-eslint/unbound-method": "off",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/require-await": "off",
            "unused-imports/no-unused-imports": "error",

            "unused-imports/no-unused-vars": ["error", {
                vars: "all",
                varsIgnorePattern: "^_",
                args: "after-used",
                argsIgnorePattern: "^_",
            }],
            "jest/valid-title": "off",
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
            },
        },
        plugins: {
            "unused-imports": unusedImports,
            jest: pluginJest,
        }
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        extends: [
            tseslint.configs.disableTypeChecked
        ],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
            "no-undef": "off"
        }
    }
);
