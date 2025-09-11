import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from 'path';

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],

  // 添加路径别名
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Build optimizations
  build: {
    // Target modern browsers
    target: ['es2020', 'chrome87', 'firefox78', 'safari14'],
    // Generate sourcemaps for better debugging
    sourcemap: process.env.NODE_ENV === 'development',
    // Optimize CSS
    cssCodeSplit: true,
    // Rollup options
    rollupOptions: {
      output: {
        // Manual chunks for better caching
        manualChunks: {
          'element-plus': ['element-plus'],
          'three': ['three'],
          'fontawesome': [
            '@fortawesome/fontawesome-svg-core',
            '@fortawesome/free-solid-svg-icons',
            '@fortawesome/vue-fontawesome'
          ],
          'vue-vendor': ['vue', 'vue-router', 'pinia']
        }
      }
    },
    // Increase chunk size warning limit for large dependencies
    chunkSizeWarningLimit: 1000,
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production'
      }
    }
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __TAURI_ENV__: JSON.stringify(process.env.TAURI_ENV_PLATFORM || 'web')
  },

  // CSS processing
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables.scss" as *;`,
        api: 'modern-compiler' // silences deprecation warnings
      }
    }
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'element-plus',
      '@fortawesome/vue-fontawesome',
      '@fortawesome/fontawesome-svg-core',
      '@fortawesome/free-solid-svg-icons'
    ],
    exclude: [
      '@tauri-apps/api'
    ]
  }
}));
