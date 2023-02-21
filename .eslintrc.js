module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 'latest'
  },
  extends: [
    'standard'
  ],
  rules: {
    'no-shadow': 'error',
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }]
  }
}
