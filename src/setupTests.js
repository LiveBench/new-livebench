// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
// Enable React 18 act() support for tests that render with react-dom directly.
global.IS_REACT_ACT_ENVIRONMENT = true;
// jest-dom matchers are optional — only loaded if the package is installed.
try { require('@testing-library/jest-dom'); } catch (e) { /* not installed; plain assertions only */ }
