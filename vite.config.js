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

  // Public directory for static assets
  publicDir: 'public',
  
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
    // Target modern browsers that support top-level await
    target: ['es2022', 'chrome89', 'firefox89', 'safari15'],
    // Generate sourcemaps for better debugging
    sourcemap: process.env.NODE_ENV === 'development',
    // Optimize CSS
    cssCodeSplit: true,
    // Copy public directory assets
    copyPublicDir: true,
    // Rollup options
    rollupOptions: {
      output: {
        // Support top-level await
        format: 'es',
        // Manual chunks for better caching and loading
        manualChunks: {
          // Vue核心库
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          // UI组件库
          'element-plus': ['element-plus'],
          // 图标库
          'fontawesome': [
            '@fortawesome/fontawesome-svg-core',
            '@fortawesome/free-solid-svg-icons',
            '@fortawesome/vue-fontawesome'
          ],
          // 图表库
          'charts': ['echarts'],
          // Three.js核心
          'three-core': ['three'],
          // Three.js扩展
          'three-addons': [
            'three/examples/jsm/Addons.js',
            'three/examples/jsm/libs/stats.module.js'
          ],
          // 网络请求
          'network': ['axios'],
          // Tauri API
          'tauri': ['@tauri-apps/api', '@tauri-apps/plugin-opener']
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
      // Vue生态系统
      'vue',
      'vue-router',
      'pinia',
      // UI组件
      'element-plus',
      // 图标库
      '@fortawesome/vue-fontawesome',
      '@fortawesome/fontawesome-svg-core',
      '@fortawesome/free-solid-svg-icons',
      // Three.js (核心部分预构建)
      'three/src/Three.js',
      // 网络请求
      'axios',
      // 图表库
      'echarts'
    ],
    exclude: [
      // Tauri API在运行时动态加载
      '@tauri-apps/api',
      '@tauri-apps/plugin-opener',
      // Three.js示例模块保持原始格式
      'three/examples/jsm/Addons.js',
      'three/examples/jsm/libs/stats.module.js'
    ]
  }
}));
