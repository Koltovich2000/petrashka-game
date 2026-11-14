import {defineConfig} from 'vite';

// The Mini App and its same-origin API are served at the domain root.
export default defineConfig({
 base: '/',
 build: {outDir:'dist', target:'es2022'},
});
