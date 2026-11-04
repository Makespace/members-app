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
            "jest/valid-title": "off", // Struggles to detect the title being a dynamic string from paramterized tests.
            "jest/expect-expect": "off", // Too many false positives
            "jest/no-disabled-tests": "off", // Some tests are supposed to be skipped.
            "jest/valid-describe-callback": "off", // Doing something like describe('test', () => runTest()); is fine.
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
        // Every write to Recurly goes through src/recurly-write/ - see
        // "Recurly writes" in AGENTS.md. Also enforced by
        // tests/recurly-write/recurly-write-boundary.test.ts.
        files: ['src/**/*.ts', 'scripts/**/*.ts'],
        ignores: [
            'src/recurly-write/recurly-write-gateway.ts',
            'src/sync-worker/recurly/pull-recurly-data.ts',
        ],
        rules: {
            "no-restricted-imports": ["error", {
                paths: [{
                    name: "recurly",
                    message: "Recurly writes must go through deps.recurlyWrite (src/recurly-write/). See 'Recurly writes' in AGENTS.md.",
                }],
            }],
        },
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
