const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'scripts/*', '.expo/*'],
  },
  {
    rules: {
      // React-Compiler-era strictness that flags deliberate classic-RN idioms:
      // Animated.Value/PanResponder refs are created and read during render by
      // design, session clocks seed refs with Date.now(), and sheets reset
      // state when they (re)open. Revisit if/when we adopt the compiler.
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
